import { createFileRoute } from "@tanstack/react-router";
import { dbSource, getSql } from "@/lib/db";
import { ensureSeeded } from "@/lib/community/seed";
import { resetEmailConfigured } from "@/lib/mail";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          await ensureSeeded(sql);
          const communities = await sql<{ c: number }>`
            select count(*)::int as c from communities
          `;
          const needs = await sql<{ c: number }>`
            select count(*)::int as c from needs where status = 'open'
          `;
          let openReports = 0;
          try {
            const reports = await sql<{ c: number }>`
              select count(*)::int as c from safety_reports where status = 'open'
            `;
            openReports = Number(reports[0]?.c || 0);
          } catch {
            openReports = 0;
          }
          return Response.json({
            ok: true,
            app: "Neighborly",
            database: dbSource,
            communities: Number(communities[0]?.c || 0),
            openNeeds: Number(needs[0]?.c || 0),
            openSafetyReports: openReports,
            passwordResetEmail: resetEmailConfigured() ? "configured" : "ops_desk_fallback",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Response.json(
            {
              ok: false,
              app: "Neighborly",
              database: dbSource,
              error: message.slice(0, 240),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
