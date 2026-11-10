/**
 * Parsers for the small-town and college sources around Vidalia / Statesboro /
 * Dublin. Same rules as parse.ts: pure, fixture-tested, and every event links
 * back to the page that lists it.
 */
import { decodeEntities, inferCategory, stripHtml } from "./parse";
import { addDaysKey, DEFAULT_TZ, keyStartMs, parseWallTime, weekdayOfKey } from "./time";
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

/**
 * Season schedule pages we checked in a real browser (Oct 17, 2026): each one
 * renders its games with dates. A slug that only looks right can render an
 * empty template instead ("/sports/womens-rifle/schedule" shows
 * "@season @sport Schedule"), so the slug derived from a title must map to a
 * page on this list. `aliases` maps the title's sport to the site's own slug.
 */
export const SIDEARM_SCHEDULES: Record<string, { aliases: Record<string, string>; pages: string[] }> = {
  "gseagles.com": {
    aliases: { "womens-rifle": "rifle", rifle: "rifle", volleyball: "womens-volleyball", "mens-golf": "golf", "track-and-field-xc": "cross-country" },
    pages: [
      "baseball", "cross-country", "football", "golf", "mens-basketball", "mens-soccer", "mens-tennis", "rifle", "softball",
      "swimming-and-diving", "womens-basketball", "womens-golf", "womens-soccer", "womens-tennis", "womens-volleyball",
    ],
  },
  "bpcuathletics.com": {
    aliases: { volleyball: "womens-volleyball", wrestling: "mens-wrestling", "competition-cheer": "competitive-cheer" },
    pages: [
      "baseball", "bass-fishing", "competitive-cheer", "esports", "jv-baseball", "jv-mens-basketball", "jv-mens-soccer",
      "mens-basketball", "mens-cross-country", "mens-golf", "mens-soccer", "mens-track-and-field", "mens-wrestling",
      "powerlifting", "softball", "womens-basketball", "womens-beach-volleyball", "womens-cross-country",
      "womens-flag-football", "womens-soccer", "womens-track-and-field", "womens-volleyball", "womens-wrestling",
    ],
  },
};

/**
 * Link to the sport's season schedule ("/sports/womens-soccer/schedule"): it
 * renders every game with its date on the page itself, unlike the composite
 * calendar, which fills in by script. Null when the site has no checked page
 * for the sport; the caller drops the game rather than link a broken page.
 */
export function sidearmScheduleUrl(title: string, o: Pick<SidearmOptions, "publicHost" | "shortName">): string | null {
  const school = o.shortName?.[1];
  if (!school || !title.startsWith(school)) return null;
  // "Baseball vs Winthrop", "Men's Golf  Schenkel Invitational" (two spaces before a meet name).
  const sport = title.slice(school.length).split(/\s+vs\.?\s+|\s{2,}/i).map((p) => p.trim()).filter(Boolean)[0] ?? "";
  if (!sport || sport.length > 40) return null;
  const derived = sport.toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!derived) return null;
  const site = SIDEARM_SCHEDULES[o.publicHost];
  if (!site) return `https://${o.publicHost}/sports/${derived}/schedule`;
  const slug = site.aliases[derived] ?? derived;
  return site.pages.includes(slug) ? `https://${o.publicHost}/sports/${slug}/schedule` : null;
}

function gamePageUrl(raw: string, host: string): string {
  try {
    const u = new URL(raw);
    u.host = host;
    return u.toString();
  } catch {
    return `https://${host}/calendar`;
  }
}

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
    // Game pages ("calendar.aspx?game_id=") render no game details, so a game
    // with no checked schedule page is left out.
    const url = SIDEARM_SCHEDULES[o.publicHost] ? sidearmScheduleUrl(title, o) : (sidearmScheduleUrl(title, o) ?? gamePageUrl(e.url, o.publicHost));
    if (!url) continue;
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

/* ------------------------------------- Revize city and library calendars */

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/**
 * The days a repeating calendar entry lands on inside [fromKey, toKey].
 * `start` is the first occurrence in local wall time ("2025-08-05T11:00:00").
 * Covers what these calendars use: DAILY, WEEKLY (BYDAY) and MONTHLY (BYDAY with
 * BYSETPOS, or the same day of the month), with INTERVAL, UNTIL, COUNT and
 * EXDATE. A rule we do not read (YEARLY: holiday closings) gives no days, so a
 * date is never guessed.
 */
