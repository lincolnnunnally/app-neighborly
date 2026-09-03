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
          "Type a ZIP or city to see public gatherings on Neighborly. We cache a town for a day. We will not invent events or neighbors.",
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
          <p className="text-sm font-medium text-primary">Any town, starting with Vidalia</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            What&apos;s going on around you?
          </h1>
          <p className="text-lg text-fg-muted">
            Type a ZIP or City, ST. If we already have that town, you get the cached board.
            If you are the first person to ask, we open an honest empty board and save it so
            the next neighbor is not starting from zero.
          </p>
        </div>
        <PlaceSearch size="lg" />
        <Card>
          <CardHeader>
            <CardTitle>Cost, refresh, and what we will not do</CardTitle>
            <CardDescription>No ads on this page. No invented festivals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-fg-muted">
            <p>
              City and ZIP lookup uses a free public postal index. Weather uses Open-Meteo.
              We do <strong className="text-fg">not</strong> run a paid AI crawl on every
              page view — that is how this stays affordable.
            </p>
            <p>
              Listings refresh <strong className="text-fg">at most once per day per town</strong>,
              and only when someone actually asks. Vidalia has curated public calendars (Pal,
              Visit Vidalia, Parks, First Baptist). A new ZIP starts empty until a real person
              or organizer adds a public listing.
            </p>
            <p>
              A weekly fit email (indoor vs outdoor, seated vs hiking, knitting vs pickleball)
              is the Pro shape — a few dollars a month —{" "}
              <strong className="text-fg">when we can actually send it</strong>. We will not
              take money first. Ads on a belonging board would fight the product; we are not
              turning those on.
            </p>
            <p>
              <Link to="/weekend" search={{ place: "vidalia" }} className="underline">
                See Vidalia this weekend
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
