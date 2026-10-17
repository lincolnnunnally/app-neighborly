/**
 * Timezone-safe calendar math for "this weekend".
 *
 * Everything here works on the *local wall clock of the place* (default
 * America/New_York), never on the server's clock. Vercel functions run in UTC,
 * so `new Date().getDay()` after 8pm Eastern on a Friday already says Saturday —
 * that is the off-by-one this module exists to prevent.
 *
 * Pure: no imports, safe to unit-test with `node --test`.
 */

export const DEFAULT_TZ = "America/New_York";
const DAY_MS = 24 * 3600 * 1000;

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function partsIn(ms: number, tz = DEFAULT_TZ): Parts {
  const out: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { y: out.year, m: out.month, d: out.day, h: out.hour % 24, mi: out.minute, s: out.second };
}

/** Minutes the zone is ahead of UTC at that instant (Eastern daylight = -240). */
export function tzOffsetMinutes(ms: number, tz = DEFAULT_TZ): number {
  const p = partsIn(ms, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Local wall time in `tz` -> UTC epoch ms (DST-correct). */
export function zonedToUtcMs(y: number, m: number, d: number, h = 0, mi = 0, tz = DEFAULT_TZ): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = tzOffsetMinutes(guess, tz);
  let t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(t, tz);
  if (off2 !== off1) t = guess - off2 * 60000;
  return t;
}

export function localDateKey(ms: number, tz = DEFAULT_TZ): string {
  const p = partsIn(ms, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function splitKey(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y, m, d];
}

/** Pure calendar arithmetic on a YYYY-MM-DD key (no timezone involved). */
export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = splitKey(key);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return t.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday for a calendar date. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = splitKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function keyStartMs(key: string, tz = DEFAULT_TZ, hour = 0, minute = 0): number {
  const [y, m, d] = splitKey(key);
  return zonedToUtcMs(y, m, d, hour, minute, tz);
}

export type WeekendWindow = {
  /** Friday 5:00pm local, as UTC ms. */
  startMs: number;
  /** Monday 12:00am local, as UTC ms (exclusive). */
  endMs: number;
  friKey: string;
  sunKey: string;
  tz: string;
  /** "Fri, Oct 16 – Sun, Oct 18" */
  label: string;
};

/**
 * The weekend that matters right now: Friday 5pm through Sunday night, in the
 * place's own timezone. Mon–Thu look ahead to the coming Friday; Fri–Sun mean
 * the weekend you are already in. `weeksAhead = 1` gives next weekend.
 */
export function weekendWindow(nowMs: number, tz = DEFAULT_TZ, weeksAhead = 0): WeekendWindow {
  const today = localDateKey(nowMs, tz);
  const wd = weekdayOfKey(today);
  const back = wd === 5 ? 0 : wd === 6 ? 1 : wd === 0 ? 2 : -(5 - wd);
  const friKey = addDaysKey(today, -back + 7 * weeksAhead);
  const sunKey = addDaysKey(friKey, 2);
  const startMs = keyStartMs(friKey, tz, 17, 0);
  const endMs = keyStartMs(addDaysKey(friKey, 3), tz, 0, 0);
  return { startMs, endMs, friKey, sunKey, tz, label: rangeLabel(friKey, sunKey) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function shortDayLabel(key: string): string {
  const [, m, d] = splitKey(key);
  return `${DAYS[weekdayOfKey(key)]}, ${MONTHS[m - 1]} ${d}`;
}

export function rangeLabel(fromKey: string, toKey: string): string {
  return `${shortDayLabel(fromKey)} – ${shortDayLabel(toKey)}`;
}

/**
 * "2026-10-17 10:00:00" (a source's local wall time, no offset) -> UTC ms.
 * Strings that already carry Z or ±hh:mm are parsed as-is.
 */
export function parseWallTime(raw: string, tz = DEFAULT_TZ): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s.replace(" ", "T"));
    return Number.isFinite(t) ? t : null;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (!m) return null;
  return zonedToUtcMs(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), tz);
}

export type TimedThing = { startMs: number; endMs: number | null; allDay: boolean };

/** Assumed length when a source gives no end time. */
export const DEFAULT_EVENT_MS = 2 * 3600 * 1000;

export function effectiveEndMs(e: TimedThing): number {
  if (e.endMs && e.endMs > e.startMs) return e.endMs;
  return e.startMs + (e.allDay ? DAY_MS : DEFAULT_EVENT_MS);
}

/**
 * Does the event overlap the window and is it not already over?
 * `nowMs` hides things that ended earlier today; it never hides an event that
 * is still running.
 */
export function overlapsWindow(e: TimedThing, w: { startMs: number; endMs: number }, nowMs: number): boolean {
  const end = effectiveEndMs(e);
  const from = Math.max(w.startMs, nowMs);
  return e.startMs < w.endMs && end > from;
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/**
 * A listing that is one day of a longer run ("…at the Laurens County Library,
 * September 21st to October 31st") says so on the card, so the card's date and
 * the description agree: "Runs Sep 21 – Oct 31". Null unless the text names a
 * range that contains the listed day.
 */
export function runsLabel(text: string, startMs: number, tz = DEFAULT_TZ): string | null {
  const re = new RegExp(
    `\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|thru|until|-|–|—)\\s*(?:${MONTH_RE}\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`,
    "i",
  );
  const m = String(text || "").match(re);
  if (!m) return null;
  const m1 = MONTH_NAMES.indexOf(m[1].slice(0, 3).toLowerCase());
  const m2 = m[3] ? MONTH_NAMES.indexOf(m[3].slice(0, 3).toLowerCase()) : m1;
  const d1 = Number(m[2]);
  const d2 = Number(m[4]);
  if (m1 < 0 || m2 < 0 || d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) return null;
  const p = partsIn(startMs, tz);
  const day = p.m * 100 + p.d;
  const from = (m1 + 1) * 100 + d1;
  const to = (m2 + 1) * 100 + d2;
  if (to <= from || day < from || day > to) return null;
  const label = (mo: number, d: number) => `${MONTH_NAMES[mo][0].toUpperCase()}${MONTH_NAMES[mo].slice(1)} ${d}`;
  return `Runs ${label(m1, d1)} – ${label(m2, d2)}`;
}
