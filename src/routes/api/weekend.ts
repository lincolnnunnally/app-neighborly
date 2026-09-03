import { createFileRoute } from "@tanstack/react-router";
import { buildWeekendPlan } from "@/lib/community/weekend";
import type { FitPrefs } from "@/lib/community/fit";

export const Route = createFileRoute("/api/weekend")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const place = url.searchParams.get("place") || url.searchParams.get("q") || undefined;
          const interests = (url.searchParams.get("interests") || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const setting_pref = url.searchParams.get("setting") || "";
          const mobility = url.searchParams.get("mobility") || "";
          const prefs: FitPrefs | null =
            interests.length || setting_pref || mobility
              ? { interests, setting_pref, mobility }
              : null;
          const plan = await buildWeekendPlan({ slug: place, query: place, prefs });
          return Response.json({ ok: true, plan });
        } catch (error) {
          const message = error instanceof Error ? error.message : "weekend plan failed";
          return Response.json({ ok: false, error: message }, { status: 503 });
        }
      },
    },
  },
});
