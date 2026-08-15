import { createServerFn } from "@tanstack/react-start";

const OWNER_FALLBACK = "lincoln@unitedundergod.org";

export type NeighborlyCounts = {
  neighbors: number | null;
  needs: number | null;
  events: number | null;
  posts: number | null;
};

export type OwnerDashboard =
  | { status: "signed_out" }
  | { status: "forbidden"; email: string | null }
  | { status: "ok"; email: string; counts: NeighborlyCounts };

function ownerEmails(): string[] {
  const fromEnv = (process.env.APP_ENGINE_OWNER_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set(fromEnv);
  set.add(OWNER_FALLBACK);
  return [...set];
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.trim().toLowerCase());
}

async function countNamedTable(
  sql: { query<T>(text: string, params?: unknown[]): Promise<T[]> },
  table: string,
): Promise<number | null> {
  if (!/^[a-z_]+$/.test(table)) return null;
  try {
    const found = await sql.query<{ n: number }>(
      `select count(*)::int as n
         from information_schema.tables
        where table_schema in ('neighborly', 'public')
          and table_name = $1`,
      [table],
    );
    if (!found[0] || Number(found[0].n) === 0) return null;
    const rows = await sql.query<{ c: number }>(
      `select count(*)::int as c from ${table}`,
    );
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

/** Real row counts. Missing table → null. Empty table → 0. */
export async function loadNeighborlyCounts(): Promise<NeighborlyCounts> {
  const { getSql } = await import("./db");
  const sql = await getSql();
  const [neighbors, needs, events, posts] = await Promise.all([
    // No `neighbors` table — people live on `profiles`.
    countNamedTable(sql, "profiles"),
    countNamedTable(sql, "needs"),
    countNamedTable(sql, "events"),
    countNamedTable(sql, "posts"),
  ]);
  return { neighbors, needs, events, posts };
}

export const getOwnerDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<OwnerDashboard> => {
    const { getSessionUser } = await import("./auth/verify.server");
    const user = await getSessionUser();
    if (!user) return { status: "signed_out" };
    if (!isOwnerEmail(user.email)) {
      return { status: "forbidden", email: user.email };
    }
    return {
      status: "ok",
      email: user.email ?? OWNER_FALLBACK,
      counts: await loadNeighborlyCounts(),
    };
  },
);
