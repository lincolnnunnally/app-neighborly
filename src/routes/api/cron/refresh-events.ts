import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/cron/refresh-events — the daily weekend-feed refresh (vercel.json crons).
 *
 * With CRON_SECRET set, Vercel sends it as a Bearer token and nothing else gets in.
 * Without it, only Vercel's cron agent may call, and never more than once every
 * 6 hours — the job only re-reads public calendars, so the worst a stranger
 * could do is make it run on schedule.
 */
const MIN_GAP_MS = 6 * 3600 * 1000;

export const Route = createFileRoute("/api/cron/refresh-events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET?.trim();
        const auth = request.headers.get("authorization") || "";
        if (secret) {
          if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        } else {
          if (!/^vercel-cron\//i.test(request.headers.get("user-agent") || "")) {
            return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
          }
          const { readSourceStates } = await import("@/lib/events/store");
          const states = [...(await readSourceStates()).values()];
          const last = Math.max(0, ...states.map((s) => s.lastAttemptMs ?? 0));
          if (Date.now() - last < MIN_GAP_MS) return Response.json({ ok: true, skipped: "refreshed recently" });
        }
        const { refreshAllSources } = await import("@/lib/events/sources");
        const results = await refreshAllSources();
        return Response.json({
          ok: true,
          sources: results.length,
          failed: results.filter((r) => !r.ok).map((r) => ({ id: r.id, error: r.error })),
          events: results.reduce((n, r) => n + r.count, 0),
        });
      },
    },
  },
});