export function recurrenceDays(start: string, rrule: string, fromKey: string, toKey: string): string[] {
  const rule = String(rrule || "").match(/RRULE:([^\r\n]+)/)?.[1];
  const m0 = String(start || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!rule || !m0) return [];
  const p: Record<string, string> = {};
  for (const kv of rule.trim().split(";")) {
    const [k, v] = kv.split("=");
    if (k && v) p[k.toUpperCase()] = v.toUpperCase();
  }
  const freq = p.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return [];
  const startKey = `${m0[1]}-${m0[2]}-${m0[3]}`;
  const clock = `${m0[4] ?? "00"}${m0[5] ?? "00"}${m0[6] ?? "00"}`;
  const interval = Math.max(1, Number(p.INTERVAL) || 1);
  const until = p.UNTIL ? (p.UNTIL.includes("T") ? p.UNTIL.replace("Z", "") : `${p.UNTIL}T235959`) : "";
  const count = Number(p.COUNT) || Infinity;
  const skip = new Set([...String(rrule).matchAll(/EXDATE[^:\r\n]*:(\d{4})(\d{2})(\d{2})/g)].map((x) => `${x[1]}-${x[2]}-${x[3]}`));
  const byDay = (p.BYDAY || "").split(",").filter(Boolean);
  const days = byDay.length ? byDay.map((d) => RRULE_DAYS.indexOf(d.slice(-2))) : [weekdayOfKey(startKey)];
  const pos = Number(p.BYSETPOS) || parseInt(byDay[0] ?? "", 10) || 0;
  const day0 = dayNumber(startKey);
  const sinceMonday = (weekdayOfKey(startKey) + 6) % 7;
  const out: string[] = [];
  let seen = 0;
  // Day by day from the first occurrence, so COUNT is honest. Bounded: ~11 years.
  for (let key = startKey, i = 0; key <= toKey && i < 4000; key = addDaysKey(key, 1), i++) {
    const since = dayNumber(key) - day0;
    const wd = weekdayOfKey(key);
    let hit = false;
    if (freq === "DAILY") hit = since % interval === 0;
    else if (freq === "WEEKLY") hit = days.includes(wd) && Math.floor((since + sinceMonday) / 7) % interval === 0;
    else {
      const [y, mo, d] = key.split("-").map(Number);
      const months = (y - Number(m0[1])) * 12 + (mo - Number(m0[2]));
      if (months % interval === 0) {
        if (!byDay.length) hit = d === Number(m0[3]);
        else if (days.includes(wd)) {
          const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
          hit = pos > 0 ? Math.ceil(d / 7) === pos : pos < 0 ? Math.ceil((daysInMonth - d + 1) / 7) === -pos : true;
        }
      }
    }
    if (!hit) continue;
    if (until && `${key.replace(/-/g, "")}T${clock}` > until) break;
    if (++seen > count) break;
    if (key >= fromKey && !skip.has(key)) out.push(key);
  }
  return out;
}

export type RevizeRaw = {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  url?: string;
  desc?: string;
  rrule?: string;
  primary_calendar_name?: string;
};

export type RevizePlace = { venue: string; city: string; lat: number; lon: number };

export type RevizeOptions = Origin & {
  /** The public calendar page; an entry without its own link points here. */
  url: string;
  /** Titles that are not outings (meetings, closings, the vendor's sample entries). */
  drop?: RegExp;
  /**
   * A system with several buildings: calendar name -> where that building is.
   * When given, an entry on any other calendar is dropped.
   */
  calendars?: Record<string, RevizePlace>;
};

