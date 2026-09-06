import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { ensureSeeded } from "@/lib/community/seed";
import { findOrCreatePlace, lookupPlace } from "@/lib/community/place";

function payload(looked: Awaited<ReturnType<typeof lookupPlace>>) {
  return {
    ok: Boolean(looked.community || looked.geo),
    found: Boolean(looked.community),
    created: looked.created,
    wouldCreate: looked.wouldCreate,
    refresh: looked.refresh,
    geo: looked.geo,
    community: looked.community
      ? {
          slug: looked.community.slug,
          name: looked.community.name,
          city: looked.community.city,
          state: looked.community.state,
          zip: looked.community.zip,
          tagline: looked.community.tagline,
        }
      : null,
    weekendPath: looked.community
      ? `/weekend?place=${encodeURIComponent(looked.community.slug)}`
      : looked.geo
        ? `/weekend?q=${encodeURIComponent(`${looked.geo.city}, ${looked.geo.state}`)}`
        : null,
    boardPath: looked.community ? `/c/${looked.community.slug}` : null,
    churchesPath: looked.geo?.zip
      ? `/churches?zip=${encodeURIComponent(looked.geo.zip)}`
      : looked.community?.zip
        ? `/churches?zip=${encodeURIComponent(looked.community.zip)}`
        : "/churches",
  };
}

export const Route = createFileRoute("/api/near")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const q = (url.searchParams.get("q") || "").trim();
          const create = url.searchParams.get("create") === "1";
          const latRaw = url.searchParams.get("lat");
          const lonRaw = url.searchParams.get("lon");
          const lat = latRaw ? Number(latRaw) : undefined;
          const lon = lonRaw ? Number(lonRaw) : undefined;
          const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);

          if (!q && !hasGeo) {
            return Response.json(
              { ok: false, error: "Type a 5-digit ZIP or “City, ST”, or allow location." },
              { status: 400 },
            );
          }

          const sql = await getSql();
          await ensureSeeded(sql);
          const coords = hasGeo ? { lat: lat as number, lon: lon as number } : undefined;
          const looked = create
            ? await findOrCreatePlace(sql, q || "", { create: true, ...coords })
            : await lookupPlace(sql, q, coords);

          if (!looked.community && !looked.geo) {
            return Response.json(
              {
                ok: false,
                found: false,
                wouldCreate: false,
                error: looked.refresh.note,
              },
              { status: 400 },
            );
          }

          return Response.json(payload(looked));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not find that place";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
