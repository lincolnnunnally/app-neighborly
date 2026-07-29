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
          </p>
        </div>

        {[
          {
            title: "1. Sign up the practical way",
            body: "Visit the site and choose communities, open a link from a text/email/Facebook/YouTube post, or scan a QR code on a mailbox flyer. One account can belong to many communities.",
          },
          {
            title: "2. Build a useful profile",
            body: "Name, approximate area, skills, and whether you're new or a youth offering services. Set what you want notifications about — events, matching needs, services, facilities.",
          },
          {
            title: "3. Ask, offer, or gather",
            body: "Post needs (lightbulbs to home projects). Register services and local businesses. Host block parties, cleanups, and BBQs. Request the pavilion for a birthday.",
          },
          {
            title: "4. Match helpers to needs",
            body: "Neighbors who can help see open requests. Offering help marks a need as matched so nothing falls through the cracks.",
          },
          {
            title: "5. Welcome people in",
            body: "New residents get a lighter onboarding path: meet neighbors, learn about the area, and find their first event.",
          },
        ].map((s) => (
          <Card key={s.title} className="p-6">
            <h2 className="font-display text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-fg-muted">{s.body}</p>
          </Card>
        ))}

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup" search={{ community: "milstead", code: "MILSTEAD-WELCOME" }}>
              Join Milstead
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/c/$slug" params={{ slug: "milstead" }}>
              Browse without signing up
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
