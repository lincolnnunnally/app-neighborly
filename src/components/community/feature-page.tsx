import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentPlace } from "@/lib/community/current-place";
import { FEATURES, type Feature } from "@/lib/features";

/**
 * A public page for one thing neighbors can do. The action itself lives on a
 * town board (and in the signed-in app); this page explains it and sends
 * people to their own town's board, or to the town finder when theirs has none.
 */
export function FeaturePage({ feature }: { feature: Feature }) {
  const place = useCurrentPlace();
  const related = FEATURES.filter((f) => f.path !== feature.path);

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <div className="page-shell max-w-3xl space-y-8 py-12">
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {feature.h1}
          </h1>
          <p className="text-lg leading-relaxed text-fg-muted">{feature.intro}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            {place.board ? (
              <Button asChild>
                <Link
                  to="/c/$slug"
                  params={{ slug: place.board }}
                  search={
                    { tab: feature.tab, ...(feature.cat ? { cat: feature.cat } : {}) } as never
                  }
                >
                  {feature.cta} in {place.city}
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/near">Find your town&apos;s board</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/how-it-works">How Neighborly works</Link>
            </Button>
          </div>
        </header>

        {feature.sections.map((s) => (
          <section key={s.h2} className="space-y-2">
            <h2 className="font-display text-2xl font-semibold">{s.h2}</h2>
            {s.body.map((p) => (
              <p key={p} className="leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Questions</h2>
          {feature.faqs.map((f) => (
            <Card key={f.q} className="p-5">
              <h3 className="font-semibold text-fg">{f.q}</h3>
              <p className="mt-1.5 text-fg-muted">{f.a}</p>
            </Card>
          ))}
        </section>

        <nav aria-label="More ways to use Neighborly" className="space-y-2">
          <h2 className="font-display text-xl font-semibold">More ways to use Neighborly</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {related.map((f) => (
              <li key={f.path}>
                <a href={f.path} className="text-primary">
                  {f.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <SiteFooter />
    </div>
  );
}
