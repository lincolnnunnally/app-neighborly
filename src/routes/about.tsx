import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Neighborly" },
      {
        name: "description",
        content: "Neighborly helps neighbors find what's on, lend a hand, and ask for one — starting in Vidalia, Georgia.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="page-shell max-w-3xl space-y-10 py-10 sm:py-14">
        <header className="space-y-3">
          <span className="eyebrow">About</span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-fg">Neighbors, closer together</h1>
          <p className="text-lg leading-relaxed text-fg-muted">
            Neighborly is a free community board for your town. See what's on this weekend, meet people nearby, and
            make it easy to ask for a hand — or offer one.
          </p>
        </header>

        <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-border">
          <img
            src="/img/vidalia/fountain.jpg"
            alt="The fountain in Vidalia's downtown park"
            className="aspect-[16/9] w-full object-cover"
          />
          <figcaption className="bg-bg-elevated px-4 py-2 text-sm text-fg-muted">
            Downtown Vidalia, Georgia, where Neighborly started. Photo by Michael Rivera (CC BY-SA 4.0), via Wikimedia
            Commons.
          </figcaption>
        </figure>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { h: "Find what's on", p: "Festivals, shows, park days and neighbor gatherings, with the weekend weather." },
            { h: "Lend a hand", p: "A ride, a meal, a borrowed ladder. Small help adds up fast in a small town." },
            { h: "Ask without worry", p: "Everyone here is a real neighbor with a profile, and reports reach a real person." },
          ].map((c) => (
            <div key={c.h} className="surface-card space-y-2 p-5">
              <h2 className="font-display text-xl font-semibold text-fg">{c.h}</h2>
              <p className="text-base text-fg-muted">{c.p}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-fg">Who we are</h2>
          <p className="text-base leading-relaxed text-fg-muted">
            Neighborly is made by United Under God, Inc., a Georgia company that builds free tools to help people look
            after one another. We don't sell your information, and we never sign you up for anything without asking.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/weekend">See what's on this weekend</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/help">Get help</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
