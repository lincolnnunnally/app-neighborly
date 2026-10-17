/**
 * Parsers for the small-town and college sources around Vidalia / Statesboro /
 * Dublin. Same rules as parse.ts: pure, fixture-tested, and every event links
 * back to the page that lists it.
 */
import { decodeEntities, inferCategory, stripHtml } from "./parse";
import { addDaysKey, DEFAULT_TZ, keyStartMs, parseWallTime } from "./time";
import type { PublicEvent } from "./types";

type Origin = { id: string; organizer: string; lat: number; lon: number; city: string };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/* ------------------------------------------------- Sidearm athletics ICS */

export type IcsEvent = { uid: string; summary: string; location: string; url: string; start: string; end: string; description: string };

/** RFC 5545 unfold + unescape; enough for the calendars we read. */
export function parseIcs(text: string): IcsEvent[] {
  const unfolded = String(text || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const out: IcsEvent[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const field = (name: string): string => {
      const m = body.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "m"));
      return m ? m[1].replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim() : "";
    };
    out.push({
      uid: field("UID"),
      summary: field("SUMMARY"),
      location: field("LOCATION"),
      url: decodeEntities(field("URL")),
      start: field("DTSTART"),
      end: field("DTEND"),
      description: field("DESCRIPTION"),
    });
  }
  return out;
}

/** 20261016T220000Z -> ms; 20261016 (VALUE=DATE) -> local midnight. */
export function icsTime(raw: string, tz = DEFAULT_TZ): { ms: number; allDay: boolean } | null {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return null;
  if (!m[4]) return { ms: keyStartMs(`${m[1]}-${m[2]}-${m[3]}`, tz), allDay: true };
  const iso = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  const ms = m[7] ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : parseWallTime(iso, tz);
  return ms == null || !Number.isFinite(ms) ? null : { ms, allDay: false };
}

export type SidearmOptions = Origin & {
  /** Location text that means "on our campus" (city or venue names). */
  home: RegExp;
  /** Public site host for links (feeds point at an admin host). */
  publicHost: string;
  /** Long school name -> the short one people say. */
  shortName?: [RegExp, string];
};

const TOWN_ONLY = /^(statesboro|mount vernon|mt\.? vernon)$/i;

/**
 * Home games and hosted meets only — an away game in Boone is not something to
 * do this weekend near Vidalia. "Team at Opponent" is away even when the
 * location is blank; result prefixes like "[L]" are dropped from titles.
 */
export function parseSidearmIcs(text: string, o: SidearmOptions, tz = DEFAULT_TZ): PublicEvent[] {
  const out: PublicEvent[] = [];
  for (const e of parseIcs(text)) {
    if (!e.summary || !e.start) continue;
    if (/\sat\s/i.test(e.summary.replace(/^\[[A-Z]+\]\s*/, ""))) continue;
    const loc = e.location.replace(/\s+/g, " ").trim();
    if (!loc || !o.home.test(loc)) continue;
    const s = icsTime(e.start, tz);
    if (!s) continue;
    const en = e.end ? icsTime(e.end, tz) : null;
    let title = e.summary.replace(/^\[[A-Z]+\]\s*/, "").trim();
    if (o.shortName) title = title.replace(o.shortName[0], o.shortName[1]);
    const venue = loc
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !/^(ga|ga\.|georgia|tbd)$/i.test(p) && !TOWN_ONLY.test(p))
      .join(", ");
    let url = e.url;
    try {
      const u = new URL(url);
      u.host = o.publicHost;
      url = u.toString();
    } catch {
      url = `https://${o.publicHost}/calendar`;
    }
    out.push({
      id: `${o.id}:${e.uid || title}:${s.ms}`,
      title,
      startMs: s.ms,
      endMs: en && en.ms > s.ms ? en.ms : null,
      allDay: s.allDay,
      multiDay: Boolean(en && en.ms - s.ms > 26 * 3600 * 1000),
      venue: venue || o.organizer,
      city: o.city,
      lat: o.lat,
      lon: o.lon,
      url,
      image: null,
      organizer: o.organizer,
      sourceId: o.id,
      category: "sports",
      free: null,
      summary: "",
    });
  }
  return out;
}

