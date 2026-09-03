import { createFileRoute } from "@tanstack/react-router";

const BODY = `User-agent: *
Allow: /
Disallow: /app
Disallow: /admin
Disallow: /api/
Allow: /api/weekend
Allow: /api/near

Sitemap: https://neighborly.unitedundergod.org/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
