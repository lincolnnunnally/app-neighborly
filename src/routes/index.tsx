import { createFileRoute, Link } from "@tanstack/react-router";
import { weekendLede } from "@/lib/events/lede";
import { HandHeart, Soup, Wrench } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PlaceSearch } from "@/components/community/place-search";
import { JsonLd } from "@/components/community/json-ld";
import { WeekendFeed } from "@/components/events/event-feed";
import { listCommunities } from "@/lib/community/server";
import { loadWeekendPlan, weekendWeatherDays, type WeekendPlan } from "@/lib/community/weekend";
import type { Community } from "@/lib/community/types";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [plan, communities] = await Promise.all([
      loadWeekendPlan({ data: { place: "vidalia", query: "vidalia" } }).catch(() => null as WeekendPlan | null),
      listCommunities().catch(() => [] as Community[]),
    ]);
    return { plan, communities };
  },
  head: () => ({
    meta: [
      { title: "Neighborly — what's on this weekend, and the neighbors who'll be there" },
      {
        name: "description",
        content:
          "Festivals, shows, park days, and neighbor gatherings in Vidalia, Georgia and towns nearby — plus a friendly place to ask for a hand or offer one.",
      },
      { property: "og:title", content: "This weekend in Vidalia, and the neighbors who'll be there" },
      {
        property: "og:description",
        content: "Find what's on near you this weekend. Browse free; join when you want to RSVP or lend a hand.",
      },
    ],
  }),
  component: LandingPage,
});

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

function ledeFor(plan: WeekendPlan | null): string {
  return weekendLede(plan?.feed?.events ?? [], plan?.place.city || "Vidalia");
}

function LandingPage() {
  const { plan, communities } = Route.useLoaderData();
  const feed = plan?.feed ?? null;
  const weather = weekendWeatherDays(plan?.weather ?? []);
  const groups = communities.filter((c) => c.slug.startsWith("vidalia") || c.slug === "milstead");

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative">
          <div className="page-shell grid items-center gap-8 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-14">
            <div className="space-y-5">
              <span className="eyebrow">Vidalia, Georgia{feed ? ` · ${feed.window.label}` : ""}</span>
              <h1 className="font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-fg text-balance lg:text-[3.5rem]">
                This weekend in Vidalia, and the neighbors who&apos;ll be there.
              </h1>
              <p className="max-w-[34em] text-lg text-fg-muted">{ledeFor(plan)}</p>
              <PlaceSearch defaultValue="30474" />
              <p className="text-base text-fg-muted">
                Not in Vidalia? Type any town or ZIP. Or{" "}
                <Link to="/search" className="tap font-medium text-primary underline-offset-4 hover:underline">
                  search for a pantry, a Bible study, or a hand with the yard →
                </Link>
              </p>
            </div>
            <div className="relative min-h-[300px] overflow-hidden rounded-[var(--radius-xl)] bg-sky-soft lg:min-h-[460px]">
              <img
                src="/img/vidalia/downtown.jpg"
                alt="The Vidalia water tower: The Sweet Onion City"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {(weather.length > 0 || plan?.weatherNote) && (
                <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
                  {weather.map((d) => (
                    <div key={d.date} className="rounded-[var(--radius-md)] bg-bg-elevated/95 px-4 py-2 text-base text-fg shadow-md">
                      <b className="block text-sm uppercase tracking-wide text-primary">
                        {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
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
                <h2 className="font-display text-3xl font-semibold text-fg">Happening this weekend</h2>
                <p className="mt-1.5 text-[1.0625rem] text-fg-muted">
                  From local calendars, parks, the Pal, and your neighbors. Please confirm before you go.
                </p>
              </div>
              <Link
                to="/weekend"
                search={{ place: "vidalia" }}
                className="inline-flex min-h-12 items-center rounded-full border border-border bg-bg-elevated px-5 text-base font-semibold text-fg no-underline hover:bg-bg-subtle"
              >
                Full weekend plan →
              </Link>
            </div>
            <WeekendFeed
              feed={feed}
              town="Vidalia"
              slug="vidalia"
              zip="30474"
              city="Vidalia"
              state="GA"
              mode="all"
              limit={4}
              widerHref="/weekend?place=vidalia&radius=50"
            />
          </div>
        </section>

        {/* Places */}
        <section className="border-y border-border bg-bg-elevated py-11">
          <div className="page-shell">
            <div className="mb-6">
              <h2 className="font-display text-3xl font-semibold text-fg">Where Vidalia already gathers</h2>
              <p className="mt-1.5 text-[1.0625rem] text-fg-muted">Real places where you can become a regular.</p>
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
                  <img src={p.img} alt={p.alt} loading="lazy" className="h-48 w-full object-cover" />
                  <div className="p-5">
                    <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                    <p className="mt-1.5 text-base text-fg-muted">{p.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Help */}
        <section className="py-11">
          <div className="page-shell">
            <div className="mb-6">
              <h2 className="font-display text-3xl font-semibold text-fg">Help when you can. Ask when you need.</h2>
              <p className="mt-1.5 text-[1.0625rem] text-fg-muted">
                Browsing is free. Make a free account to post, RSVP, or offer a hand.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-primary-soft p-6">
                <HandHeart className="h-7 w-7 text-primary" aria-hidden />
                <h3 className="font-display text-2xl font-semibold text-fg">Ask for a hand</h3>
                <p className="text-base text-fg-muted">
                  A ride to the pharmacy, help moving a couch, a casserole after surgery. Post it and neighbors can offer.
                </p>
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  search={{ tab: "needs" } as never}
                  className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full bg-primary px-5 text-base font-semibold text-primary-fg no-underline"
                >
                  Post a need
                </Link>
              </div>
              <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-accent-soft p-6">
                <Wrench className="h-7 w-7 text-accent" aria-hidden />
                <h3 className="font-display text-2xl font-semibold text-fg">Offer what you&apos;re good at</h3>
                <p className="text-base text-fg-muted">
                  Yard work, tutoring, woodworking, a mower to lend. Small skills go a long way here.
                </p>
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  search={{ tab: "services" } as never}
                  className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full bg-accent px-5 text-base font-semibold text-white no-underline"
                >
                  Offer a skill
                </Link>
              </div>
              <div className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] bg-sky-soft p-6">
                <Soup className="h-7 w-7 text-sky" aria-hidden />
                <h3 className="font-display text-2xl font-semibold text-fg">Find food &amp; support</h3>
                <p className="text-base text-fg-muted">
                  Toombs and Vidalia food pantries, churches, and GriefShare, with addresses and hours where they&apos;re posted.
                </p>
                <Link
                  to="/c/$slug"
                  params={{ slug: "vidalia" }}
                  search={{ tab: "places", cat: "pantry" } as never}
                  className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full border border-border bg-bg-elevated px-5 text-base font-semibold text-fg no-underline"
                >
                  Find a pantry
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Groups */}
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
                  {c.slug === "vidalia"
                    ? "Vidalia neighbors"
                    : c.name.replace(/^Vidalia\s+/i, "").replace(/^./, (ch) => ch.toUpperCase())}
                  {c.member_count > 1 ? <span className="font-semibold text-primary">{c.member_count}</span> : null}
                </Link>
              ))}
              <Link
                to="/ministry"
                search={{ place: "vidalia" }}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-bg px-4 text-base text-fg no-underline hover:border-border-strong"
              >
                Bible studies &amp; serving
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter credits />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Neighborly",
          url: "https://neighborly.unitedundergod.org/",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://neighborly.unitedundergod.org/search?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
    </div>
  );
}
