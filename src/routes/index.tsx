import { createFileRoute, Link } from "@tanstack/react-router";
import { weekendLede } from "@/lib/events/lede";
import { HandHeart, Soup, Wrench } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { PagePending } from "@/components/layout/page-pending";
import { SiteFooter } from "@/components/layout/site-footer";
import { PlaceSearch } from "@/components/community/place-search";
import { WeekendFeed } from "@/components/events/event-feed";
import { listCommunities } from "@/lib/community/server";
import { loadWeekendPlan, weekendWeatherDays, type WeekendPlan } from "@/lib/community/weekend";
import type { Community } from "@/lib/community/types";
import { loadSavedPlace } from "@/lib/community/place-cookie";
import { CC_GET_HELP } from "@/lib/community/pantry";
import { useRememberPlace } from "@/lib/community/remember-place";
import { canonicalLinks, SITE_URL } from "@/lib/seo";

type HomeSearch = { place?: string; q?: string };

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v).padStart(5, "0");
  return undefined;
}

const STATE_NAMES: Record<string, string> = { GA: "Georgia" };

/** The town the home page is about: the searched or saved place, Vidalia by default. */
function homePlace(plan: WeekendPlan | null) {
  const p = plan?.place;
  const town = p?.city || p?.name || "Vidalia";
  const state = p?.state || "GA";
  const isVidalia = !p || (p.slug || "").startsWith("vidalia") || /^vidalia$/i.test(p.city || "");
  // A town with its own board links to it; anywhere else goes by ZIP (or name).
  const weekendSearch: { place?: string; q?: string } =
    p?.board && p.slug ? { place: p.slug } : { q: p?.zip || town };
  // The town's own board for "Post a need" and friends; Vidalia's on Vidalia.
  const boardSlug = isVidalia ? "vidalia" : p?.board && p.slug ? p.slug : null;
  return {
    p,
    town,
    state,
    stateName: STATE_NAMES[state] || state,
    isVidalia,
    weekendSearch,
    boardSlug,
  };
}

export const Route = createFileRoute("/")({
  // /?zip=30014, /?q=Covington or /?place=<board> server-render that town; bare / renders
  // the saved town (cookie), else Vidalia.
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    place: str(s.place),
    q: str(s.q) ?? str(s.zip),
  }),
  loaderDeps: ({ search }) => ({ place: search.place, q: search.q }),
  // Bare / depends on a cookie the URL doesn't show, so never reuse an older
  // render of it (that was the one-time Vidalia flash after a search): drop it
  // from the cache on leave, and wait for the fresh load instead of painting stale data.
  gcTime: 0,
  staleTime: 0,
  loader: {
    staleReloadMode: "blocking",
    handler: async ({ deps }) => {
      const explicit = Boolean(deps.place || deps.q);
      // Bare / (and the logo) use the visitor's saved town from the cookie, on the server too.
      if (!explicit) {
        const saved = await loadSavedPlace();
        if (saved)
          deps = { place: saved.slug || undefined, q: saved.zip || saved.city || undefined };
      }
      const [plan, communities] = await Promise.all([
        loadWeekendPlan({
          data: {
            place: deps.place || (deps.q ? undefined : "vidalia"),
            query: deps.q || deps.place || "vidalia",
            remember: explicit,
          },
        }).catch(() => null as WeekendPlan | null),
        listCommunities().catch(() => [] as Community[]),
      ]);
      return { plan, communities };
    },
  },
  head: ({ loaderData }) => {
    const { town, stateName } = homePlace(loaderData?.plan ?? null);
    return {
      meta: [
        { title: "Neighborly — what's on this weekend, and the neighbors who'll be there" },
        {
          name: "description",
          content: `Festivals, shows, park days, and neighbor gatherings in ${town}, ${stateName} and towns nearby — plus a friendly place to ask for a hand or offer one.`,
        },
        {
          property: "og:title",
          content: `This weekend in ${town}, and the neighbors who'll be there`,
        },
        {
          property: "og:description",
          content:
            "Find what's on near you this weekend. Browse free; join when you want to RSVP or lend a hand.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE_URL}/` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: canonicalLinks("/"),
    };
  },
  // Same for home (the logo, a new town): a loading state, never the old page.
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: PagePending,
  component: LandingPage,
});

