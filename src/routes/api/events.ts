import { createFileRoute } from "@tanstack/react-router";
import { buildWeekendPlan } from "@/lib/community/weekend";

/**
 * GET /api/events?q=30474&radius=25
 * Public weekend events (Fri 5pm – Sun, Eastern) near a ZIP, town, or board slug.
 */
export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || url.searchParams.get("zip") || url.searchParams.get("place") || "vidalia").slice(0, 80);
        const radius = Number(url.searchParams.get("radius") || "") || undefined;
        try {
          const plan = await buildWeekendPlan({ slug: q, query: q, radiusMi: radius });
          const feed = plan.feed;
          return Response.json(
            {
              ok: true,
              place: plan.place,
              window: feed?.window ?? null,
              radiusMi: feed?.radiusMi ?? null,
              wideRadiusMi: feed?.wideRadiusMi ?? null,
              counts: {
                thisWeekend: feed?.events.length ?? 0,
                nearby: feed?.nearby.length ?? 0,
                nextWeekend: feed?.nextWeekend.length ?? 0,
              },
              events: feed?.events ?? [],
              nearby: feed?.nearby ?? [],
              nextWeekend: feed?.nextWeekend ?? [],
              sources: (feed?.sources ?? []).map((s) => ({ name: s.name, url: s.url, status: s.status, count: s.count })),
              generatedAt: feed?.generatedAt ?? new Date().toISOString(),
            },
            { headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600" } },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "events failed";
          return Response.json({ ok: false, error: message }, { status: 503 });
        }
      },
    },
  },
});
