import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, HandHeart, HeartHandshake, Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SearchBox } from "@/components/community/search-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCommunityFeed } from "@/lib/community/server";
import { CC_GET_HELP } from "@/lib/community/pantry";
import type { CommunityEvent, Need } from "@/lib/community/types";
import { formatEventWhen } from "@/lib/utils";

/**
 * The ministry door.
 *
 * Faith gatherings were already postable as events, but nothing gathered them:
 * a neighbor who wanted "a Bible study" or "somewhere to serve" had to guess
 * which tab and which chip. This page collects what is genuinely on the board —
 * faith gatherings, interest-checks, and open ways to serve — and hands anyone
 * still looking a way to say so.
 *
 * It writes nothing itself. Hosting and RSVPs go to the pages that already do
 * that, and church records stay in ChurchConnect rather than being copied here.
 */

type MinistrySearch = { place?: string };

/** Kinds that are a gathering to join. */
const FAITH_KINDS = new Set(["faith"]);
/** Kinds that are a chance to serve. */
const SERVE_KINDS = new Set(["serve", "cleanup"]);

const EMPTY_FEED = {
  community: null,
  needs: [] as Need[],
  services: [],
  tools: [],
  events: [] as CommunityEvent[],
  facilities: [],
  neighbors: [],
};

export const Route = createFileRoute("/ministry")({
  validateSearch: (s: Record<string, unknown>): MinistrySearch => ({
    place: typeof s.place === "string" ? s.place : undefined,
  }),
  loaderDeps: ({ search }) => ({ place: search.place || "vidalia" }),
  // Server-rendered, like the community board: without this the first paint
  // showed the raw slug ("vidalia") and empty sections until the client fetch
  // landed.
  loader: async ({ deps }) => {
    try {
      return await getCommunityFeed({ data: { slug: deps.place } });
    } catch {
      return EMPTY_FEED;
    }
  },
  head: () => ({
    meta: [
      { title: "Bible studies, ministry & ways to serve — Neighborly" },
      {
        name: "description",
        content:
          "Bible studies, small groups, and ways to serve that neighbors have actually posted. Empty stays empty — we will not invent a group or a ministry.",
      },
    ],
  }),
  component: MinistryPage,
});

function upcoming(events: CommunityEvent[]): CommunityEvent[] {
  const cutoff = Date.now() - 6 * 3600 * 1000;
  return events.filter((e) => {
    const t = Date.parse(String(e.starts_at));
    return Number.isFinite(t) && t >= cutoff;
  });
}

function EventRow({ event, slug }: { event: CommunityEvent; slug: string }) {
  return (
    <a
      href={`/c/${slug}?tab=events`}
      data-testid={`ministry-event-${event.id}`}
      className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
    >
      <p className="text-xs text-fg-muted">{formatEventWhen(event.starts_at)}</p>
      <p className="font-medium text-fg">{event.title}</p>
      {event.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{event.description}</p>
      ) : null}
      <p className="mt-2 text-xs text-fg-subtle">
        {[event.location, event.host_name].filter(Boolean).join(" · ")}
        {event.rsvp_count ? ` · ${event.rsvp_count} going` : ""}
      </p>
    </a>
  );
}