/**
 * Boards that belong with a town but don't share its slug. Milstead is a
 * Rockdale County community next to Conyers (seeded with city "Milstead"), so it
 * shows under Conyers, never under Vidalia.
 */
const NEARBY_BOARDS: Record<string, string[]> = { conyers: ["milstead"] };

const PLACES = [
  {
    title: "Downtown Vidalia",
    body: "Church Street shops, coffee, The Market on Church, and movies at the historic Pal.",
    img: "/img/vidalia/cityhall.jpg",
    alt: "The Vidalia Municipal Building downtown",
    to: "/c/$slug" as const,
    params: { slug: "vidalia" },
    search: { tab: "places" },
  },
  {
    title: "Parks & pickleball",
    body: "Free courts at the Rec Complex, plus downtown park evenings with the kids.",
    img: "/img/vidalia/amphitheater.jpg",
    alt: "The downtown park amphitheater in Vidalia",
    to: "/c/$slug" as const,
    params: { slug: "vidalia-pickleball" },
    search: {},
  },
  {
    title: "Onion Festival & the seasons",
    body: "Late April every year, plus July 4th, downtown Christmas, and every weekend in between.",
    img: "/img/vidalia/onions.jpg",
    alt: "Sweet Vidalia onions",
    to: "/weekend" as const,
    params: {},
    search: { place: "vidalia" },
  },
];

function ledeFor(plan: WeekendPlan | null, town: string): string {
  return weekendLede(plan?.feed?.events ?? [], town);
}

