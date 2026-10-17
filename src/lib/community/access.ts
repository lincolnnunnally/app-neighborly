import { isMembersOnlyCommunity } from "./public-filters";

type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

/**
 * Can the current visitor see this board? Open boards: always.
 * Members-only boards: the owner and active members only.
 */
export async function canViewCommunity(sql: Sql, c: { id: string; slug: string }): Promise<boolean> {
  if (!isMembersOnlyCommunity(c.slug)) return true;
  let user: { id: string; email: string | null } | null = null;
  try {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    user = await getSessionUser();
  } catch {
    user = null;
  }
  if (!user) return false;
  const { isOwnerEmail } = await import("@/lib/admin-stats");
  if (isOwnerEmail(user.email)) return true;
  const m = await sql`
    select id from memberships
    where user_id = ${user.id} and community_id = ${c.id} and status = 'active'
    limit 1
  `;
  return m.length > 0;
}
