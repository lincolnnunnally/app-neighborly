/**
 * Stored weekend feed (neighborly.public_events + event_sources). Server-only.
 *
 * A daily cron refreshes every source into these tables; page loads read them.
 * A source with no successful refresh yet is fetched live once and saved, so a
 * brand-new source or an empty table never shows a blank page. Every function
 * here swallows database errors: if the store is down, the live path still works.
 */
import type { PublicEvent } from "./types";

type Row = Record<string, unknown>;

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function ms(v: unknown): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

function dayKey(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export type StoredSource = {
  id: string;
  name: string;
  kind: string;
  url: string;
  lastAttemptMs: number | null;
  lastSuccessMs: number | null;
  lastError: string | null;
  lastCount: number;
  coveredFrom: string | null;
  coveredTo: string | null;
};

function toSource(r: Row): StoredSource {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    kind: String(r.kind ?? ""),
    url: String(r.url ?? ""),
    lastAttemptMs: ms(r.last_attempt_at),
    lastSuccessMs: ms(r.last_success_at),
    lastError: (r.last_error as string | null) ?? null,
    lastCount: Number(r.last_count ?? 0),
    coveredFrom: dayKey(r.covered_from),
    coveredTo: dayKey(r.covered_to),
  };
}

export async function readSourceStates(ids?: string[]): Promise<Map<string, StoredSource>> {
  const out = new Map<string, StoredSource>();
  try {
    const db = await sql();
    const rows = ids
      ? await db.query("select * from event_sources where id in (select jsonb_array_elements_text($1::jsonb))", [JSON.stringify(ids)])
      : await db.query("select * from event_sources order by id");
    for (const r of rows) out.set(String(r.id), toSource(r));
  } catch (e) {
    console.warn(`[events] store read failed: ${e instanceof Error ? e.message : e}`);
  }
  return out;
}

export async function readStoredEvents(ids: string[], fromMs: number, toMs: number): Promise<Map<string, PublicEvent[]>> {
  const out = new Map<string, PublicEvent[]>();
  if (!ids.length) return out;
  try {
    const db = await sql();
    const rows = await db.query(
      `select * from public_events
        where source_id in (select jsonb_array_elements_text($1::jsonb))
          and start_at < $3::timestamptz and coalesce(end_at, start_at + interval '1 day') >= $2::timestamptz`,
      [JSON.stringify(ids), new Date(fromMs).toISOString(), new Date(toMs).toISOString()],
    );
    for (const r of rows) {
      const e: PublicEvent = {
        id: String(r.id),
        title: String(r.title),
        startMs: ms(r.start_at) ?? 0,
        endMs: ms(r.end_at),
        allDay: Boolean(r.all_day),
        multiDay: Boolean(r.multi_day),
        venue: String(r.venue ?? ""),
        city: String(r.city ?? ""),
        lat: r.lat == null ? null : Number(r.lat),
        lon: r.lon == null ? null : Number(r.lon),
        url: String(r.url),
        image: (r.image as string | null) ?? null,
        organizer: String(r.organizer ?? ""),
        sourceId: String(r.source_id),
        category: String(r.category ?? "community") as PublicEvent["category"],
        free: r.free == null ? null : Boolean(r.free),
        summary: String(r.summary ?? ""),
      };
      const list = out.get(e.sourceId) ?? [];
      list.push(e);
      out.set(e.sourceId, list);
    }
  } catch (e) {
    console.warn(`[events] store read failed: ${e instanceof Error ? e.message : e}`);
  }
  return out;
}

export type SourceMeta = { id: string; name: string; kind: string; url: string };