function LandingPage() {
  const { plan, communities } = Route.useLoaderData();
  const search = Route.useSearch();
  const { p, town, state, stateName, isVidalia, weekendSearch, boardSlug } = homePlace(plan);
  // Opening /?zip=… (or searching) makes that the visitor's town, so bare /
  // and the logo keep it on the next visit.
  useRememberPlace(search.place || search.q ? plan : null);
  const feed = plan?.feed ?? null;
  const weather = weekendWeatherDays(plan?.weather ?? []);
  const groups = isVidalia
    ? communities.filter((c) => c.slug.startsWith("vidalia"))
    : boardSlug
      ? communities.filter(
          (c) => c.slug === boardSlug || c.slug.startsWith(`${boardSlug}-`) || (NEARBY_BOARDS[boardSlug] ?? []).includes(c.slug),
        )
      : [];

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative">
          <div className="page-shell grid items-center gap-8 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-14">
            <div className="space-y-5">
              <span className="eyebrow">
                {town}, {stateName}
                {feed ? ` · ${feed.window.label}` : ""}
              </span>
              <h1 className="font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-fg text-balance lg:text-[3.5rem]">
                This weekend in {town}, and the neighbors who&apos;ll be there.
              </h1>
              <p className="max-w-[34em] text-lg text-fg-muted">{ledeFor(plan, town)}</p>
              <PlaceSearch defaultValue={p?.zip || (isVidalia ? "30474" : town)} />
              <p className="text-base text-fg-muted">
                Not in {town}? Type any town or ZIP. Or{" "}
                <Link
                  to="/search"
                  className="tap font-medium text-primary underline-offset-4 hover:underline"
                >
                  search for a pantry, a Bible study, or a hand with the yard →
                </Link>
              </p>
            </div>
            <div
              className={`relative min-h-[300px] overflow-hidden rounded-[var(--radius-xl)] lg:min-h-[460px] ${isVidalia ? "bg-sky-soft" : "bg-primary-soft"}`}
            >
              {isVidalia ? (
                <img
                  src="/img/vidalia/downtown.jpg"
                  alt="The Vidalia water tower: The Sweet Onion City"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                // Same treatment as the weekend page for towns without a photo.
                <div className="absolute inset-0 grid place-items-center p-8 pb-24 text-center">
                  <p className="font-display text-4xl font-semibold text-primary">{town}</p>
                </div>
              )}
              {(weather.length > 0 || plan?.weatherNote) && (
                <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
                  {weather.map((d) => (
                    <div
                      key={d.date}
                      className="rounded-[var(--radius-md)] bg-bg-elevated/95 px-4 py-2 text-base text-fg shadow-md"
                    >
                      <b className="block text-sm uppercase tracking-wide text-primary">
                        {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
                          weekday: "short",
                          timeZone: "UTC",
                        })}
                      </b>
                      {d.summary} · {d.maxF}°
                    </div>
                  ))}
                  {plan?.weatherNote && (
                    <div className="max-w-full rounded-[var(--radius-md)] bg-bg-elevated/95 px-4 py-2 text-base text-fg shadow-md">
                      {plan.weatherNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Happening this weekend */}
        <section className="py-11">
          <div className="page-shell">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold text-fg">
                  Happening this weekend
                </h2>
                <p className="mt-1.5 text-[1.0625rem] text-fg-muted">
                  From local calendars, parks, the Pal, and your neighbors. Please confirm before
                  you go.
                </p>
              </div>
              <Link
                to="/weekend"
                search={weekendSearch}
                className="inline-flex min-h-12 items-center rounded-full border border-border bg-bg-elevated px-5 text-base font-semibold text-fg no-underline hover:bg-bg-subtle"
              >
                Full weekend plan →
              </Link>
            </div>
            <WeekendFeed
              feed={feed}
              town={town}
              slug={p?.slug || "vidalia"}
              zip={p?.zip || "30474"}
              city={town}
              state={state}
              mode="all"
              limit={4}
              widerHref={`/weekend?${new URLSearchParams({ ...weekendSearch, radius: "50" })}`}
            />
          </div>
        </section>

        {/* Places (Vidalia's own spots, so only on Vidalia's home) */}
        {isVidalia && (
          <section className="border-y border-border bg-bg-elevated py-11">
            <div className="page-shell">
              <div className="mb-6">
                <h2 className="font-display text-3xl font-semibold text-fg">
                  Where Vidalia already gathers
                </h2>
                <p className="mt-1.5 text-[1.0625rem] text-fg-muted">
                  Real places where you can become a regular.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {PLACES.map((p) => (
                  <Link
                    key={p.title}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={p.to as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    params={p.params as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    search={p.search as any}
                    className="block overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg text-fg no-underline transition-shadow hover:shadow-md"
                  >
                    <img
                      src={p.img}
                      alt={p.alt}
                      loading="lazy"
                      className="h-48 w-full object-cover"
                    />
                    <div className="p-5">
                      <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                      <p className="mt-1.5 text-base text-fg-muted">{p.body}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Help */}
        <section className="py-11">
          <div className="page-shell">
            <div className="mb-6">
              <h2 className="font-display text-3xl font-semibold text-fg">
                Help when you can. Ask when you need.
              </h2>
              <p className="mt-1.5 text-[1.0625rem] text-fg-muted">
                {boardSlug
                  ? "Browsing is free. Make a free account to post, RSVP, or offer a hand."
                  : `${town} doesn't have a Neighborly board yet. Until it does, here's help nearby.`}
              </p>
            </div>
            {boardSlug ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-primary-soft p-6">
                  <HandHeart className="h-7 w-7 text-primary" aria-hidden />
                  <h3 className="font-display text-2xl font-semibold text-fg">Ask for a hand</h3>
                  <p className="text-base text-fg-muted">
                    A ride to the pharmacy, help moving a couch, a casserole after surgery. Post it
                    and neighbors can offer.
                  </p>
                  <Link
                    to="/c/$slug"
                    params={{ slug: boardSlug }}
                    search={{ tab: "needs" } as never}
                    className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full bg-primary px-5 text-base font-semibold text-primary-fg no-underline"
                  >
                    Post a need
                  </Link>
                </div>
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-accent-soft p-6">
                  <Wrench className="h-7 w-7 text-accent" aria-hidden />
                  <h3 className="font-display text-2xl font-semibold text-fg">
                    Offer what you&apos;re good at
                  </h3>
                  <p className="text-base text-fg-muted">
                    Yard work, tutoring, woodworking, a mower to lend. Small skills go a long way
                    here.
                  </p>
                  <Link
                    to="/c/$slug"
                    params={{ slug: boardSlug }}
                    search={{ tab: "services" } as never}
                    className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full bg-accent px-5 text-base font-semibold text-white no-underline"
                  >
                    Offer a skill
                  </Link>
                </div>
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-sky-soft p-6">
                  <Soup className="h-7 w-7 text-sky" aria-hidden />
                  <h3 className="font-display text-2xl font-semibold text-fg">
                    Find food &amp; support
                  </h3>
                  <p className="text-base text-fg-muted">
                    {isVidalia
                      ? "Toombs and Vidalia food pantries, churches, and GriefShare, with addresses and hours where they're posted."
                      : `Food pantries and churches neighbors have listed on the ${town} board, with hours where they're posted.`}
                  </p>
                  <Link
                    to="/c/$slug"
                    params={{ slug: boardSlug }}
                    search={{ tab: "places", cat: "pantry" } as never}
                    className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full border border-border bg-bg-elevated px-5 text-base font-semibold text-fg no-underline"
                  >
                    Find a pantry
                  </Link>
                </div>
              </div>
            ) : (
              // No board here: the same honest fallback the weekend page uses.
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-primary-soft p-6">
                  <HandHeart className="h-7 w-7 text-primary" aria-hidden />
                  <h3 className="font-display text-2xl font-semibold text-fg">
                    Start the {town} board
                  </h3>
                  <p className="text-base text-fg-muted">
                    A board is where neighbors ask for a hand, offer a skill, and post gatherings.
                    It takes one person to start.
                  </p>
                  <Link
                    to="/near"
                    search={(p?.zip ? { zip: p.zip } : {}) as never}
                    className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full bg-primary px-5 text-base font-semibold text-primary-fg no-underline"
                  >
                    Start the {town} board
                  </Link>
                </div>
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-accent-soft p-6">
                  <Wrench className="h-7 w-7 text-accent" aria-hidden />
                  <h3 className="font-display text-2xl font-semibold text-fg">
                    Churches near {town}
                  </h3>
                  <p className="text-base text-fg-muted">
                    Service times, ministries, and contacts for churches nearby.
                  </p>
                  <Link
                    to="/churches"
                    search={
                      { zip: p?.zip || undefined, city: town, state: state || undefined } as never
                    }
                    className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full bg-accent px-5 text-base font-semibold text-white no-underline"
                  >
                    Churches near {town}
                  </Link>
                </div>
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-sky-soft p-6">
                  <Soup className="h-7 w-7 text-sky" aria-hidden />
                  <h3 className="font-display text-2xl font-semibold text-fg">
                    Food help near {town}
                  </h3>
                  <p className="text-base text-fg-muted">
                    Ask churches nearby for groceries, meals, or a hand, through ChurchConnect&apos;s Get Help form.
                  </p>
                  <a
                    href={CC_GET_HELP}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full border border-border bg-bg-elevated px-5 text-base font-semibold text-fg no-underline"
                  >
                    Find food help
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Groups: only the boards in this town */}
        {boardSlug && (
          <section className="border-y border-border bg-bg-elevated py-11">
            <div className="page-shell">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-semibold text-fg">Find your people</h2>
                  <p className="mt-1.5 text-[1.0625rem] text-fg-muted">
                    Join as many groups as fit. Every group starts with one person who says yes.
                  </p>
                </div>
                <Link
                  to="/communities"
                  className="inline-flex min-h-12 items-center rounded-full border border-border bg-bg px-5 text-base font-semibold text-fg no-underline hover:bg-bg-subtle"
                >
                  All communities →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {groups.map((c) => (
                  <Link
                    key={c.id}
                    to="/c/$slug"
                    params={{ slug: c.slug }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg px-4 text-base text-fg no-underline hover:border-border-strong"
                  >
                    {c.slug === boardSlug
                      ? `${town} neighbors`
                      : c.name
                          .replace(new RegExp(`^${town.replace(/[^A-Za-z ]/g, "")}\\s+`, "i"), "")
                          .replace(/^./, (ch) => ch.toUpperCase())}
                    {c.member_count > 1 ? (
                      <span className="font-semibold text-primary">{c.member_count}</span>
                    ) : null}
                  </Link>
                ))}
                <Link
                  to="/ministry"
                  search={{ place: boardSlug }}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-bg px-4 text-base text-fg no-underline hover:border-border-strong"
                >
                  Bible studies &amp; serving
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter credits={isVidalia} />
      {/* WebSite + SearchAction JSON-LD is emitted site-wide from the root head (src/lib/seo.ts). */}
    </div>
  );
}
