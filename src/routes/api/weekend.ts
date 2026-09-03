import { createFileRoute } from "@tanstack/react-router";
import { buildWeekendPlan } from "@/lib/community/weekend";

export const Route = createFileRoute("/api/weekend")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const plan = await buildWeekendPlan();
          return Response.json({ ok: true, plan });
        } catch (error) {
          const message = error instanceof Error ? error.message : "weekend plan failed";
          return Response.json({ ok: false, error: message }, { status: 503 });
        }
      },
    },
  },
});
