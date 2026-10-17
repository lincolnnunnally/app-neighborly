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
            New in town? Start with this weekend. You can join whenever you&apos;re ready.
          </p>
        </div>

        <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-border">
          <img src="/img/vidalia/amphitheater.jpg" alt="The downtown park amphitheater in Vidalia" className="aspect-[16/9] w-full object-cover" />
          <figcaption className="bg-bg-elevated px-4 py-2 text-sm text-fg-muted">Vidalia's downtown park amphitheater. Photo by Michael Rivera (CC BY-SA 4.0), via Wikimedia Commons.</figcaption>
        </figure>

        {[
          {
            title: "1. See this weekend first",
            body: "Type a ZIP or City, ST, save a home place, or optionally share browser location. See festivals, shows, park days, and neighbor gatherings, with the weather. Confirm details on the organizer’s site before you go.",
          },
          {
            title: "2. Sign up the practical way",
            body: "Visit the site and choose communities, open a link from a text/email/Facebook/YouTube post, or scan a QR code on a mailbox flyer. One account can belong to many communities.",
          },
          {
            title: "3. Build a useful profile",
            body: "Name, approximate area, skills, and whether you're new or a youth offering services. Set what you want notifications about — events, matching needs, services, facilities.",
          },
          {
            title: "4. Ask, offer, or gather",
            body: "Post needs (lightbulbs to home projects). Register a service — including maker and artisan work. List a physical tool neighbors can borrow for a few days. Neighbors message you through Neighborly. Host block parties, cleanups, and BBQs. Request the pavilion for a birthday. Add or claim a food pantry listing on Places.",
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
            title: "7. Fit, not a firehose",
            body: "Tell us if you want a chair at the library, pickleball, or canoeing. We sort closer-to-you first and still list the rest of the town. If neighbors mark crochet, a church or library can see that interest and host a class. Posting “who’s interested?” is free.",
          },
          {
            title: "8. The board is a doorway",
            body: "The win is not more time on Neighborly. It is coffee, a meal, letting someone help you, or staying in the spare room instead of hiding. Receiving kindness is part of belonging. One next yes is enough. Safety stays: public places, Report and Block, 988 in a crisis.",
          },
        ].map((s) => (
          <Card key={s.title} className="p-6">
            <h2 className="font-display text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-fg-muted">{s.body}</p>
          </Card>
        ))}

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/weekend" search={{ place: "vidalia" }}>This weekend</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/near">Find a town</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/churches" search={{ zip: "30474" }}>
              Churches
            </Link>
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
