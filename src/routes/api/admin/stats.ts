import { createFileRoute } from "@tanstack/react-router";
import { loadNeighborlyCounts } from "@/lib/admin-stats";

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/admin/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = (process.env.APP_ENGINE_STATS_TOKEN || "").trim();
        const header = request.headers.get("authorization") || "";
        const bearer = header.toLowerCase().startsWith("bearer ")
          ? header.slice(7).trim()
          : "";
        if (!expected || !bearer || bearer !== expected) return unauthorized();

        const counts = await loadNeighborlyCounts();
        return Response.json({
          ok: true,
          app: "neighborly",
          ...counts,
        });
      },
    },
  },
});
