import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { PagePending } from "@/components/layout/page-pending";
import { PlaceSearch } from "@/components/community/place-search";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { townPhoto } from "@/components/community/cover";
import { useCurrentPlace } from "@/lib/community/current-place";
import { loadWeekendPlan, type WeekendPlan } from "@/lib/community/weekend";
import { canonicalLinks, SITE_URL } from "@/lib/seo";

type NearSearch = { place?: string; q?: string };

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v).padStart(5, "0");
  return undefined;
}

export const Route = createFileRoute("/near")({
  // /near?zip=30014 (or ?place=) is about that town; plain /near uses the saved town.
  validateSearch: (s: Record<string, unknown>): NearSearch => ({ place: str(s.place), q: str(s.q) ?? str(s.zip) }),
  loaderDeps: ({ search }) => ({ place: search.place, q: search.q }),
  loader: async ({ deps }) => {
    if (!deps.place && !deps.q) return { plan: null as WeekendPlan | null };
    const plan = await loadWeekendPlan({
      data: { place: deps.place, query: deps.q || deps.place, remember: true },
    }).catch(() => null as WeekendPlan | null);
    return { plan };
  },
  head: () => ({
    links: canonicalLinks("/near"),
    meta: [
      { property: "og:url", content: `${SITE_URL}/near` },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "What's going on near me — Neighborly" },
      {
        name: "description",
        content:
          "Type a ZIP or city to see festivals, shows, park days, and neighbor gatherings near you this weekend.",
      },
    ],
  }),
  // Looking up the town takes a moment: show the loading state right away rather
  // than leaving the previous page (often home) under the /near URL.
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: PagePending,
  component: NearPage,
});

function NearPage() {
  const place = useCurrentPlace();
  const town = place.isVidalia ? null : place;
  const photo = town?.board ? townPhoto(town.board) : null;
  const weekendSearch = town ? (town.board ? { place: town.board } : { q: town.zip || town.city }) : { place: "vidalia" };
  const churchSearch = town ? (town.zip ? { zip: town.zip } : { city: town.city, state: town.state }) : { zip: "30474" };
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-8 py-12">
        {town ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {[town.city, town.state].filter(Boolean).join(", ")}
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              {town.board ? `The ${town.city} board` : `Start the ${town.city} board`}
            </h1>
            <p className="text-lg text-fg-muted">
              {town.board
                ? `Neighbors in ${town.city} already ask for a hand, offer one, and post gatherings here.`
                : `${town.city} doesn't have a Neighborly board yet. Start one so neighbors nearby can share what's on and lend a hand. Or type another ZIP or town.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Any town in Georgia and beyond</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">Find your town</h1>
            <p className="text-lg text-fg-muted">
              Type a ZIP or City, ST to see festivals, shows, park days, and neighbor gatherings
              happening this weekend.
            </p>
          </div>
        )}
        {town?.board && (
          <Link
            to="/c/$slug"
            params={{ slug: town.board }}
            className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-base font-semibold text-primary-fg no-underline"
          >
            Open the {town.city} board
          </Link>
        )}
        <PlaceSearch
          size="lg"
          defaultValue={town ? town.zip || town.city : ""}
          startFor={town && !town.board ? { city: town.city, state: town.state, zip: town.zip } : null}
        />
        {!town ? (
          <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-border">
            <img src="/img/vidalia/cityhall.jpg" alt="The Vidalia Municipal Building downtown" className="aspect-[16/9] w-full object-cover" />
            <figcaption className="bg-bg-elevated px-4 py-2 text-sm text-fg-muted">Downtown Vidalia. Photo by Michael Rivera (CC BY-SA 4.0), via Wikimedia Commons.</figcaption>
          </figure>
        ) : photo ? (
          <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-border">
            <img src={photo.src} alt={photo.alt} className="aspect-[16/9] w-full object-cover" />
            {photo.credit && <figcaption className="bg-bg-elevated px-4 py-2 text-sm text-fg-muted">{photo.credit}</figcaption>}
          </figure>
        ) : (
          // No photo of this town: a plain name block, never another town's picture.
          <div className="grid aspect-[16/9] place-items-center rounded-[var(--radius-xl)] border border-border bg-primary-soft">
            <p className="font-display text-4xl font-semibold text-primary">{town.city}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>What you&apos;ll find</CardTitle>
            <CardDescription>Everything here comes from local calendars and your neighbors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-base text-fg-muted">
            <p>This weekend&apos;s events near you, with the weather and an add-to-calendar button.</p>
            <p>A neighbor board to ask for a hand, offer a skill, or host a gathering. Posting is free.</p>
            <p>
              <Link to="/weekend" search={weekendSearch} className="underline">
                See {town ? town.city : "Vidalia"} this weekend
              </Link>
              {" · "}
              <Link to="/churches" search={churchSearch as never} className="underline">
                {town ? `Churches near ${town.city}` : "Churches near a ZIP"}
              </Link>
              {" · "}
              <Link to="/how-it-works" className="underline">
                How it works
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
