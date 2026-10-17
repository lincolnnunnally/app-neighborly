/**
 * Source parsers: raw public feed payload -> PublicEvent[]. Pure (no fetch),
 * so every parser is covered by `npm test` against saved fixtures.
 */
import { DEFAULT_TZ, keyStartMs, parseWallTime, partsIn, zonedToUtcMs } from "./time";
import type { EventCategory, PublicEvent } from "./types";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(s: string): string {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(s: string): string {
  return decodeEntities(String(s ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, n = 220): string {
  const t = stripHtml(s);
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

const CATEGORY_RULES: [EventCategory, RegExp][] = [
  ["festival", /festival|\bfest\b|fair\b|carnival|parade|jubilee|celebration|pride|market day|block party|oktoberfest|harvest/i],
  ["music", /concert|music|jazz|band|symphony|orchestra|choir|recital|singer|songwriter|bluegrass|gospel|dj\b|live at/i],
  ["food", /food|taste|tasting|bbq|barbecue|chili|cook|wine|beer|brew|farmers.?market|green market|brunch|supper|dinner/i],
  ["family", /kids|child|family|story ?time|storytime|puppet|halloween|trick|pumpkin|haunted|costume|paw patrol|junior ranger|scout|teddy/i],
  ["outdoors", /hike|hiking|trail|paddle|kayak|canoe|nature|bird|garden|park\b|fishing|camp|star ?gaz|observatory|sunset|waterfall|wildlife|run club|5k|walk/i],
  ["sports", /\bvs\.?\b|football|baseball|softball|basketball|soccer|volleyball|tennis|pickleball|golf|race\b|tournament/i],
  ["arts", /art|gallery|exhibit|museum|theat|film|movie|cinema|dance|ballet|opera|poetry|comedy|craft|paint|photograph|history/i],
  ["learning", /lecture|talk|speaker|conversation|book|author|class|workshop|seminar/i],
];

export function inferCategory(...texts: string[]): EventCategory {
  const t = texts.join(" ");
  for (const [cat, re] of CATEGORY_RULES) if (re.test(t)) return cat;
  return "community";
}

/* ------------------------------------------------------------------ Localist */

type LocalistInstance = { event_instance: { id: number; start: string; end?: string | null; all_day?: boolean } };
type LocalistEvent = {
  id: number;
  title: string;
  url?: string | null;
  localist_url?: string;
  location_name?: string;
  address?: string;
  photo_url?: string | null;
  free?: boolean;
  experience?: string;
  description_text?: string;
  geo?: { latitude?: string | number | null; longitude?: string | number | null; city?: string | null } | null;
  filters?: Record<string, { name: string }[] | undefined>;
  event_instances?: LocalistInstance[];
};

const LOCALIST_DROP_TITLE =
  /withdraw|deadline|semester|class project|rehearsal|graduation recital|meeting|grief group|orientation|office hours|webinar|virtual|chartering|seminar series|campus tour|info(rmation)? session|thesis|dissertation|defense|commitment to consent|study (power )?hour|ticket sales|practice\b|interview|advising|registration|payroll|tuition|\bphd\b|mba|career fair|student day|graduate social|\bclub:|power query|excel|python \d/i;
const LOCALIST_DROP_TYPE =
  /academic|student (activity|life)|meeting|training|info(rmation)? session|career|eagle engage|tours|deadline|conferences|interfaith/i;
const LOCALIST_PUBLIC_TYPE =
  /arts|culture|entertainment|performance|exhibit|music|concert|theat|film|festival|community|greater metro|special event|recreation|lecture|speaker|family/i;
const NON_PUBLIC_AUDIENCE = /^(students?|faculty|staff|graduate students|undergraduate students|postdocs|employees)$/i;

/** Campus calendars carry deadlines and club meetings; keep what a visitor could attend. */
export function isPublicLocalistEvent(e: LocalistEvent): boolean {
  if ((e.experience || "").toLowerCase() === "virtual") return false;
  if (LOCALIST_DROP_TITLE.test(e.title || "")) return false;
  const types = (e.filters?.event_types ?? []).map((t) => t.name);
  const audience = (e.filters?.event_audience ?? []).map((a) => a.name);
  if (audience.length && audience.every((a) => NON_PUBLIC_AUDIENCE.test(a.trim()))) return false;
  const publicAudience = audience.some((a) => /public|community|everyone|famil|alumni/i.test(a));
  const publicType = types.some((t) => LOCALIST_PUBLIC_TYPE.test(t));
  if (types.length && types.every((t) => LOCALIST_DROP_TYPE.test(t)) && !publicAudience) return false;
  return publicAudience || publicType;
}

export function parseLocalist(
  payload: unknown,
  source: { id: string; organizer: string },
  tz = DEFAULT_TZ,
): PublicEvent[] {
  const events = ((payload as { events?: { event: LocalistEvent }[] })?.events ?? []).map((w) => w.event);
  const out: PublicEvent[] = [];
  for (const e of events) {
    if (!e?.title || !isPublicLocalistEvent(e)) continue;
    const lat = Number(e.geo?.latitude);
    const lon = Number(e.geo?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
    const types = (e.filters?.event_types ?? []).map((t) => t.name).join(" ");
    for (const inst of e.event_instances ?? []) {
      const i = inst.event_instance;
      const startMs = parseWallTime(i.start, tz);
      if (startMs == null) continue;
      const endMs = i.end ? parseWallTime(i.end, tz) : null;
      const allDay = Boolean(i.all_day);
      out.push({
        id: `${source.id}:${i.id}`,
        title: decodeEntities(e.title).trim(),
        startMs: allDay ? keyStartMs(String(i.start).slice(0, 10), tz) : startMs,
        endMs,
        allDay,
        multiDay: false,
        venue: decodeEntities(e.location_name || ""),
        city: e.geo?.city || "",
        lat,
        lon,
        url: e.localist_url || e.url || "",
        image: e.photo_url && !/placeholder|default/i.test(e.photo_url) ? e.photo_url.replace("/huge/", "/big/") : null,
        organizer: source.organizer,
        sourceId: source.id,
        category: inferCategory(e.title, types),
        free: typeof e.free === "boolean" ? e.free : null,
        summary: clip(e.description_text || ""),
      });
    }
  }
  return out;
}

/* ------------------------------------------------- The Events Calendar (WP) */

type TribeEvent = {
  id: number;
  title: string;
  url: string;
  description?: string;
  excerpt?: string;
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  timezone?: string;
  cost?: string;
  image?: { url?: string } | false;
  venue?: { venue?: string; city?: string; geo_lat?: number | string; geo_lng?: number | string } | unknown[];
  categories?: { name: string }[];
};

/**
 * Use the site's local wall time (`start_date`) plus its named timezone — NOT
 * `utc_start_date`. Some sites run WordPress on UTC by mistake, so their "UTC"
 * field equals local time and lands every event 4 hours early.
 */
export function parseTribe(
  payload: unknown,
  source: { id: string; organizer: string; lat: number; lon: number; city: string },
  tz = DEFAULT_TZ,
): PublicEvent[] {
  const events = (payload as { events?: TribeEvent[] })?.events ?? [];
  const out: PublicEvent[] = [];
  for (const e of events) {
    if (!e?.title || !e.start_date) continue;
    const zone = e.timezone && /^[A-Za-z]+\/[A-Za-z_]+/.test(e.timezone) ? e.timezone : tz;
    const startMs = parseWallTime(e.start_date, zone);
    if (startMs == null) continue;
    const endMs = e.end_date ? parseWallTime(e.end_date, zone) : null;
    const venue = Array.isArray(e.venue) ? undefined : (e.venue as Exclude<TribeEvent["venue"], unknown[]>);
    const vLat = Number(venue?.geo_lat);
    const vLon = Number(venue?.geo_lng);
    const hasGeo = Number.isFinite(vLat) && Number.isFinite(vLon) && vLat !== 0;
    const cost = stripHtml(e.cost || "");
    const multiDay = endMs != null && endMs - startMs > 26 * 3600 * 1000;
    const title = decodeEntities(e.title).trim();
    if (/^member only|members only|private event|closed to the public/i.test(title)) continue;
    out.push({
      id: `${source.id}:${e.id}:${startMs}`,
      title,
      startMs,
      endMs,
      allDay: Boolean(e.all_day),
      multiDay,
      venue: decodeEntities(venue?.venue || source.organizer),
      city: venue?.city || source.city,
      lat: hasGeo ? vLat : source.lat,
      lon: hasGeo ? vLon : source.lon,
      url: e.url,
      image: e.image && typeof e.image === "object" && e.image.url ? e.image.url : null,
      organizer: source.organizer,
      sourceId: source.id,
      category: inferCategory(title, (e.categories ?? []).map((c) => c.name).join(" ")),
      free: /^free$/i.test(cost) ? true : cost ? false : null,
      summary: clip(e.excerpt || e.description || ""),
    });
  }
  return out;
}

/* ------------------------------------------------------ Georgia State Parks */

const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "1 PM", "9:30 AM", "Noon" -> [h, m] */
export function parseClock(s: string): [number, number] | null {
  const t = s.trim().toLowerCase();
  if (t === "noon") return [12, 0];
  if (t === "midnight") return [0, 0];
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === "p") h += 12;
  return [h, Number(m[2] ?? 0)];
}

export type ParkCoords = Record<string, [number, number]>;

/**
 * The statewide parks calendar labels every row for screen readers:
 *   "View event details for {Park} - {Title} - Saturday, Oct 17, 2026 1 PM to 2 PM"
 *   "View event details for {Park} - {Title} -  9:30 AM - 11 AM  from  Oct 17, 2026 until Nov 9, 2026"
 * Recurring rows carry one link per day; the `c=` id keeps each day distinct.
 */
export function parseGaParks(html: string, parks: ParkCoords, tz = DEFAULT_TZ): PublicEvent[] {
  const out: PublicEvent[] = [];
  const seen = new Set<string>();
  const re = /<a href='(\/info\/(\d+)\?c=(\d+))' aria-label='View event details for ([^']+)'/g;
  for (const m of html.matchAll(re)) {
    const [, path, infoId, cId, labelRaw] = m;
    if (seen.has(cId)) continue;
    seen.add(cId);
    const label = decodeEntities(labelRaw).replace(/\s+/g, " ").trim();
    const parts = label.split(" - ");
    if (parts.length < 3) continue;
    const park = parts[0].trim();
    let when = parts.slice(2).join(" - ").trim();
    let title = parts[1].trim();
    // Titles can contain " - "; the date clause is always the tail.
    for (let k = parts.length - 1; k >= 2; k--) {
      const tail = parts.slice(k).join(" - ").trim();
      if (/(\w{3} \d{1,2}, \d{4})/.test(tail)) {
        title = parts.slice(1, k).join(" - ").trim();
        when = tail;
        break;
      }
    }
    let y = 0, mo = 0, d = 0;
    let startClock: [number, number] | null = null;
    let endClock: [number, number] | null = null;
    const single = when.match(/^(?:\w+day, )?(\w{3}) (\d{1,2}), (\d{4})\s*(.*)$/);
    const ranged = label.match(/-\s+([\d:]+ ?[AP]M|Noon)\s*-\s*([\d:]+ ?[AP]M|Noon)\s+from\s+(\w{3}) (\d{1,2}), (\d{4})/i);
    if (ranged) {
      startClock = parseClock(ranged[1]);
      endClock = parseClock(ranged[2]);
      mo = MONTH_INDEX[ranged[3].toLowerCase()] ?? 0;
      d = Number(ranged[4]);
      y = Number(ranged[5]);
    } else if (single) {
      mo = MONTH_INDEX[single[1].toLowerCase()] ?? 0;
      d = Number(single[2]);
      y = Number(single[3]);
      const times = single[4].match(/([\d:]+ ?[AP]M|Noon)(?:\s*to\s*([\d:]+ ?[AP]M|Noon))?/i);
      if (times) {
        startClock = parseClock(times[1]);
        endClock = times[2] ? parseClock(times[2]) : null;
      }
    }
    if (!y || !mo || !d) continue;
    const coords = parks[park];
    if (!coords) continue;
    const allDay = !startClock;
    const startMs = zonedToUtcMs(y, mo, d, startClock?.[0] ?? 0, startClock?.[1] ?? 0, tz);
    let endMs = endClock ? zonedToUtcMs(y, mo, d, endClock[0], endClock[1], tz) : null;
    if (endMs != null && endMs <= startMs) endMs = null;
    out.push({
      id: `gaparks:${cId}`,
      title,
      startMs,
      endMs,
      allDay,
      multiDay: false,
      venue: park,
      city: "",
      lat: coords[0],
      lon: coords[1],
      url: `https://explore.gastateparks.org${path}`,
      image: null,
      organizer: "Georgia State Parks",
      sourceId: "gaparks",
      category: inferCategory(title) === "community" ? "outdoors" : inferCategory(title),
      free: null,
      summary: "",
    });
    void infoId;
  }
  return out;
}

/* ------------------------------------------------------------ The Pal Theatre */

const LONG_MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
const PAL_DATE = new RegExp(
  `^(?:\\w+day, )?(${LONG_MONTHS}) (\\d{1,2})(?:st|nd|rd|th)?(?:, (\\d{4}))?\\s*\\|\\s*(.+)$`,
  "i",
);

/** "5-6:30PM" -> 17:00, "1PM & 6PM" -> 13:00, "7:00 PM" -> 19:00 */
export function palClock(raw: string): [number, number] | null {
  const t = raw.trim();
  const range = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*([ap]m)/i);
  if (range) return parseClock(`${range[1]}:${range[2] ?? "00"} ${range[3] || range[4]}`);
  const first = t.match(/(\d{1,2}(?::\d{2})?)\s*([ap]m)/i);
  return first ? parseClock(`${first[1]} ${first[2]}`) : null;
}

/**
 * The Pal's own "Shows & Events" page lists each show as: title line(s),
 * a "Saturday, October 24th | 5:30PM" line, a blurb, then "Tickets".
 * A missing year means the next occurrence of that date.
 */
export function parsePalShows(html: string, nowMs: number, tz = DEFAULT_TZ): PublicEvent[] {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  const lines = decodeEntities(body.replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const nowYear = partsIn(nowMs, tz).y;
  const out: PublicEvent[] = [];
  let titleBuf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^tickets$/i.test(line)) {
      titleBuf = [];
      continue;
    }
    const m = line.match(PAL_DATE);
    if (!m) {
      titleBuf.push(line);
      if (titleBuf.length > 3) titleBuf.shift();
      continue;
    }
    // Two-line titles end the first line with a colon ("Guys Night Out:" / "Street Fighter").
    const tail = titleBuf.slice(-2);
    const title = (tail.length === 2 && /:\s*$/.test(tail[0]) ? tail.join(" ") : tail[tail.length - 1] || "")
      .replace(/:\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    const mo = LONG_MONTHS.split("|").indexOf(m[1].toLowerCase()) + 1;
    const d = Number(m[2]);
    let y = m[3] ? Number(m[3]) : nowYear;
    const clock = palClock(m[4]);
    let startMs = zonedToUtcMs(y, mo, d, clock?.[0] ?? 19, clock?.[1] ?? 0, tz);
    if (!m[3] && startMs < nowMs - 60 * 24 * 3600 * 1000) {
      y += 1;
      startMs = zonedToUtcMs(y, mo, d, clock?.[0] ?? 19, clock?.[1] ?? 0, tz);
    }
    const next = lines[i + 1] && !PAL_DATE.test(lines[i + 1]) && !/^tickets$/i.test(lines[i + 1]) ? lines[i + 1] : "";
    if (title && title.length < 120 && !/discover exciting events|stay updated/i.test(title)) {
      out.push({
        id: `pal:${y}-${mo}-${d}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        title,
        startMs,
        endMs: null,
        allDay: false,
        multiDay: false,
        venue: "The Pal Theatre",
        city: "Vidalia",
        lat: 32.2177,
        lon: -82.4134,
        url: "https://thepaltheatre.com/shows-events/",
        image: null,
        organizer: "The Pal Theatre",
        sourceId: "pal",
        category: inferCategory(title) === "community" ? "arts" : inferCategory(title),
        free: /\bfree\b/i.test(next) ? true : null,
        summary: clip(next, 180),
      });
    }
    // A show can list a second date line right after the first ("October 31st | 1PM & 6PM").
    if (lines[i + 1] && PAL_DATE.test(lines[i + 1])) continue;
    titleBuf = [];
  }
  return out;
}
