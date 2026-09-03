import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  HandHeart,
  Link2,
  Mail,
  MapPin,
  QrCode,
  Share2,
  Users,
  Wrench,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaceSearch } from "@/components/community/place-search";
import { JsonLd } from "@/components/community/json-ld";
import { getCommunityFeed, listCommunities } from "@/lib/community/server";
import type { Community, CommunityEvent, Need, Service } from "@/lib/community/types";
import type { WeekendPlan } from "@/lib/community/weekend";
import { KIND_LABELS } from "@/lib/community/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatEventWhen } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [feedStatus, setFeedStatus] = useState<"loading" | "ready" | "error">("loading");
  const [communitiesError, setCommunitiesError] = useState(false);
  const [weekend, setWeekend] = useState<WeekendPlan | null>(null);

  useEffect(() => {
    listCommunities()
      .then((rows) => {
        setCommunities(rows);
        setCommunitiesError(false);
      })
      .catch(() => {
        setCommunities([]);
        setCommunitiesError(true);
      });
    getCommunityFeed({ data: { slug: "vidalia" } })
      .then((f) => {
        const cutoff = Date.now() - 6 * 3600 * 1000;
        const upcoming = f.events.filter((e) => {
          const t = Date.parse(String(e.starts_at));
          return Number.isFinite(t) && t >= cutoff;
        });
        setNeeds(f.needs.slice(0, 3));
        setServices(f.services.slice(0, 2));
        setEvents((upcoming.length ? upcoming : f.events).slice(0, 2));
        setFeedStatus("ready");
      })
      .catch(() => setFeedStatus("error"));
    fetch("/api/weekend")
      .then(async (res) => {
        const d = (await res.json()) as { ok?: boolean; plan?: WeekendPlan };
        if (res.ok && d.ok && d.plan) setWeekend(d.plan);
      })
      .catch(() => {
        /* weekend page still works if this card is empty */
      });
  }, []);

  const vidalia = communities.find((c) => c.slug === "vidalia");
  const milstead = communities.find((c) => c.slug === "milstead");

  async function tryNow() {
    if (user) {
      await navigate({ to: "/app" });
      return;
    }
    await navigate({
      to: "/signup",
      search: { community: "vidalia", code: "VIDALIA-WELCOME" },
    });
  }

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_left,color-mix(in_oklab,var(--color-accent)_10%,transparent),transparent_50%)]"
        />
        <div className="page-shell relative grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <Badge className="w-fit">Live in Vidalia, Georgia</Badge>
            <h1 className="font-display text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Just landed? Start with this weekend.
            </h1>
            <p className="max-w-xl text-lg text-fg-muted">
              Neighborly is a local board for what is actually happening — starting in
              Vidalia, and any ZIP you type. Weather, public calendars, pickleball, church
              listings, and a place to ask for a real hand. No account needed to look.
              We will not invent neighbors or events for you.
            </p>
            <PlaceSearch size="lg" defaultValue="30474" />
            {weekend?.arrivingNote ? (
              <p className="max-w-xl rounded-[var(--radius-lg)] border border-primary/25 bg-primary-soft/40 p-4 text-sm text-fg">
                {weekend.arrivingNote}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/weekend" search={{ place: "vidalia" }}>
                  This weekend in Vidalia
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/c/$slug" params={{ slug: "vidalia" }}>
                  Vidalia board
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => void tryNow()}>
                {user ? "Open my hub" : "Join Vidalia"}
              </Button>
            </div>
            <p className="text-sm text-fg-subtle">
              Join is a real email account and profile. Browse and the weekend plan work
              without signing up.
            </p>
          </div>

          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">
                {vidalia?.name ?? "Vidalia"} right now
              </CardTitle>
              <CardDescription>
                {feedStatus === "error"
                  ? "The live board could not load."
                  : needs[0] || services[0] || events[0]
                    ? "Live from the board — tap any row to open the community."
                    : "Vidalia is live. The first real posts will show here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {events[0] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{events[0].title}</span>
                    <span className="text-xs text-fg-muted">
                      {formatEventWhen(events[0].starts_at)} · {events[0].rsvp_count} going
                    </span>
                  </span>
                </Link>
              )}
              {events[1] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{events[1].title}</span>
                    <span className="text-xs text-fg-muted">
                      {formatEventWhen(events[1].starts_at)} · {events[1].rsvp_count} going
                    </span>
                  </span>
                </Link>
              )}
              {needs[0] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <HandHeart className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{needs[0].title}</span>
                    <span className="text-xs text-fg-muted">
                      {needs[0].author_name} · {needs[0].urgency}
                    </span>
                  </span>
                </Link>
              )}
              {services[0] && (
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg px-3 py-3 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{services[0].title}</span>
                    <span className="text-xs text-fg-muted">
                      {services[0].provider_name} · {services[0].pricing}
                    </span>
                  </span>
                </Link>
              )}
              {feedStatus === "loading" && !needs[0] && !services[0] && !events[0] && (
                <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-bg-subtle" />
              )}
              {feedStatus === "error" && (
                <p className="text-sm text-fg-muted">
                  Could not load the Vidalia board. Open the full board to try again.
                </p>
              )}
              {feedStatus === "ready" && !needs[0] && !services[0] && !events[0] && (
                <p className="text-sm text-fg-muted">
                  No posts yet — be the first neighbor to ask, offer, or gather.
                </p>
              )}
              <Button asChild variant="soft" className="w-full">
                <Link to="/c/$slug" params={{ slug: "vidalia" }}>
                  Open full Vidalia board
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Where people already gather in Vidalia
          </h2>
          <p className="mt-2 text-fg-muted">
            Real public places — not invented neighbors. Show up, then post if you want company next time.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Pickleball",
              body: "Outdoor courts at the Rec Complex (102 Stockyard Rd) and indoor play at First Baptist gym. Beginners welcome.",
              href: "/c/vidalia-pickleball",
            },
            {
              title: "Downtown & PAL Theatre",
              body: "Church Street shops, coffee, The Market on Church, and the historic PAL Theatre — a way to become a regular.",
              href: "/c/vidalia",
            },
            {
              title: "Vidalia dads",
              body: "An empty chair on purpose. Dads — including after divorce — who want to be known and stay present for their kids.",
              href: "/c/vidalia-dads",
            },
            {
              title: "Church & recovery",
              body: "Celebrate Recovery Thursday 6pm at First Baptist. GriefShare and pickleball are also on their public calendar.",
              href: "/c/vidalia",
            },
            {
              title: "Library & civic groups",
              body: "Vidalia Regional Library (610 Jackson St) plus Rotary and other civic tables that still meet in person.",
              href: "/c/vidalia",
            },
            {
              title: "Onion Festival & seasons",
              body: "Late April each year — plus July 4th, downtown Christmas, and the everyday in-between.",
              href: "/c/vidalia",
            },
          ].map((p) => (
            <Link
              key={p.title}
              to="/c/$slug"
              params={{ slug: p.href.replace("/c/", "") }}
              className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
            >
              <h3 className="font-display text-lg font-semibold text-fg">{p.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{p.body}</p>
            </Link>
          ))}
        </div>
        {milstead ? (
          <p className="mt-6 text-sm text-fg-subtle">
            Milstead remains a Neighborly market.{" "}
            <Link to="/c/$slug" params={{ slug: "milstead" }} className="underline">
              Open the Milstead board
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="page-shell py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Built for real community life
          </h2>
          <p className="mt-2 text-fg-muted">
            Help, services, events, facilities, and people next door — all interactive.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Ask for help",
              body: "Post a need, get real offers, accept a neighbor.",
              icon: HandHeart,
              to: "/c/vidalia" as const,
            },
            {
              title: "Offer skills & services",
              body: "Businesses, side hustles, and kids earning money.",
              icon: Wrench,
              to: "/c/vidalia" as const,
            },
            {
              title: "Gather together",
              body: "Block parties, cleanups, BBQs — RSVP sticks.",
              icon: CalendarDays,
              to: "/c/vidalia" as const,
            },
            {
              title: "Reserve places",
              body: "Request the pavilion or community room.",
              icon: MapPin,
              to: "/c/vidalia" as const,
            },
            {
              title: "Welcome newcomers",
              body: "New residents get a path to meet people fast.",
              icon: Users,
              to: "/c/vidalia" as const,
            },
            {
              title: "Many communities",
              body: "Neighborhood, church, HOA, vacation home — multi-join.",
              icon: Share2,
              to: "/communities" as const,
            },
          ].map((f) => (
            <Link
              key={f.title}
              to={f.to === "/communities" ? "/communities" : "/c/$slug"}
              params={f.to === "/communities" ? undefined : { slug: "vidalia" }}
              className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="signup-paths" className="border-y border-border bg-bg-elevated py-16">
        <div className="page-shell">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              How people actually join
            </h2>
            <p className="mt-2 text-fg-muted">
              Website, invite link, or a QR flyer — then a real account. We do not invent a neighbor for you.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MapPin,
                title: "Pick on the website",
                body: "Browse communities and multi-select the ones that fit.",
              },
              {
                icon: Link2,
                title: "Personal invite link",
                body: "Text, email, Facebook, or YouTube description with a code.",
              },
              {
                icon: QrCode,
                title: "QR on mailboxes",
                body: "Printable flyers neighbors hang on doors.",
              },
              {
                icon: Mail,
                title: "Account + profile",
                body: "Email/password or Google/X, then skills and alerts.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-xl)] border border-border bg-bg p-5"
              >
                <item.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-medium text-fg">{item.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => void tryNow()}>{user ? "Open my hub" : "Join Vidalia"}</Button>
            <Button asChild variant="outline">
              <Link to="/join/$code" params={{ code: "VIDALIA-QR" }}>
                Vidalia invite / QR
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/signup" search={{ community: "vidalia", code: "VIDALIA-WELCOME" }}>
                Full signup form
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-shell py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Communities ready to explore
            </h2>
            <p className="mt-2 text-fg-muted">
              Vidalia is the live market. You can belong to more than one — Milstead stays available.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/communities">See all</Link>
          </Button>
        </div>
        {communitiesError ? (
          <p className="text-sm text-fg-muted" role="alert">
            Could not load communities. Refresh the page, or open the Vidalia board.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map((c) => (
            <Link
              key={c.id}
              to="/c/$slug"
              params={{ slug: c.slug }}
              className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABELS[c.kind]}</Badge>
                {c.is_featured && <Badge>Featured</Badge>}
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{c.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{c.tagline}</p>
              <p className="mt-3 text-xs text-fg-subtle">
                {c.city}, {c.state} · {c.member_count} members · code {c.invite_code}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-bg-elevated py-16">
        <div className="page-shell">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Other doors when you are ready
            </h2>
            <p className="mt-2 text-fg-muted">
              Neighborly does not open those accounts for you. Same email later is enough.
              Friendship before dating. The win is a real table, not another feed.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "You Are Awesome coin",
                body: "If you find a LOOK UP coin, that door is Presence — a dusk prompt, not a leaderboard.",
                href: "https://presence.unitedundergod.org/t/LOOKUP",
              },
              {
                title: "Presence — coffee, a walk, a meal",
                body: "One yes with a real person. Hosts are real; empty stays empty.",
                href: "https://presence.unitedundergod.org/",
              },
              {
                title: "Kindred — friendship first",
                body: "Belonging before romance. We will not create this for you.",
                href: "https://kindred.unitedundergod.org/",
              },
              {
                title: "ChurchConnect",
                body: "If a church here is on the platform, serving and groups get handled there.",
                href: "https://churchconnect.unitedundergod.org/",
              },
              {
                title: "Kids Need Dads",
                body: "For dads who still matter to their kids — including after divorce.",
                href: "https://dads.unitedundergod.org/",
              },
              {
                title: "Live On Mission",
                body: "A small way to serve once you have a little room to give.",
                href: "https://liveonmission.unitedundergod.org/",
              },
            ].map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
                target="_blank"
                rel="noreferrer"
              >
                <h3 className="font-display text-lg font-semibold text-fg">{item.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{item.body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Neighborly",
          url: "https://neighborly.unitedundergod.org/",
          description:
            "What's going on in your town this week. Public gatherings, a neighbor board, no invented people.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://neighborly.unitedundergod.org/near?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <footer className="border-t border-border py-10">
        <div className="page-shell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-fg">
            <HandHeart className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold">Neighborly</span>
            <span className="text-sm text-fg-subtle">· Vidalia first market · United Under God</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-fg-subtle">
            <Link to="/privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-fg">
              Terms
            </Link>
            <Link to="/how-it-works" className="hover:text-fg">
              How it works
            </Link>
            <a href="https://appengine.unitedundergod.org/help?app=neighborly" className="hover:text-fg">
              Need help?
            </a>
            <span>Help when you can. Ask when you need. Belong where you live.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