/* --------------------------------------------- Averitt Center performances */

/**
 * Each show is a "performance-listing-card": <h4>Title</h4>, then
 * <h3>10/16/2026,</h3><h3>7:30 pm</h3>, and a relative link to its own page.
 */
export function parseAverittPerformances(html: string, o: Origin & { base: string; venue: string }, tz = DEFAULT_TZ): PublicEvent[] {
  const out: PublicEvent[] = [];
  for (const card of String(html || "").split("performance-listing-card").slice(1)) {
    const t = card.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
    const heads = [...card.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => stripHtml(m[1]));
    const date = heads.map((h) => h.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)).find(Boolean);
    if (!t || !date) continue;
    const title = stripHtml(t[1]);
    const clock = heads.map((h) => h.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i)).find(Boolean);
    let h = 0;
    let mi = 0;
    if (clock) {
      h = (Number(clock[1]) % 12) + (clock[3].toLowerCase() === "p" ? 12 : 0);
      mi = Number(clock[2] ?? 0);
    }
    const key = `${date[3]}-${pad(Number(date[1]))}-${pad(Number(date[2]))}`;
    const startMs = keyStartMs(key, tz, h, mi);
    const slug = [...card.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]).find((href) => !/^https?:/i.test(href) && /^[a-z0-9-]+\/?$/i.test(href));
    const url = slug ? `${o.base}/performances/${slug.replace(/\/$/, "")}/` : `${o.base}/performances/`;
    out.push({
      id: `${o.id}:${slug || title}:${startMs}`,
      title,
      startMs,
      endMs: null,
      allDay: !clock,
      multiDay: false,
      venue: o.venue,
      city: o.city,
      lat: o.lat,
      lon: o.lon,
      url,
      image: null,
      organizer: o.organizer,
      sourceId: o.id,
      category: inferCategory(title, "theater performance") === "community" ? "arts" : inferCategory(title, "theater performance"),
      free: null,
      summary: "",
    });
  }
  return out;
}

/* ------------------------------------------ A festival's own dates page */

const RANGE = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})\\s*[-–]\\s*(\\d{1,2}),?\\s+(\\d{4})\\b`, "gi");

/**
 * Small festivals publish no feed, only "October 14-18, 2026" on their own
 * home page. We read the dates from that page on every refresh (never typed in
 * by us), so when the festival moves or ends, the card follows.
 */
export function parseFestivalDates(
  html: string,
  o: Origin & { title: string; venue: string; url: string; category?: PublicEvent["category"] },
  tz = DEFAULT_TZ,
): PublicEvent[] {
  const text = stripHtml(String(html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " "));
  const seen = new Set<string>();
  const out: PublicEvent[] = [];
  for (const m of text.matchAll(RANGE)) {
    const mo = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    const d1 = Number(m[2]);
    const d2 = Number(m[3]);
    if (!mo || d2 < d1 || d2 - d1 > 14) continue;
    const fromKey = `${m[4]}-${pad(mo)}-${pad(d1)}`;
    if (seen.has(fromKey)) continue;
    seen.add(fromKey);
    const toKey = `${m[4]}-${pad(mo)}-${pad(d2)}`;
    const startMs = keyStartMs(fromKey, tz);
    out.push({
      id: `${o.id}:${fromKey}`,
      title: o.title,
      startMs,
      endMs: keyStartMs(addDaysKey(toKey, 1), tz) - 60_000,
      allDay: true,
      multiDay: d2 > d1,
      venue: o.venue,
      city: o.city,
      lat: o.lat,
      lon: o.lon,
      url: o.url,
      image: null,
      organizer: o.organizer,
      sourceId: o.id,
      category: o.category ?? "festival",
      free: null,
      summary: "",
    });
  }
  return out;
}

/* ------------------------------------------- GrowthZone chamber calendars */

/** Calendar page -> detail links; GrowthZone puts the date in the slug. */
export function growthZoneLinks(html: string): { url: string; title: string; dateKey: string }[] {
  const out = new Map<string, { url: string; title: string; dateKey: string }>();
  for (const m of String(html || "").matchAll(/<a[^>]+href="(https?:\/\/[^"]+\/events\/details\/[^"]*?-(\d{2})-(\d{2})-(\d{4})-\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = stripHtml(m[5]);
    if (!title || out.has(m[1])) continue;
    out.set(m[1], { url: m[1], title, dateKey: `${m[4]}-${m[2]}-${m[3]}` });
  }
  return [...out.values()];
}

/** Detail page microdata: itemprop startDate/endDate in local wall time. */
export function parseGrowthZoneDetail(html: string, link: { url: string; title: string }, o: Origin, tz = DEFAULT_TZ): PublicEvent | null {
  const prop = (name: string) => String(html || "").match(new RegExp(`itemprop="${name}"[^>]*content="([^"]+)"`))?.[1] ?? "";
  const start = prop("startDate");
  if (!start) return null;
  const allDay = !/T\d/.test(start);
  const startMs = parseWallTime(start.replace("T", " "), tz);
  if (startMs == null) return null;
  const end = prop("endDate");
  const endMs = end ? parseWallTime(end.replace("T", " "), tz) : null;
  const image = String(html || "").match(/itemprop="image"[^>]*src="([^"]+)"/)?.[1] ?? null;
  const at = link.title.match(/\bat\s+(.+)$/i)?.[1]?.trim();
  return {
    id: `${o.id}:${link.url.split("-").pop()}`,
    title: link.title,
    startMs,
    endMs: endMs && endMs > startMs ? endMs : null,
    allDay,
    multiDay: Boolean(endMs && endMs - startMs > 26 * 3600 * 1000),
    venue: at || o.organizer,
    city: o.city,
    lat: o.lat,
    lon: o.lon,
    url: link.url,
    image,
    organizer: o.organizer,
    sourceId: o.id,
    category: inferCategory(link.title),
    free: null,
    summary: "",
  };
}

