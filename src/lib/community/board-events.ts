import type { Sql } from "@/lib/db";

/** One board row — same shape `/c/$slug` reads from `events`. */
export type BoardEventRow = {
  id: string;
  community_id: string;
  user_id: string;
  host_name: string;
  title: string;
  description: string;
  kind: string;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  rsvp_count: number;
  created_at: string;
};

/**
 * Postgres timestamptz::text is `2026-09-10 19:00:00-04`.
 * `Date.parse` on that string is engine-dependent and often NaN on serverless.
 * Board rows from `pg` arrive as Date objects; weekend used to `::text` them.
 */
export function parseEventStartMs(raw: unknown): number | null {
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const isoish = s.includes("T") ? s : s.replace(" ", "T");
  const withColonTz = isoish
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/([+-]\d{2})$/, "$1:00");
  for (const candidate of [withColonTz, isoish, s]) {
    const t = Date.parse(candidate);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

export function eventStartIso(raw: unknown): string {
  const ms = parseEventStartMs(raw);
  if (ms != null) return new Date(ms).toISOString();
  return String(raw ?? "");
}

export function mapBoardEventRow(r: Record<string, unknown>): BoardEventRow {
  return {
    id: String(r.id),
    community_id: String(r.community_id),
    user_id: String(r.user_id ?? ""),
    host_name: String(r.host_name ?? ""),
    title: String(r.title),
    description: String(r.description ?? ""),
    kind: String(r.kind ?? "social"),
    location: String(r.location ?? ""),
    starts_at: eventStartIso(r.starts_at),
    ends_at: r.ends_at == null || r.ends_at === "" ? "" : eventStartIso(r.ends_at),
    capacity: r.capacity == null ? null : Number(r.capacity),
    rsvp_count: Number(r.rsvp_count ?? 0),
    created_at: String(r.created_at ?? ""),
  };
}

/** Same listing query as `getCommunityFeed` for `/c/$slug`. */
export async function listBoardEvents(sql: Sql, communityId: string): Promise<BoardEventRow[]> {
  const rows = await sql<Record<string, unknown>>`
    select e.id, e.community_id, e.user_id, e.host_name, e.title, e.description,
           e.kind, e.location, e.starts_at, e.ends_at, e.capacity, e.rsvp_count, e.created_at
    from events e
    where e.community_id = ${communityId}
    order by e.starts_at asc
  `;
  return rows.map(mapBoardEventRow);
}

/** Sister boards in the same city (pickleball, dads) — extras, not a replacement. */
export async function listSisterCityEvents(
  sql: Sql,
  community: { id: string; city: string; state: string },
): Promise<BoardEventRow[]> {
  const city = community.city.trim();
  const state = community.state.trim();
  if (!city || !state) return [];
  const rows = await sql<Record<string, unknown>>`
    select e.id, e.community_id, e.user_id, e.host_name, e.title, e.description,
           e.kind, e.location, e.starts_at, e.ends_at, e.capacity, e.rsvp_count, e.created_at
    from events e
    join communities c on c.id = e.community_id
    where e.community_id <> ${community.id}
      and lower(c.city) = ${city.toLowerCase()}
      and lower(c.state) = ${state.toLowerCase()}
      and c.kind in ('neighborhood', 'interest', 'church')
    order by e.starts_at asc
  `;
  return rows.map(mapBoardEventRow);
}
