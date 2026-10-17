/**
 * Public event sources and the fetch/cache layer. Server-only.
 *
 * Every source here is a feed its owner publishes for reuse: Localist's public
 * event API (campus calendars), The Events Calendar REST API (WordPress sites),
 * the statewide parks calendar, and a venue's own listing page. Each card links
 * back to the source page. Fetches are cached (30 min fresh, served stale up to
 * a day when a source is down or rate-limits us), so a busy weekend page makes
 * one request per source per half hour, not one per visitor.
 */
import { haversineMiles } from "./geo";
import { GA_PARK_COORDS } from "./ga-parks";
import { parseGaParks, parseLocalist, parsePalShows, parseTribe, inferCategory } from "./parse";
import { addDaysKey, DEFAULT_TZ } from "./time";
import type { PublicEvent } from "./types";

export type SourceKind = "localist" | "tribe" | "gaparks" | "pal" | "ticketmaster";

export type SourceDef = {
  id: string;
  kind: SourceKind;
  /** Organizer name shown on cards ("From Georgia State Parks"). */
  name: string;
  /** Public page we link people to. */
  url: string;
  /** API base (host) for localist/tribe. */
  base?: string;
  lat: number;
  lon: number;
  city: string;
  /** How far from (lat, lon) this source's events can be. */
  reachMi: number;
};

export const SOURCES: SourceDef[] = [
  { id: "gaparks", kind: "gaparks", name: "Georgia State Parks", url: "https://explore.gastateparks.org/events", lat: 32.9, lon: -83.4, city: "", reachMi: 320 },
  { id: "pal", kind: "pal", name: "The Pal Theatre", url: "https://thepaltheatre.com/shows-events/", lat: 32.2177, lon: -82.4134, city: "Vidalia", reachMi: 1 },
  { id: "toombs", kind: "tribe", name: "Toombs County", url: "https://toombscountyga.gov/events/", base: "https://toombscountyga.gov", lat: 32.2043, lon: -82.3218, city: "Lyons", reachMi: 15 },
  { id: "gasouthern", kind: "localist", name: "Georgia Southern University", url: "https://calendar.georgiasouthern.edu/", base: "https://calendar.georgiasouthern.edu", lat: 32.422, lon: -81.7832, city: "Statesboro", reachMi: 60 },
  { id: "gsu", kind: "localist", name: "Georgia State University", url: "https://calendar.gsu.edu/", base: "https://calendar.gsu.edu", lat: 33.7531, lon: -84.3853, city: "Atlanta", reachMi: 25 },
  { id: "agnesscott", kind: "localist", name: "Agnes Scott College", url: "https://calendar.agnesscott.edu/", base: "https://calendar.agnesscott.edu", lat: 33.7687, lon: -84.2941, city: "Decatur", reachMi: 3 },
  { id: "kennesaw", kind: "localist", name: "Kennesaw State University", url: "https://calendar.kennesaw.edu/", base: "https://calendar.kennesaw.edu", lat: 34.0382, lon: -84.5827, city: "Kennesaw", reachMi: 15 },
  { id: "uga", kind: "localist", name: "University of Georgia", url: "https://calendar.uga.edu/", base: "https://calendar.uga.edu", lat: 33.948, lon: -83.3774, city: "Athens", reachMi: 20 },
  { id: "poncecity", kind: "tribe", name: "Ponce City Market", url: "https://www.poncecitymarket.com/events/", base: "https://www.poncecitymarket.com", lat: 33.7726, lon: -84.3655, city: "Atlanta", reachMi: 1 },
  { id: "ahc", kind: "tribe", name: "Atlanta History Center", url: "https://www.atlantahistorycenter.com/events/", base: "https://www.atlantahistorycenter.com", lat: 33.842, lon: -84.386, city: "Atlanta", reachMi: 3 },
  { id: "piedmont", kind: "tribe", name: "Piedmont Park Conservancy", url: "https://piedmontpark.org/events/", base: "https://piedmontpark.org", lat: 33.7851, lon: -84.3738, city: "Atlanta", reachMi: 2 },
  { id: "decaturarts", kind: "tribe", name: "Decatur Arts Alliance", url: "https://www.decaturartsalliance.org/events/", base: "https://www.decaturartsalliance.org", lat: 33.7748, lon: -84.2963, city: "Decatur", reachMi: 3 },
  { id: "civilrights", kind: "tribe", name: "National Center for Civil and Human Rights", url: "https://www.civilandhumanrights.org/events/", base: "https://www.civilandhumanrights.org", lat: 33.7633, lon: -84.3934, city: "Atlanta", reachMi: 1 },
  { id: "atlpride", kind: "tribe", name: "Atlanta Pride", url: "https://atlantapride.org/events/", base: "https://atlantapride.org", lat: 33.7851, lon: -84.3738, city: "Atlanta", reachMi: 5 },
];

