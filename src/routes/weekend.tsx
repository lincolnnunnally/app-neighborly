import { isListedCommunity } from "@/lib/community/public-filters";
import { useEffect, useState } from "react";
import { Link, createFileRoute, notFound, useNavigate, useRouterState } from "@tanstack/react-router";
import { CloudRain, CloudSun, Sun } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PlaceSearch } from "@/components/community/place-search";
import { JsonLd } from "@/components/community/json-ld";
import { WeekendFeed, ModeChips, RadiusChips, CategoryChips, filterMode, type FeedMode } from "@/components/events/event-feed";
import { filterByChip, isChipId, resultsHeading, type ChipId } from "@/lib/events/chips";
import { DEFAULT_RADIUS_MI, RADIUS_CHOICES } from "@/lib/events/radius";
import { getMyProfile } from "@/lib/community/server";
import { readSavedPlace } from "@/lib/community/saved-place";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadWeekendPlan, weekendWeatherDays, type WeekendPlan } from "@/lib/community/weekend";
import { cn } from "@/lib/utils";

type WeekendSearch = { place?: string; q?: string; radius?: number; who?: FeedMode; cat?: ChipId };

const RADII: readonly number[] = RADIUS_CHOICES;

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v).padStart(5, "0");
  return undefined;
}

export const Route = createFileRoute("/weekend")({
  validateSearch: (s: Record<string, unknown>): WeekendSearch => {
    const r = Number(s.radius);
    const who = s.who === "kids" || s.who === "me" ? (s.who as FeedMode) : undefined;
    return {
      place: str(s.place),
      // Search params like ?q=30303 arrive as numbers after JSON parsing.
      q: str(s.q) ?? str(s.zip),
      radius: RADII.includes(r) ? r : undefined,
      who,
      cat: isChipId(s.cat) ? s.cat : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ place: search.place, q: search.q, radius: search.radius }),
  loader: async ({ deps }) => {
    const place = deps.place || undefined;
    const query = deps.q || deps.place || "vidalia";
    let plan: WeekendPlan | null;
    try {
      plan = await loadWeekendPlan({ data: { place, query, radius: deps.radius } });
    } catch {
      return { plan: null as WeekendPlan | null };
    }
    if (plan === null) throw notFound();
    return { plan };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.plan?.place;
    const label = p ? `${p.city || p.name}${p.state ? `, ${p.state}` : ""}` : "your town";
    const title = `What's on in ${label} this weekend — Neighborly`;
    const desc = `Festivals, shows, park days, and neighbor gatherings in and around ${label} this weekend — with the weather and an add-to-calendar button.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(p?.slug && !isListedCommunity(p.slug) ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
    };
  },
  // A new town clears the old one right away and shows the loading state.
  pendingMs: 0,
  pendingMinMs: 250,
  pendingComponent: WeekendPending,
  component: WeekendPage,
});

function WeekendPending() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="page-shell space-y-8 py-12" aria-busy="true">
        <div className="h-10 w-3/4 max-w-xl animate-pulse rounded-lg bg-bg-subtle" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-[var(--radius-xl)] bg-bg-subtle" />
          ))}
        </div>
        <p className="text-base text-fg-muted">Finding what&apos;s on this weekend…</p>
      </main>
    </div>
  );
}

function WeatherStrip({ plan }: { plan: WeekendPlan }) {
  if (!plan.weather.length) return null;
  return (
    <section aria-label="Weather" className="space-y-3">
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {weekendWeatherDays(plan.weather).map((d) => {
          const Icon = d.rainChance >= 50 ? CloudRain : d.maxF >= 85 ? Sun : CloudSun;
          return (
            <div
              key={d.date}
              className="min-w-[132px] flex-1 snap-start rounded-[var(--radius-lg)] border border-border bg-bg-elevated px-4 py-3"
            >
              <p className="text-sm font-bold uppercase tracking-wide text-primary">
                {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
              </p>
              <p className="flex items-center gap-2 text-base text-fg">
                <Icon className="h-5 w-5 text-fg-muted" aria-hidden />
                <span className="font-semibold">{d.maxF}°</span>
                <span className="text-fg-muted">/ {d.minF}°</span>
              </p>
              <p className="text-base text-fg-muted">
                {d.summary}
                {d.rainChance >= 40 ? ` · ${d.rainChance}%` : ""}
              </p>
            </div>
          );
        })}
      </div>
      {plan.weatherNote && <p className="text-base text-fg-muted">{plan.weatherNote}</p>}
    </section>
  );
}

function ResultsSkeleton({ label }: { label: string | null }) {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4" data-testid="weekend-loading">
      <p className="text-base text-fg-muted">
        {label ? `Finding what's on near ${label}…` : "Finding what's on…"}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-[var(--radius-xl)] border border-border bg-bg-subtle" />
        ))}
      </div>
    </section>
  );
}

