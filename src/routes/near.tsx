import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { PlaceSearch } from "@/components/community/place-search";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/near")({
  head: () => ({
    meta: [
      { title: "What's going on near me — Neighborly" },
      {
        name: "description",
        content:
          "Type a ZIP or city to see festivals, shows, park days, and neighbor gatherings near you this weekend.",
      },
    ],
  }),
  component: NearPage,
});

function NearPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-8 py-12">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Any town in Georgia and beyond</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Find your town</h1>
          <p className="text-lg text-fg-muted">
            Type a ZIP or City, ST to see festivals, shows, park days, and neighbor gatherings
            happening this weekend.
          </p>
        </div>
        <PlaceSearch size="lg" />
        <Card>
          <CardHeader>
            <CardTitle>What you&apos;ll find</CardTitle>
            <CardDescription>Everything here comes from local calendars and your neighbors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-base text-fg-muted">
            <p>This weekend&apos;s events near you, with the weather and an add-to-calendar button.</p>
            <p>A neighbor board to ask for a hand, offer a skill, or host a gathering. Posting is free.</p>
            <p>
              <Link to="/weekend" search={{ place: "vidalia" }} className="underline">
                See Vidalia this weekend
              </Link>
              {" · "}
              <Link to="/churches" search={{ zip: "30474" }} className="underline">
                Churches near a ZIP
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
