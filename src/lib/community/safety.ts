import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { uid } from "@/lib/utils";
import { isOwnerEmail } from "@/lib/admin-stats";

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or a scam" },
  { value: "hate_or_violence", label: "Hate or threats of violence" },
  { value: "sexual_or_inappropriate", label: "Sexual or inappropriate content" },
  { value: "danger_or_self_harm", label: "Someone may be in danger" },
  { value: "false_content", label: "Invented people, needs, or events" },
  { value: "other", label: "Something else" },
] as const;

export type SafetyContentType = "person" | "need" | "event" | "service";

export type SafetyReport = {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string | null;
  reported_user_id: string | null;
  content_excerpt: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
};

export type UserBlock = {
  blocked_id: string;
  display_name: string;
  created_at: string;
};

async function sqlReady() {
  return getSql();
}

export async function blockedUserIds(userId: string | undefined | null): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const sql = await sqlReady();
    const rows = await sql<{ other_id: string }>`
      select blocked_id as other_id from user_blocks where blocker_id = ${userId}
      union
      select blocker_id as other_id from user_blocks where blocked_id = ${userId}
    `;
    return new Set(rows.map((r) => r.other_id));
  } catch {
    return new Set();
  }
}

export const submitSafetyReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      contentType: SafetyContentType;
      contentId?: string;
      reportedUserId?: string;
      contentExcerpt?: string;
      reason: string;
      details?: string;
      alsoBlock?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await sqlReady();
    const reason = data.reason.trim();
    if (!REPORT_REASONS.some((r) => r.value === reason)) {
      throw new Error("Pick a reason so we can review this.");
    }
    if (data.reportedUserId && data.reportedUserId === context.userId) {
      throw new Error("You cannot report yourself.");
    }
    const id = uid("rpt");
    await sql`
      insert into safety_reports (
        id, reporter_id, content_type, content_id, reported_user_id,
        content_excerpt, reason, details, status
      ) values (
        ${id},
        ${context.userId},
        ${data.contentType},
        ${data.contentId ?? null},
        ${data.reportedUserId ?? null},
        ${(data.contentExcerpt ?? "").slice(0, 500)},
        ${reason},
        ${(data.details ?? "").trim()},
        'open'
      )
    `;
    let blocked = false;
    if (data.alsoBlock && data.reportedUserId) {
      blocked = await insertBlock(sql, context.userId, data.reportedUserId);
    }
    const issueId = uid("iss");
    const excerpt = (data.contentExcerpt ?? "").slice(0, 180);
    await sql`
      insert into ops_issues (id, title, body, source_app, status, created_by)
      values (
        ${issueId},
        ${`Safety report: ${reason} (${data.contentType})`},
        ${[
          `Report ${id}`,
          `Reporter ${context.userId}`,
          data.reportedUserId ? `About user ${data.reportedUserId}` : "",
          excerpt ? `Excerpt: ${excerpt}` : "",
          (data.details ?? "").trim() ? `Details: ${data.details?.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n")},
        'neighborly',
        'open',
        ${context.userId}
      )
    `;
    return { id, blocked };
  });

async function insertBlock(
  sql: Awaited<ReturnType<typeof getSql>>,
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  if (!blockedId || blockedId === blockerId) return false;
  try {
    await sql`
      insert into user_blocks (blocker_id, blocked_id)
      values (${blockerId}, ${blockedId})
      on conflict do nothing
    `;
    return true;
  } catch {
    return false;
  }
}

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => input)
  .handler(async ({ context, data }) => {
    if (!data.userId) throw new Error("Who should we block?");
    const sql = await sqlReady();
    const ok = await insertBlock(sql, context.userId, data.userId);
    if (!ok) throw new Error("Could not block that neighbor.");
    return { ok: true as const };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await sqlReady();
    await sql`
      delete from user_blocks
      where blocker_id = ${context.userId} and blocked_id = ${data.userId}
    `;
    return { ok: true as const };
  });

export const listMyBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UserBlock[]> => {
    const sql = await sqlReady();
    try {
      const rows = await sql<Record<string, unknown>>`
        select b.blocked_id, b.created_at, coalesce(p.display_name, 'Neighbor') as display_name
        from user_blocks b
        left join profiles p on p.user_id = b.blocked_id
        where b.blocker_id = ${context.userId}
        order by b.created_at desc
      `;
      return rows.map((r) => ({
        blocked_id: String(r.blocked_id),
        display_name: String(r.display_name),
        created_at: String(r.created_at),
      }));
    } catch {
      return [];
    }
  });

export const listOpenSafetyReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    | { status: "signed_out" }
    | { status: "forbidden" }
    | { status: "ok"; reports: SafetyReport[] }
  > => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    if (!user) return { status: "signed_out" };
    if (!isOwnerEmail(user.email)) return { status: "forbidden" };
    const sql = await sqlReady();
    try {
      const rows = await sql<Record<string, unknown>>`
        select id, reporter_id, content_type, content_id, reported_user_id,
               content_excerpt, reason, details, status, created_at
        from safety_reports
        order by case status when 'open' then 0 when 'reviewing' then 1 else 2 end,
                 created_at desc
        limit 40
      `;
      return {
        status: "ok",
        reports: rows.map((r) => ({
          id: String(r.id),
          reporter_id: String(r.reporter_id),
          content_type: String(r.content_type),
          content_id: r.content_id ? String(r.content_id) : null,
          reported_user_id: r.reported_user_id ? String(r.reported_user_id) : null,
          content_excerpt: String(r.content_excerpt ?? ""),
          reason: String(r.reason),
          details: String(r.details ?? ""),
          status: String(r.status),
          created_at: String(r.created_at),
        })),
      };
    } catch {
      return { status: "ok", reports: [] };
    }
  },
);

export const ownerUpdateSafetyReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => input)
  .handler(async ({ data }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    if (!user || !isOwnerEmail(user.email)) throw new Error("Not the owner door");
    if (!["open", "reviewing", "resolved"].includes(data.status)) {
      throw new Error("Bad status");
    }
    const sql = await sqlReady();
    await sql`
      update safety_reports
         set status = ${data.status}, updated_at = now()
       where id = ${data.id}
    `;
    return { ok: true as const };
  });