function MinistryPage() {
  const search = Route.useSearch();
  const feed = Route.useLoaderData();
  const slug = search.place || "vidalia";
  const events = feed.events;
  const needs = feed.needs;
  const communityName = feed.community?.name ?? slug;
  const zip = feed.community?.zip ?? "";
  const loaded = Boolean(feed.community);

  const studies = upcoming(events).filter((e) => FAITH_KINDS.has(e.kind));
  // An interest-check ("who wants to start a study?") is not a gathering yet,
  // but it is exactly what someone looking to get involved should see.
  const interestChecks = upcoming(events).filter(
    (e) =>
      e.kind === "invite" &&
      /bible|study|group|ministry|prayer|faith|worship|fellowship/i.test(
        `${e.title} ${e.description}`,
      ),
  );
  const serveEvents = upcoming(events).filter((e) => SERVE_KINDS.has(e.kind));
  const serveNeeds = needs.filter(
    (n) => n.category === "serve" && (n.status === "open" || n.status === "matched"),
  );

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-3xl space-y-8 py-10">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Ministry & small groups</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Somewhere to belong, and something to do
          </h1>
          <p className="text-fg-muted">
            Bible studies, small groups, and ways to serve in{" "}
            <strong className="text-fg">{communityName}</strong> — as posted by real people.
            If a section below is empty, that is the truth: nobody has posted one yet, and
            we will not invent a group to fill the space.
          </p>
        </div>

        <SearchBox
          slug={slug}
          placeholder="Search — bible study, prayer, youth, serve…"
          showExamples={false}
        />

        {!loaded && (
          <p className="text-sm text-danger">
            Could not load the {slug} board just now. Try again in a moment.
          </p>
        )}

        <section className="space-y-3" data-testid="ministry-studies">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <BookOpen className="h-4 w-4 text-primary" />
            Bible studies & small groups
          </h2>
          {studies.map((e) => (
            <EventRow key={e.id} event={e} slug={slug} />
          ))}
          {loaded && studies.length === 0 && (
            <p className="text-sm text-fg-muted">
              No study or small group is posted here yet. If you host one — or would go to
              one — say so below and neighbors can find it.
            </p>
          )}
        </section>

        {interestChecks.length > 0 && (
          <section className="space-y-3" data-testid="ministry-interest">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Neighbors asking who&apos;s interested
            </h2>
            <p className="text-sm text-fg-muted">
              Not a scheduled group yet — someone is checking whether enough people would
              come. Saying you are interested is how these start.
            </p>
            {interestChecks.map((e) => (
              <EventRow key={e.id} event={e} slug={slug} />
            ))}
          </section>
        )}

        <section className="space-y-3" data-testid="ministry-serve">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <HandHeart className="h-4 w-4 text-primary" />
            Ways to serve right now
          </h2>
          {serveEvents.map((e) => (
            <EventRow key={e.id} event={e} slug={slug} />
          ))}
          {serveNeeds.map((n) => (
            <a
              key={n.id}
              href={`/c/${slug}?tab=needs`}
              data-testid={`ministry-need-${n.id}`}
              className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
            >
              <div className="mb-1 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{n.urgency}</Badge>
                <Badge variant="outline">Volunteer / serve</Badge>
              </div>
              <p className="font-medium text-fg">{n.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{n.description}</p>
              <p className="mt-2 text-xs text-fg-subtle">
                {n.author_name} · {n.help_count ?? 0} offers
              </p>
            </a>
          ))}
          {loaded && serveEvents.length === 0 && serveNeeds.length === 0 && (
            <p className="text-sm text-fg-muted">
              Nothing posted right now. A neighbor asking for a hand is the most common way
              to serve here — those show up on the needs board as they come in.
            </p>
          )}
        </section>

        <section className="space-y-3" data-testid="ministry-get-involved">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <HeartHandshake className="h-4 w-4 text-primary" />
            Looking to get involved?
          </h2>
          <p className="text-sm text-fg-muted">
            You do not have to wait for someone else to organize it. Any of these puts a
            real thing in front of real neighbors — nothing is posted on your behalf.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-card p-4">
              <p className="font-medium text-fg">Start a study or small group</p>
              <p className="mt-1 text-sm text-fg-muted">
                Pick a time and place, or just ask who&apos;s interested first and name the
                table once enough people say yes.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/app/events" search={{ kind: "faith" }}>
                  Host a gathering
                </Link>
              </Button>
            </div>
            <div className="surface-card p-4">
              <p className="font-medium text-fg">Offer to serve</p>
              <p className="mt-1 text-sm text-fg-muted">
                Tell neighbors what you can do — visits, rides, yard work, a meal — so
                someone who needs it can ask you directly.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-3">
                <Link to="/app/services">Register what you offer</Link>
              </Button>
            </div>
            <div className="surface-card p-4">
              <p className="font-medium text-fg">Ask for a group to join</p>
              <p className="mt-1 text-sm text-fg-muted">
                Post it as a need — &ldquo;looking for a men&apos;s study&rdquo; is a real
                need, and someone reading the board may already have one.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-3">
                <Link to="/app/needs">Post a need</Link>
              </Button>
            </div>
            <div className="surface-card p-4">
              <p className="font-medium text-fg">Find a church</p>
              <p className="mt-1 text-sm text-fg-muted">
                Service times, ministries and contacts come from ChurchConnect&apos;s public
                records — Neighborly does not keep a second copy.
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-3">
                <Link to="/churches" search={{ zip: zip || "30474" }}>
                  Churches near {communityName}
                </Link>
              </Button>
            </div>
          </div>
          <p className="text-sm text-fg-muted">
            Need food or practical help rather than a group?{" "}
            <a className="text-primary underline" href={`/c/${slug}?tab=places&cat=pantry`}>
              Food pantries on this board
            </a>
            {" · "}
            <a className="text-primary underline" href={CC_GET_HELP} target="_blank" rel="noreferrer">
              ChurchConnect Get Help
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