function safeDecodeUri(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Revize (a city-website vendor) serves a site's whole calendar as one JSON
 * list: local wall times, optional RRULE text, URL-encoded HTML descriptions.
 * Only occurrences inside [fromKey, toKey] come back.
 */
export function parseRevize(json: unknown, o: RevizeOptions, fromKey: string, toKey: string, tz = DEFAULT_TZ): PublicEvent[] {
  const out: PublicEvent[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(json) ? (json as RevizeRaw[]) : []) {
    const title = stripHtml(String(raw?.title ?? ""));
    const start = String(raw?.start ?? "");
    const sm = start.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!title || !sm || o.drop?.test(title)) continue;
    const place = o.calendars ? o.calendars[String(raw.primary_calendar_name ?? "")] : undefined;
    if (o.calendars && !place) continue;
    const allDay = raw.allDay === true || !sm[2];
    const startMs0 = parseWallTime(start.replace("T", " ").slice(0, 16), tz);
    const endMs0 = raw.end ? parseWallTime(String(raw.end).replace("T", " ").slice(0, 16), tz) : null;
    if (startMs0 == null) continue;
    const lengthMs = endMs0 != null && endMs0 > startMs0 ? endMs0 - startMs0 : 0;
    const endKey = raw.end ? String(raw.end).slice(0, 10) : sm[1];
    const dayKeys = raw.rrule ? recurrenceDays(start, raw.rrule, fromKey, toKey) : endKey >= fromKey && sm[1] <= toKey ? [sm[1]] : [];
    const location = stripHtml(String(raw.location ?? ""));
    const link = String(raw.url ?? "").trim();
    const summary = stripHtml(safeDecodeUri(String(raw.desc ?? "")));
    for (const key of dayKeys) {
      const startMs = allDay ? keyStartMs(key, tz) : keyStartMs(key, tz, Number(sm[2]), Number(sm[3]));
      const id = `${o.id}:${raw.id ?? title}:${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        title,
        startMs,
        endMs: lengthMs && !allDay ? startMs + lengthMs : null,
        allDay,
        multiDay: lengthMs > 26 * 3600 * 1000,
        venue: place?.venue || location || o.organizer,
        city: place?.city || o.city,
        lat: place?.lat ?? o.lat,
        lon: place?.lon ?? o.lon,
        url: /^https?:\/\/[^\s]+$/i.test(link) ? link : o.url,
        image: null,
        organizer: o.organizer,
        sourceId: o.id,
        category: inferCategory(title, summary),
        free: null,
        summary: summary.length > 280 ? `${summary.slice(0, 279).trimEnd()}…` : summary,
      });
    }
  }
  return out;
}

/** City-hall calendars mix public events with meetings, office holidays and the vendor's sample rows. */
export const NOT_A_TOWN_OUTING =
  /\b(meeting|mtg|council|commission(ers)?|authority|board of \w+|committee|hearing|work session|training|closed|good friday|ribbon cutting|professional development|gvyl|lgv|event title\w*)\b|^revize\b/i;

/* --------------------------------- All-in-One Event Calendar (month page) */

export type Ai1ecOptions = Origin & {
  /** Where an event is when its "@ place" names another town we know. */
  places?: { match: RegExp; city: string; lat: number; lon: number }[];
  drop?: RegExp;
};

const SHORT_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function clock12(h: string, mi: string, ap: string): [number, number] {
  return [(Number(h) % 12) + (/p/i.test(ap) ? 12 : 0), Number(mi)];
}

/**
 * The calendar's own month page: one cell per day, each event with a popup that
 * carries its title, "@ place" and "Nov 7 @ 9:00 am – 12:30 pm" (or "all-day").
 * The year comes from the day cell's link; the event links to its own page.
 */
export function parseAi1ecMonth(html: string, o: Ai1ecOptions, tz = DEFAULT_TZ): PublicEvent[] {
  const out: PublicEvent[] = [];
  const seen = new Set<string>();
  for (const cell of decodeEntities(String(html || "")).split(/<div class="ai1ec-date">/).slice(1)) {
    const dm = cell.match(/exact_date~(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!dm) continue;
    for (const pop of cell.split(/<span class="ai1ec-popup-title">/).slice(1)) {
      const a = pop.match(/<a class="ai1ec-load-event"\s+href="([^"]+)"\s*>([\s\S]*?)<\/a>/);
      const when = stripHtml(pop.match(/<div class="ai1ec-event-time">([\s\S]*?)<\/div>/)?.[1] ?? "");
      const title = stripHtml(a?.[2] ?? "");
      if (!a || !title || !when || o.drop?.test(title)) continue;
      // A multi-day event is listed again on each day; the popup names the day it starts.
      const first = when.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2})\b/);
      const month = first ? SHORT_MONTHS.indexOf(first[1].toLowerCase()) + 1 : 0;
      if (!first || !month) continue;
      const year = month > Number(dm[2]) + 6 ? Number(dm[3]) - 1 : month < Number(dm[2]) - 6 ? Number(dm[3]) + 1 : Number(dm[3]);
      const key = `${year}-${pad(month)}-${pad(Number(first[2]))}`;
      const id = `${o.id}:${a[1].match(/instance_id=(\d+)/)?.[1] ?? `${title}|${key}`}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = when.match(/@\s*(\d{1,2}):(\d{2})\s*([ap]m)(?:\s*[–-]\s*(?:(\d{1,2}):(\d{2})\s*([ap]m)\s*$|.+))?/i);
      const allDay = !t;
      const startMs = t ? keyStartMs(key, tz, ...clock12(t[1], t[2], t[3])) : keyStartMs(key, tz);
      const endSame = t?.[4] ? keyStartMs(key, tz, ...clock12(t[4], t[5], t[6])) : null;
      const venue = stripHtml(pop.match(/<span class="ai1ec-event-location"\s*>([\s\S]*?)<\/span>/)?.[1] ?? "").replace(/^@\s*/, "");
      const place = o.places?.find((x) => x.match.test(venue));
      out.push({
        id,
        title,
        startMs,
        endMs: endSame && endSame > startMs ? endSame : null,
        allDay,
        multiDay: false,
        venue: venue || o.organizer,
        city: place?.city ?? o.city,
        lat: place?.lat ?? o.lat,
        lon: place?.lon ?? o.lon,
        url: a[1],
        image: null,
        organizer: o.organizer,
        sourceId: o.id,
        category: inferCategory(title),
        free: null,
        summary: "",
      });
    }
  }
  return out;
}

/* ------------------------------------------- Community-college filters */

/** Continuing-ed classes, tests and office notices are not weekend outings. */
export const NOT_A_PUBLIC_OUTING =
  /\b(class(es)?|course|test(ing)?|exam|hiset|ged|registration|register|payment|deadline|orientation|advisement|semester|withdraw|drop\/add|financial aid|certification|certificate|cpr|cna|phlebotomy|training|closed|holiday|board meeting|webinar|info(rmation)? session|online|continuing ed(ucation)?|osha|casualty care|first aid|cdl|forklift|welding|hvac|nursing)\b/i;
