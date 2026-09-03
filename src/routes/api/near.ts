import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { ensureSeeded } from "@/lib/community/seed";
import { findOrCreatePlace } from "@/lib/community/place";

export const Route = createFileRoute("/api/near")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const q = (url.searchParams.get("q") || "").trim();
          if (!q) {
            return Response.json(
              { ok: false, error: "Type a 5-digit ZIP or “City, ST”." },
              { status: 400 },
            );
          }
          const sql = await getSql();
          await ensureSeeded(sql);
          const looked = await findOrCreatePlace(sql, q);
          return Response.json({
            ok: true,
            created: looked.created,
            refresh: looked.refresh,
            community: {
              slug: looked.community.slug,
              name: looked.community.name,
              city: looked.community.city,
              state: looked.community.state,
              zip: looked.community.zip,
              tagline: looked.community.tagline,
            },
            weekendPath: `/weekend?place=${encodeURIComponent(looked.community.slug)}`,
            boardPath: `/c/${looked.community.slug}`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not find that place";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
