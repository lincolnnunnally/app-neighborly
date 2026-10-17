import { SiteHeader } from "@/components/layout/site-header";

/**
 * Loading state for a page whose data is on its way: the header plus a neutral
 * skeleton, so the previous page never sits under the new URL.
 */
export function PagePending() {
  return (
    <div className="min-h-dvh bg-bg" data-testid="page-pending">
      <SiteHeader solid />
      <main className="page-shell max-w-2xl space-y-6 py-12" aria-busy="true" aria-live="polite">
        <div className="h-4 w-32 animate-pulse rounded bg-bg-subtle" />
        <div className="h-10 w-3/4 animate-pulse rounded-lg bg-bg-subtle" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-bg-subtle" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-bg-subtle" />
        </div>
        <div className="h-14 w-full animate-pulse rounded-full bg-bg-subtle" />
        <p className="text-base text-fg-muted">Loading…</p>
      </main>
    </div>
  );
}