/** Optional nationwide ticketed-events feed; only on when its key is configured. */
function ticketedKey(): string {
  return (typeof process !== "undefined" && process.env.TICKETMASTER_API_KEY?.trim()) || "";
}

const UA = "Mozilla/5.0 (compatible; NeighborlyEvents/1.0; +https://neighborly.unitedundergod.org)";
const FRESH_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 6500;
const SOURCE_BUDGET_MS = 7000;

type CacheEntry = { at: number; events: PublicEvent[] };
const g = globalThis as typeof globalThis & {
  __nbEventCache__?: Map<string, CacheEntry>;
  __nbEventInflight__?: Map<string, Promise<PublicEvent[]>>;
};
const cache = (g.__nbEventCache__ ??= new Map());
const inflight = (g.__nbEventInflight__ ??= new Map());

async function getText(url: string, accept = "application/json"): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: accept, "User-Agent": UA },
  });
  if (res.status === 429) throw new Error("rate limited");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function mdY(key: string): string {
  const [y, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

async function fetchLocalist(src: SourceDef, fromKey: string, toKey: string, tz: string): Promise<PublicEvent[]> {
  const out: PublicEvent[] = [];
  for (let page = 1; page <= 5; page++) {
    const text = await getText(`${src.base}/api/2/events?start=${fromKey}&end=${toKey}&pp=100&page=${page}`);
    const json = JSON.parse(text) as { page?: { total?: number }; events?: unknown[] };
    out.push(...parseLocalist(json, { id: src.id, organizer: src.name }, tz));
    if (!json.page?.total || page >= json.page.total) break;
  }
  return out;
}

async function fetchTribe(src: SourceDef, fromKey: string, toKey: string, tz: string): Promise<PublicEvent[]> {
  const out: PublicEvent[] = [];
  for (let page = 1; page <= 4; page++) {
    const qs = new URLSearchParams({
      start_date: `${fromKey} 00:00:00`,
      end_date: `${toKey} 23:59:59`,
      per_page: "50",
      page: String(page),
    });
    let text: string;
    try {
      text = await getText(`${src.base}/wp-json/tribe/events/v1/events?${qs}`);
    } catch (e) {
      // TEC answers 400 "page out of range" past the last page.
      if (page > 1) break;
      throw e;
    }
    const json = JSON.parse(text) as { total_pages?: number };
    out.push(...parseTribe(json, { id: src.id, organizer: src.name, lat: src.lat, lon: src.lon, city: src.city }, tz));
    if (!json.total_pages || page >= json.total_pages) break;
  }
  return out;
}

async function fetchGaParks(fromKey: string, toKey: string, tz: string): Promise<PublicEvent[]> {
  // One page per week; each holds ~150 rows starting at `startdate`.
  const starts = [fromKey];
  for (let k = addDaysKey(fromKey, 7); k <= toKey; k = addDaysKey(k, 7)) starts.push(k);
  const pages = await Promise.all(
    starts.map((k) => getText(`https://explore.gastateparks.org/Events?startdate=${mdY(k)}`, "text/html")),
  );
  const seen = new Set<string>();
  const out: PublicEvent[] = [];
  for (const html of pages) {
    for (const e of parseGaParks(html, GA_PARK_COORDS, tz)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

async function fetchPal(tz: string): Promise<PublicEvent[]> {
  return parsePalShows(await getText("https://thepaltheatre.com/shows-events/", "text/html"), Date.now(), tz);
}

type TmEvent = {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { dateTime?: string; localDate?: string; dateTBA?: boolean } };
  images?: { url: string; width: number; ratio?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  _embedded?: { venues?: { name?: string; city?: { name?: string }; location?: { latitude?: string; longitude?: string } }[] };
};

async function fetchTicketed(lat: number, lon: number, radiusMi: number, fromKey: string, toKey: string): Promise<PublicEvent[]> {
  const key = ticketedKey();
  if (!key) return [];
  const qs = new URLSearchParams({
    apikey: key,
    latlong: `${lat.toFixed(3)},${lon.toFixed(3)}`,
    radius: String(Math.round(radiusMi)),
    unit: "miles",
    startDateTime: `${fromKey}T00:00:00Z`,
    endDateTime: `${addDaysKey(toKey, 1)}T06:00:00Z`,
    size: "100",
    sort: "date,asc",
  });
  const json = JSON.parse(await getText(`https://app.ticketmaster.com/discovery/v2/events.json?${qs}`)) as {
    _embedded?: { events?: TmEvent[] };
  };
  const out: PublicEvent[] = [];
  for (const e of json._embedded?.events ?? []) {
    const startIso = e.dates?.start?.dateTime;
    if (!startIso || e.dates?.start?.dateTBA) continue;
    const v = e._embedded?.venues?.[0];
    const vLat = Number(v?.location?.latitude);
    const vLon = Number(v?.location?.longitude);
    const img = (e.images ?? []).filter((i) => i.ratio === "16_9").sort((a, b) => Math.abs(a.width - 640) - Math.abs(b.width - 640))[0];
    const seg = [e.classifications?.[0]?.segment?.name, e.classifications?.[0]?.genre?.name].filter(Boolean).join(" ");
    out.push({
      id: `tm:${e.id}`,
      title: e.name,
      startMs: Date.parse(startIso),
      endMs: null,
      allDay: false,
      multiDay: false,
      venue: v?.name || "",
      city: v?.city?.name || "",
      lat: Number.isFinite(vLat) ? vLat : null,
      lon: Number.isFinite(vLon) ? vLon : null,
      url: e.url,
      image: img?.url ?? null,
      organizer: v?.name || "Venue",
      sourceId: "ticketed",
      category: /sport/i.test(seg) ? "sports" : /music/i.test(seg) ? "music" : inferCategory(e.name, seg),
      free: null,
      summary: "",
    });
  }
  return out;
}

export type SourceRun = { def: SourceDef; events: PublicEvent[]; status: "ok" | "cached" | "stale" | "error"; error?: string };

async function cached(key: string, load: () => Promise<PublicEvent[]>): Promise<{ events: PublicEvent[]; status: SourceRun["status"]; error?: string }> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < FRESH_MS) return { events: hit.events, status: "cached" };
  let p = inflight.get(key);
  if (!p) {
    p = load()
      .then((events) => {
        cache.set(key, { at: Date.now(), events });
        return events;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try {
    // A slow source never holds the page hostage: answer within the budget and
    // let the fetch finish in the background to warm the cache.
    const events = await Promise.race([
      p,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow source")), SOURCE_BUDGET_MS)),
    ]);
    return { events, status: "ok" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (hit && now - hit.at < STALE_MS) return { events: hit.events, status: "stale", error };
    return { events: [], status: "error", error };
  }
}

/** Sources worth asking for a search centered at (lat, lon) out to `wideMi`. */
export function sourcesNear(lat: number, lon: number, wideMi: number): SourceDef[] {
  return SOURCES.filter((s) => haversineMiles(lat, lon, s.lat, s.lon) <= wideMi + s.reachMi);
}

export async function runSources(opts: {
  lat: number;
  lon: number;
  wideMi: number;
  fromKey: string;
  toKey: string;
  tz?: string;
}): Promise<SourceRun[]> {
  const tz = opts.tz || DEFAULT_TZ;
  const defs = sourcesNear(opts.lat, opts.lon, opts.wideMi);
  const runs = defs.map(async (def): Promise<SourceRun> => {
    const key = `${def.id}:${opts.fromKey}:${opts.toKey}`;
    const loader =
      def.kind === "localist"
        ? () => fetchLocalist(def, opts.fromKey, opts.toKey, tz)
        : def.kind === "tribe"
          ? () => fetchTribe(def, opts.fromKey, opts.toKey, tz)
          : def.kind === "gaparks"
            ? () => fetchGaParks(opts.fromKey, opts.toKey, tz)
            : () => fetchPal(tz);
    const r = await cached(key, loader);
    if (r.status === "error") console.warn(`[events] ${def.id} failed: ${r.error}`);
    return { def, ...r };
  });
  if (ticketedKey()) {
    const def: SourceDef = {
      id: "ticketed",
      kind: "ticketmaster",
      name: "Ticketed shows and games",
      url: "",
      lat: opts.lat,
      lon: opts.lon,
      city: "",
      reachMi: 0,
    };
    const key = `ticketed:${opts.lat.toFixed(2)},${opts.lon.toFixed(2)}:${Math.round(opts.wideMi)}:${opts.fromKey}`;
    runs.push(
      cached(key, () => fetchTicketed(opts.lat, opts.lon, opts.wideMi, opts.fromKey, opts.toKey)).then((r) => ({ def, ...r })),
    );
  }
  return Promise.all(runs);
}

export function ticketedFeedConfigured(): boolean {
  return Boolean(ticketedKey());
}