/**
 * A radius change reloads the weekend (the page shows a skeleton meanwhile),
 * so once it lands we bring the results back into view instead of leaving the
 * reader at the top. Module-level because the page can remount while loading.
 */
let scrollToResultsAfterLoad = false;

function scrollToResults() {
  if (typeof document === "undefined") return;
  // The results heading lands just below the sticky header (64px) with a little air.
  const el = document.querySelector("[data-testid=results-heading]") ?? document.getElementById("weekend-results");
  if (!el) return;
  const header = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
  const top = el.getBoundingClientRect().top + window.scrollY - header - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}

function WeekendPage() {
  const search = Route.useSearch();
  const loaded = Route.useLoaderData();
  const navigate = useNavigate({ from: "/weekend" });
  const { user } = useCurrentUserState();
  const [plan, setPlan] = useState<WeekendPlan | null>(loaded.plan);
  // A new search clears the old list right away: while the place lookup runs
  // (PlaceSearch) and while the router loads the new weekend, show a skeleton.
  const [searchingFor, setSearchingFor] = useState<string | null>(null);
  const routerLoading = useRouterState({
    select: (s) => s.isLoading && s.location.pathname === "/weekend",
  });
  const stale = searchingFor !== null || routerLoading;
  const mode: FeedMode = search.who ?? "all";

  useEffect(() => {
    setPlan(loaded.plan);
    // searchingFor is cleared by PlaceSearch when the *latest* search ends, so
    // an older search landing first never flashes its results.
  }, [loaded.plan]);

  useEffect(() => {
    if (stale || !scrollToResultsAfterLoad) return;
    scrollToResultsAfterLoad = false;
    requestAnimationFrame(scrollToResults);
  }, [stale, plan]);

  useEffect(() => {
    if (!search.place && !search.q) {
      const saved = readSavedPlace();
      const place = saved?.slug || loaded.plan?.place.slug || "vidalia";
      void navigate({ search: { place }, replace: true });
    }
  }, [search.place, search.q, loaded.plan?.place.slug, navigate]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const profile = await getMyProfile();
        if (!profile?.interests?.length && !profile?.setting_pref && !profile?.mobility) return;
        const next = await loadWeekendPlan({
          data: {
            place: search.place,
            query: search.q || search.place || "vidalia",
            interests: profile.interests?.join(","),
            setting: profile.setting_pref || undefined,
            mobility: profile.mobility || undefined,
            radius: search.radius,
          },
        });
        setPlan(next);
      } catch {
        /* keep the loader plan */
      }
    })();
  }, [search.place, search.q, search.radius, user]);

  const place = plan?.place;
  const town = place?.city || place?.name || "your town";
  const isVidalia = (place?.slug || "").startsWith("vidalia");
  const feed = plan?.feed ?? null;
  const radius = feed?.radiusMi ?? search.radius ?? DEFAULT_RADIUS_MI;
  const hasBoard = Boolean(place?.board);
  const hrefWith = (over: Partial<WeekendSearch>) => {
    const s = { ...search, ...over };
    const qs = new URLSearchParams();
    if (s.place) qs.set("place", s.place);
    if (s.q) qs.set("q", s.q);
    if (s.radius && s.radius !== DEFAULT_RADIUS_MI) qs.set("radius", String(s.radius));
    if (s.who) qs.set("who", s.who);
    if (s.cat) qs.set("cat", s.cat);
    const t = qs.toString();
    return t ? `/weekend?${t}` : "/weekend";
  };
  const widerRadius = RADII.find((r) => r > radius) ?? null;
  const widerHref = widerRadius ? hrefWith({ radius: widerRadius }) : undefined;

  const total = (feed?.events.length ?? 0) + (feed?.nearby.length ?? 0);
  // The count follows the active chip and "who's going": "2 festivals within 60 miles".
  const shownCount = feed ? filterByChip(filterMode(feed.events, mode), search.cat).length : 0;
  const heading = resultsHeading(shownCount, search.cat, radius);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="page-shell grid items-center gap-8 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-14">
            <div className="space-y-5">
              <span className="eyebrow">
                {!stale && place ? `${town}${place.state ? `, ${place.state}` : ""}` : "This weekend"}
                {feed ? ` · ${feed.window.label}` : ""}
              </span>
              <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-fg text-balance sm:text-5xl">
                {stale ? "Looking up this weekend…" : <>What&apos;s on in {town} this weekend</>}
              </h1>
              <p className="max-w-xl text-lg text-fg-muted">Pick one, add it to your calendar, and go say hello.</p>
              <PlaceSearch
                defaultValue={place?.zip || place?.city || ""}
                onSearchStart={(q) => setSearchingFor(q)}
                onSearchEnd={() => setSearchingFor(null)}
              />
            </div>
            <div
              className={cn(
                "relative min-h-[220px] overflow-hidden rounded-[var(--radius-xl)] sm:min-h-[300px]",
                stale ? "bg-bg-subtle" : isVidalia ? "bg-sky-soft" : "bg-primary-soft",
              )}
            >
              {stale ? (
                <div aria-hidden className="absolute inset-0 animate-pulse bg-bg-subtle" />
              ) : isVidalia ? (
                <img
                  src="/img/vidalia/fountain.jpg"
                  alt="The fountain in Vidalia's downtown park"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center p-8 text-center">
                  <p className="font-display text-3xl font-semibold text-primary">{town}</p>
                </div>
              )}
              {!stale && feed && total > 0 && (
                <div className="absolute bottom-4 left-4 rounded-[var(--radius-md)] bg-bg-elevated/95 px-4 py-2 text-base font-semibold text-fg shadow-md">
                  {shownCount > 0 || search.cat || mode !== "all"
                    ? heading
                    : `${feed.nearby.length > 1 ? `${feed.nearby.length} things` : "One thing"} a short drive away`}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="page-shell space-y-10 py-10">
          {!stale && plan && <WeatherStrip plan={plan} />}

          <div id="weekend-results" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ModeChips
              mode={mode}
              onMode={(m) => void navigate({ search: (s) => ({ ...s, who: m === "all" ? undefined : m }), replace: true, resetScroll: false })}
            />
            <RadiusChips
              radius={radius}
              choices={RADII}
              hrefFor={(r) => hrefWith({ radius: r })}
              onPick={(r) => {
                if (r === radius) return;
                scrollToResultsAfterLoad = true;
                void navigate({ search: (s) => ({ ...s, radius: r === DEFAULT_RADIUS_MI ? undefined : r }), resetScroll: false });
              }}
            />
          </div>
          {!stale && feed && (
            <CategoryChips
              chip={search.cat}
              events={filterMode(feed.events, mode)}
              hrefFor={(c) => hrefWith({ cat: c })}
              onPick={(c) => void navigate({ search: (s) => ({ ...s, cat: c }), replace: true, resetScroll: false })}
            />
          )}

          {!stale && feed && shownCount > 0 && (
            <h2 className="font-display text-2xl font-semibold text-fg" aria-live="polite" data-testid="results-heading">
              {heading}
            </h2>
          )}

          {stale ? (
            <ResultsSkeleton label={searchingFor} />
          ) : plan ? (
            <WeekendFeed
              feed={feed}
              town={town}
              slug={hasBoard ? place?.slug : undefined}
              zip={place?.zip}
              city={place?.city}
              state={place?.state}
              mode={mode}
              widerHref={widerHref}
              chip={search.cat}
              clearChipHref={hrefWith({ cat: undefined })}
            />
          ) : (
            <div className="surface-card space-y-3 p-8">
              <h2 className="font-display text-2xl font-semibold">We couldn&apos;t load this weekend</h2>
              <p className="text-base text-fg-muted">Please try again in a moment, or search another town.</p>
            </div>
          )}

          <section className={cn("grid gap-4 md:grid-cols-3", stale && "hidden")}>
            <div className="rounded-[var(--radius-xl)] bg-primary-soft p-6">
              <h2 className="font-display text-xl font-semibold text-fg">Meet people</h2>
              <ul className="mt-3 space-y-1 text-base">
                {hasBoard && place?.slug && (
                  <li>
                    <Link className="tap underline" to="/c/$slug" params={{ slug: place.slug }}>
                      The {place.name} board
                    </Link>
                  </li>
                )}
                {isVidalia && (
                  <>
                    <li>
                      <Link className="tap underline" to="/c/$slug" params={{ slug: "vidalia-dads" }}>
                        Vidalia dads
                      </Link>
                    </li>
                    <li>
                      <Link className="tap underline" to="/c/$slug" params={{ slug: "vidalia-pickleball" }}>
                        Pickleball
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link
                    className="tap underline"
                    to="/churches"
                    search={{ zip: place?.zip || undefined, city: place?.city || undefined, state: place?.state || undefined } as never}
                  >
                    Churches near {town}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="rounded-[var(--radius-xl)] bg-accent-soft p-6">
              <h2 className="font-display text-xl font-semibold text-fg">Host something</h2>
              <p className="mt-2 text-base text-fg-muted">
                A porch coffee, a walk, a game night. Post it and neighbors nearby will see it here.
              </p>
              {hasBoard && place?.slug ? (
                <Link
                  to="/c/$slug"
                  params={{ slug: place.slug }}
                  search={{ tab: "events", host: "1" } as never}
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-base font-semibold text-primary-fg no-underline"
                >
                  Post a gathering
                </Link>
              ) : (
                <Link
                  to="/near"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-base font-semibold text-primary-fg no-underline"
                >
                  Start your town
                </Link>
              )}
            </div>
            <div className="rounded-[var(--radius-xl)] bg-sky-soft p-6">
              <h2 className="font-display text-xl font-semibold text-fg">Where listings come from</h2>
              <p className="mt-2 text-base text-fg-muted">
                Local calendars, parks, theaters, and your neighbors. Confirm before you go.
              </p>
              <ul className="mt-2 space-y-1 text-base">
                {(feed?.sources ?? [])
                  .filter((s) => s.count > 0 && s.url)
                  .slice(0, 6)
                  .map((s) => (
                    <li key={s.id}>
                      <a className="tap underline" href={s.url} target="_blank" rel="noreferrer">
                        {s.name}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter credits={isVidalia} />
      {feed && feed.events.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `What's on in ${town} this weekend`,
            itemListElement: feed.events.slice(0, 20).map((e, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Event",
                name: e.title,
                startDate: new Date(e.startMs).toISOString(),
                ...(e.endMs ? { endDate: new Date(e.endMs).toISOString() } : {}),
                location: { "@type": "Place", name: e.venue, address: e.city || town },
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                ...(e.url.startsWith("http") ? { url: e.url } : {}),
              },
            })),
          }}
        />
      )}
    </div>
  );
}
