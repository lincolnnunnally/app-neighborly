import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { ensureSeeded } from "@/lib/community/seed";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = "https://neighborly.unitedundergod.org";
        const staticPaths = ["/", "/weekend", "/communities", "/how-it-works", "/near", "/privacy", "/terms"];
        let communityPaths: string[] = ["/c/vidalia", "/c/milstead"];
        try {
          const sql = await getSql();
          await ensureSeeded(sql);
          const rows = await sql<{ slug: string }>`
            select slug from communities where kind = 'neighborhood' or is_featured = true order by slug
          `;
          communityPaths = rows.map((r) => `/c/${r.slug}`);
        } catch {
          /* still emit the core URLs */
        }
        const urls = [...staticPaths, ...communityPaths, ...communityPaths.map((p) => `/weekend?place=${p.slice(3)}`)];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `  <url>
    <loc>${origin}${path.startsWith("/weekend?") ? path : path}</loc>
    <changefreq>daily</changefreq>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
