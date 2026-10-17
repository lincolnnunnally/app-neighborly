import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { uid } from "@/lib/utils";
import { ensureSeeded } from "./seed";
import { canViewCommunity } from "./access";
import { geocodeQuery } from "./place";
import { boardRowToEvent, loadEventFeed, pointFor } from "./weekend";
import type { BoardEventRow } from "./board-events";
import type { PublicEvent } from "@/lib/events/types";
import type { Community } from "./types";

export type EventDetail = {
  event: PublicEvent;
  /** Neighbor-board events: the board it lives on. */
  board: { id: string; slug: string; name: string; city: string; state: string } | null;
  description: string;
  hostName: string;
};

async function boardDetail(rawId: string): Promise<EventDetail | null> {
  const sql = await getSql();
  await ensureSeeded(sql);
  const rows = await sql<Record<string, unknown>>`
    select e.id, e.community_id, e.user_id, e.host_name, e.title, e.description,
           e.kind, e.location, e.starts_at, e.ends_at, e.capacity, e.rsvp_count, e.created_at,
           c.slug as c_slug, c.name as c_name, c.city as c_city, c.state as c_state,
           c.zip as c_zip, c.lat as c_lat, c.lon as c_lon
    from events e join communities c on c.id = e.community_id
    where e.id = ${rawId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  const board = {
    id: String(r.community_id),
    slug: String(r.c_slug),
    name: String(r.c_name),
    city: String(r.c_city ?? ""),
    state: String(r.c_state ?? ""),
  };
  if (!(await canViewCommunity(sql, board))) return null;
  const pt = (await pointFor({
    lat: r.c_lat as number | null,
    lon: r.c_lon as number | null,
    city: board.city,
    state: board.state,
    zip: String(r.c_zip ?? ""),
  })) ?? { lat: 0, lon: 0 };
  const row = {
    ...(r as unknown as BoardEventRow),
    description: String(r.description ?? ""),
    location: String(r.location ?? ""),
  };
  const ev = boardRowToEvent(row, { ...board, zip: String(r.c_zip ?? "") } as unknown as Community, pt);
  if (!ev) return null;
  return { event: ev, board, description: row.description, hostName: String(r.host_name ?? "") };
}

/** One event by id. Public events are found again in the (cached) feed for `near`. */
export const getEventDetail = createServerFn({ method: "GET" })
  .validator((input: { id: string; near?: string }) => ({
    id: String(input.id || "").slice(0, 200),
    near: String(input.near || "").slice(0, 80),
  }))
  .handler(async ({ data }): Promise<EventDetail | null> => {
    if (data.id.startsWith("board:")) return boardDetail(data.id.slice("board:".length));
    if (!data.near) return null;
    const geo = await geocodeQuery(data.near).catch(() => null);
    if (!geo) return null;
    const feed = await loadEventFeed({
      point: { lat: geo.lat, lon: geo.lon },
      label: `${geo.city}, ${geo.state}`,
      zip: geo.zip,
      radiusMi: 100,
    });
    if (!feed) return null;
    const all = [...feed.events, ...feed.nearby, ...feed.nextWeekend];
    const hit = all.find((e) => e.id === data.id || e.otherPlaces?.some((p) => p.id === data.id));
    if (!hit) return null;
    return { event: hit, board: null, description: hit.summary, hostName: "" };
  });

/** Count and "am I going" for a neighbor-board event. Works signed out. */
export const getRsvpState = createServerFn({ method: "GET" })
  .validator((eventId: string) => String(eventId || "").replace(/^board:/, ""))
  .handler(async ({ data: eventId }) => {
    const sql = await getSql();
    const row = await sql<{ rsvp_count: number }>`select rsvp_count from events where id = ${eventId} limit 1`;
    let going = false;
    let signedIn = false;
    try {
      const { getSessionUser } = await import("@/lib/auth/verify.server");
      const user = await getSessionUser();
      if (user) {
        signedIn = true;
        const mine = await sql`select id from event_rsvps where event_id = ${eventId} and user_id = ${user.id} limit 1`;
        going = mine.length > 0;
      }
    } catch {
      /* signed out */
    }
    return { count: Number(row[0]?.rsvp_count ?? 0), going, signedIn };
  });

/**
 * "I'll be there": records a real RSVP. Joins the board first when needed
 * (going to a neighbor gathering is how most people join).
 */
export const rsvpNeighborEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((eventId: string) => String(eventId || "").replace(/^board:/, ""))
  .handler(async ({ context, data: eventId }) => {
    const sql = await getSql();
    const evt = await sql<{ community_id: string; slug: string }>`
      select e.community_id, c.slug from events e join communities c on c.id = e.community_id
      where e.id = ${eventId} limit 1
    `;
    if (!evt[0]) throw new Error("That gathering is no longer listed.");
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    if (!profile[0]) return { ok: false as const, needsProfile: true, count: 0 };

    const member = await sql<{ id: string; status: string }>`
      select id, status from memberships
      where user_id = ${context.userId} and community_id = ${evt[0].community_id}
      limit 1
    `;
    if (!member[0] || member[0].status !== "active") {
      if (!(await canViewCommunity(sql, { id: evt[0].community_id, slug: evt[0].slug }))) {
        throw new Error("That gathering is no longer listed.");
      }
      if (member[0]) {
        await sql`update memberships set status = 'active' where id = ${member[0].id}`;
      } else {
        await sql`
          insert into memberships (id, user_id, community_id, role, status, joined_via, is_primary)
          values (${uid("mem")}, ${context.userId}, ${evt[0].community_id}, 'member', 'active', 'event', false)
        `;
      }
      await sql`update communities set member_count = member_count + 1 where id = ${evt[0].community_id}`;
    }

    const existing = await sql`
      select id from event_rsvps where event_id = ${eventId} and user_id = ${context.userId} limit 1
    `;
    if (existing.length === 0) {
      await sql`
        insert into event_rsvps (id, event_id, user_id, display_name)
        values (${uid("rsvp")}, ${eventId}, ${context.userId}, ${profile[0].display_name || "Neighbor"})
      `;
      await sql`update events set rsvp_count = rsvp_count + 1 where id = ${eventId}`;
    }
    const row = await sql<{ rsvp_count: number }>`select rsvp_count from events where id = ${eventId} limit 1`;
    return { ok: true as const, needsProfile: false, count: Number(row[0]?.rsvp_count ?? 0) };
  });

export const cancelNeighborRsvp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((eventId: string) => String(eventId || "").replace(/^board:/, ""))
  .handler(async ({ context, data: eventId }) => {
    const sql = await getSql();
    const res = await sql`
      delete from event_rsvps where event_id = ${eventId} and user_id = ${context.userId} returning id
    `;
    if (res.length > 0) {
      await sql`update events set rsvp_count = greatest(rsvp_count - 1, 0) where id = ${eventId}`;
    }
    const row = await sql<{ rsvp_count: number }>`select rsvp_count from events where id = ${eventId} limit 1`;
    return { ok: true as const, count: Number(row[0]?.rsvp_count ?? 0) };
  });
