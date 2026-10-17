import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { useCurrentPlace } from "@/lib/community/current-place";

export function NotFoundPage({ title = "We couldn't find that page", line }: { title?: string; line?: string }) {
  const place = useCurrentPlace();
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="page-shell py-16 sm:py-24">
        <div className="surface-card mx-auto max-w-xl space-y-5 p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-[var(--radius-lg)] bg-accent-soft text-accent">
            <Compass className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="font-display text-3xl font-semibold text-fg sm:text-4xl">{title}</h1>
          <p className="text-lg text-fg-muted">
            {line || "The link may be old. Here's what's on this weekend instead."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/weekend" search={place.board ? { place: place.board } : { q: place.zip || place.city }}>
                This weekend in {place.city}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/search">Search Neighborly</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