/** Replace one source's stored events and mark it healthy. */
export async function saveSourceEvents(def: SourceMeta, events: PublicEvent[], fromKey: string, toKey: string): Promise<boolean> {
  try {
    const db = await sql();
    const byId = new Map(events.map((e) => [e.id, e]));
    const rows = [...byId.values()].map((e) => ({
      id: e.id,
      source_id: def.id,
      title: e.title.slice(0, 300),
      start_at: new Date(e.startMs).toISOString(),
      end_at: e.endMs ? new Date(e.endMs).toISOString() : null,
      all_day: e.allDay,
      multi_day: e.multiDay,
      venue: (e.venue || "").slice(0, 200),
      city: (e.city || "").slice(0, 100),
      lat: e.lat,
      lon: e.lon,
      url: e.url,
      image: e.image,
      organizer: (e.organizer || "").slice(0, 200),
      category: e.category,
      free: e.free,
      summary: (e.summary || "").slice(0, 400),
    }));
    await db.query("delete from public_events where source_id = $1", [def.id]);
    if (rows.length) {
      await db.query(
        `insert into public_events (id, source_id, title, start_at, end_at, all_day, multi_day, venue, city, lat, lon, url, image, organizer, category, free, summary, fetched_at)
         select id, source_id, title, start_at, end_at, all_day, multi_day, venue, city, lat, lon, url, image, organizer, category, free, summary, now()
           from jsonb_to_recordset($1::jsonb) as x(id text, source_id text, title text, start_at timestamptz, end_at timestamptz,
                all_day boolean, multi_day boolean, venue text, city text, lat double precision, lon double precision,
                url text, image text, organizer text, category text, free boolean, summary text)
         on conflict (id) do update set source_id = excluded.source_id, title = excluded.title, start_at = excluded.start_at,
           end_at = excluded.end_at, all_day = excluded.all_day, multi_day = excluded.multi_day, venue = excluded.venue,
           city = excluded.city, lat = excluded.lat, lon = excluded.lon, url = excluded.url, image = excluded.image,
           organizer = excluded.organizer, category = excluded.category, free = excluded.free, summary = excluded.summary,
           fetched_at = now()`,
        [JSON.stringify(rows)],
      );
    }
    await db.query(
      `insert into event_sources (id, name, kind, url, last_attempt_at, last_success_at, last_error, last_count, covered_from, covered_to)
       values ($1, $2, $3, $4, now(), now(), null, $5, $6::date, $7::date)
       on conflict (id) do update set name = excluded.name, kind = excluded.kind, url = excluded.url,
         last_attempt_at = now(), last_success_at = now(), last_error = null, last_count = excluded.last_count,
         covered_from = excluded.covered_from, covered_to = excluded.covered_to`,
      [def.id, def.name, def.kind, def.url, rows.length, fromKey, toKey],
    );
    return true;
  } catch (e) {
    console.warn(`[events] store write failed for ${def.id}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/** A failed refresh keeps the last good events; only the error is recorded. */
export async function recordSourceError(def: SourceMeta, error: string): Promise<void> {
  try {
    const db = await sql();
    await db.query(
      `insert into event_sources (id, name, kind, url, last_attempt_at, last_error)
       values ($1, $2, $3, $4, now(), $5)
       on conflict (id) do update set last_attempt_at = now(), last_error = excluded.last_error`,
      [def.id, def.name, def.kind, def.url, error.slice(0, 300)],
    );
  } catch {
    /* store down: the in-memory path still serves the page */
  }
}

/* --------------------------------------------------------- venue geocodes */

const geoMemo = ((globalThis as typeof globalThis & { __nbGeoMemo__?: Map<string, [number, number] | null> }).__nbGeoMemo__ ??=
  new Map());

/**
 * Street address -> [lat, lon] via the US Census public geocoder, cached in
 * memory and in venue_geocodes (misses too, so a bad address is asked once).
 */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const q = address.replace(/\s+/g, " ").trim().toLowerCase();
  if (!q) return null;
  if (geoMemo.has(q)) return geoMemo.get(q)!;
  try {
    const db = await sql();
    const hit = await db.query("select lat, lon, found from venue_geocodes where query = $1", [q]);
    if (hit[0]) {
      const v: [number, number] | null = hit[0].found ? [Number(hit[0].lat), Number(hit[0].lon)] : null;
      geoMemo.set(q, v);
      return v;
    }
  } catch {
    /* fall through to a live lookup */
  }
  let v: [number, number] | null = null;
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; NeighborlyEvents/1.0; +https://neighborly.unitedundergod.org)" },
    });
    if (!res.ok) return null; // transient: don't cache
    const json = (await res.json()) as { result?: { addressMatches?: { coordinates?: { x: number; y: number } }[] } };
    const c = json.result?.addressMatches?.[0]?.coordinates;
    v = c && Number.isFinite(c.x) && Number.isFinite(c.y) ? [c.y, c.x] : null;
  } catch {
    return null;
  }
  geoMemo.set(q, v);
  try {
    const db = await sql();
    await db.query(
      `insert into venue_geocodes (query, lat, lon, found, looked_up_at) values ($1, $2, $3, $4, now())
       on conflict (query) do update set lat = excluded.lat, lon = excluded.lon, found = excluded.found, looked_up_at = now()`,
      [q, v?.[0] ?? null, v?.[1] ?? null, Boolean(v)],
    );
  } catch {
    /* memo still holds it */
  }
  return v;
}