/* ------------------------------- "Simple Calendar" (schema.org microdata) */

/**
 * WordPress Simple Calendar renders each event as an <li itemtype=Event> with
 * itemprop name/startDate/endDate (ISO with offset). `keep` picks the public
 * ones (a venue calendar also shows private "Reserved" holds).
 */
export function parseSimpleCalendar(
  html: string,
  o: Origin & { url: string; venue: string; keep: RegExp; title?: string },
): PublicEvent[] {
  const out: PublicEvent[] = [];
  const seen = new Set<string>();
  for (const li of String(html || "").split(/<li class="simcal-event\b/).slice(1)) {
    const body = li.split(/<\/li>/)[0];
    const name = stripHtml(body.match(/itemprop="name"[^>]*>([\s\S]*?)<\//)?.[1] ?? "");
    if (!name || !o.keep.test(name)) continue;
    const start = body.match(/itemprop="startDate"[^>]*content="([^"]+)"/)?.[1];
    const end = body.match(/itemprop="endDate"[^>]*content="([^"]+)"/)?.[1];
    const startMs = start ? Date.parse(start) : NaN;
    if (!Number.isFinite(startMs) || seen.has(`${name}|${startMs}`)) continue;
    seen.add(`${name}|${startMs}`);
    const endMs = end ? Date.parse(end) : NaN;
    const title = o.title || name;
    out.push({
      id: `${o.id}:${startMs}`,
      title,
      startMs,
      endMs: Number.isFinite(endMs) && endMs > startMs ? endMs : null,
      allDay: false,
      multiDay: false,
      venue: o.venue,
      city: o.city,
      lat: o.lat,
      lon: o.lon,
      url: o.url,
      image: null,
      organizer: o.organizer,
      sourceId: o.id,
      category: inferCategory(title, name),
      free: null,
      summary: "",
    });
  }
  return out;
}

/* ------------------------------------------- Community-college filters */

/** Continuing-ed classes, tests and office notices are not weekend outings. */
export const NOT_A_PUBLIC_OUTING =
  /\b(class(es)?|course|test(ing)?|exam|hiset|ged|registration|register|payment|deadline|orientation|advisement|semester|withdraw|drop\/add|financial aid|certification|certificate|cpr|cna|phlebotomy|training|closed|holiday|board meeting|webinar|info(rmation)? session|online)\b/i;
