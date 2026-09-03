import { Link, createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <div className="page-shell max-w-3xl space-y-8 py-12">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            How Neighborly works
          </h1>
          <p className="mt-2 text-fg-muted">
            Designed for people who live in a place — not for abstract social feeds.
            If you just moved, start with this weekend. Account comes later.
          </p>
        </div>

        {[
          {
            title: "1. See this weekend first",
            body: "Weather, the Pal Theatre, parks, pickleball, and church listings — no account required. Add a slot to your calendar with a .ics file. Confirm on their sites before you go.",
          },
          {
            title: "2. Sign up the practical way",
            body: "Visit the site and choose communities, open a link from a text/email/Facebook/YouTube post, or scan a QR code on a mailbox flyer. One account can belong to many communities. We do not mint a fake neighbor for you.",
          },
          {
            title: "3. Build a useful profile",
            body: "Name, approximate area, skills, and whether you're new or a youth offering services. Set what you want notifications about — events, matching needs, services, facilities.",
          },
          {
            title: "4. Ask, offer, or gather",
            body: "Post needs (lightbulbs to home projects). Register services and local businesses. Host block parties, cleanups, and BBQs. Request the pavilion for a birthday.",
          },
          {
            title: "5. Match helpers to needs",
            body: "Neighbors who can help see open requests. Offering help marks a need as matched so nothing falls through the cracks.",
          },
          {
            title: "6. Welcome people in",
            body: "New residents get a lighter onboarding path: meet neighbors, learn about the area, and find their first event.",
          },
          {
            title: "7. The board is a doorway",
            body: "The win is not more time on Neighborly. It is coffee, a meal, letting someone help you, or staying in the spare room instead of hiding. Receiving kindness is part of belonging. We will not score your courage. If a kind person is offering hospitality, one next yes is enough. Safety stays: public places, Report and Block, 988 in a crisis.",
          },
        ].map((s) => (
          <Card key={s.title} className="p-6">
            <h2 className="font-display text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-fg-muted">{s.body}</p>
          </Card>
        ))}

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/weekend">This weekend</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/c/$slug" params={{ slug: "vidalia" }}>
              Browse Vidalia without signing up
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/signup" search={{ community: "vidalia", code: "VIDALIA-WELCOME" }}>
              Join Vidalia
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
