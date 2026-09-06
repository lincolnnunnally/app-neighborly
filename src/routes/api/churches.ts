import { createFileRoute } from "@tanstack/react-router";
import { searchPublicChurches } from "@/lib/community/churches";

export const Route = createFileRoute("/api/churches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const lat = url.searchParams.get("lat");
          const lon = url.searchParams.get("lon") || url.searchParams.get("lng");
          const result = await searchPublicChurches({
            q: url.searchParams.get("q") || undefined,
            zip: url.searchParams.get("zip") || url.searchParams.get("zip_code") || undefined,
            city: url.searchParams.get("city") || undefined,
            state: url.searchParams.get("state") || undefined,
            denomination: url.searchParams.get("denomination") || undefined,
            worship_style: url.searchParams.get("worship_style") || undefined,
            today: url.searchParams.get("today") === "1",
            morning: url.searchParams.get("morning") === "1",
            lat: lat ? Number(lat) : undefined,
            lon: lon ? Number(lon) : undefined,
          });
          return Response.json({
            ok: true,
            ...result,
            copied: false,
            note:
              result.note +
              " Neighborly does not keep a second church database — these are ChurchConnect records.",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Church lookup failed";
          return Response.json({ ok: false, error: message, churches: [] }, { status: 503 });
        }
      },
    },
  },
});
