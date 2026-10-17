/**
 * The home page's one-line "This weekend:" intro. Pure, so it is tested.
 *
 * Saturday and Sunday only, local first (within 15 mi), at most two items,
 * written the way a neighbor would say it: "This weekend: Saturday dads'
 * coffee and Sunday pickleball at the Rec Complex, plus 14 more nearby."
 */
import { DEFAULT_TZ } from "./time";
import type { PublicEvent } from "./types";

const LOCAL_MI = 15;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PLACE_WORD = /\b(complex|park|center|centre|field|hall|library|theat(er|re)|stadium|church|square|plaza|pavilion|courts?|gym(nasium)?|arena)\b/i;
const MAX_CHARS = 40;

function weekday(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(ms);
}

/** "Vidalia dads — Saturday coffee" → "dads’ coffee"; "Outdoor pickleball — Rec Complex" → "pickleball at the Rec Complex". */
export function shortPhrase(title: string, town: string): string {
  let t = title.replace(/\s*\([^)]*\)/g, " "); // "(bluegrass festival)", "(Exhibition)"
  // "Vidalia dads" → "dads", but "Atlanta Run Club" is a name and keeps its town.
  const lead = `${town} `;
  if (t.toLowerCase().startsWith(lead.toLowerCase()) && /^[a-z]/.test(t.slice(lead.length))) t = t.slice(lead.length);
  t = t.replace(new RegExp(`\\b(${WEEKDAYS.join("|")})s?\\b`, "gi"), "").replace(/^\s*outdoor\s+/i, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  const parts = t.split(/\s+[—–-]\s+|:\s+/).map((x) => x.trim()).filter(Boolean);
  let phrase = parts[0] || t;
  if (parts.length > 1) {
    if (PLACE_WORD.test(parts[1])) phrase = `${phrase} at the ${parts[1].replace(/^the\s+/i, "")}`;
    else if (phrase.split(" ").length === 1) phrase = /s$/i.test(phrase) ? `${phrase}’ ${parts[1]}` : `${phrase} ${parts[1]}`;
  }
  // A long "Team vs Opponent" keeps the team: "Brewton-Parker Women's Soccer".
  if (phrase.length > MAX_CHARS && /\s+vs\.?\s+/i.test(phrase)) phrase = phrase.split(/\s+vs\.?\s+/i)[0];
  // Other over-long names: cut at a word boundary, never mid-word, and drop a dangling "vs"/"and".
  if (phrase.length > MAX_CHARS) {
    const words = phrase.split(" ");
    let out = "";
    for (const w of words) {
      if ((out ? `${out} ${w}` : w).length > MAX_CHARS) break;
      out = out ? `${out} ${w}` : w;
    }
    phrase = out.replace(/\s+(vs\.?|and|&|of|the|at|with)$/i, "");
  }
  // "Saturday coffee" style: a capitalized first word over lowercase words reads better lowercased.
  const [first, ...rest] = phrase.split(" ");
  if (/^[A-Z][a-z]+$/.test(first) && rest.length && rest.every((w) => w === w.toLowerCase())) phrase = [first.toLowerCase(), ...rest].join(" ");
  return phrase.trim();
}

/** Saturday or Sunday, or already running into the weekend (then "through Sun"). */
function weekendPick(e: PublicEvent, nowMs: number, tz: string): { day: string; running: boolean } | null {
  const running = e.multiDay && e.startMs < nowMs && (e.endMs ?? 0) > nowMs;
  if (running) return { day: "", running: true };
  const day = weekday(Math.max(e.startMs, nowMs), tz);
  return day === "Saturday" || day === "Sunday" ? { day, running: false } : null;
}

function tier(e: PublicEvent): number {
  const d = e.distanceMi ?? 0;
  return d < 1 ? 0 : d <= LOCAL_MI ? 1 : 2;
}

export function weekendLede(
  events: PublicEvent[],
  town: string,
  nowMs = Date.now(),
  tz = DEFAULT_TZ,
): string {
  if (!events.length) return "Festivals, shows, park days, and neighbor gatherings in and around town. Pick one and go say hello.";
  const candidates = events
    .map((e, i) => ({ e, i, w: weekendPick(e, nowMs, tz) }))
    .filter((c): c is { e: PublicEvent; i: number; w: { day: string; running: boolean } } => c.w !== null)
    // In town first (board posts, under a mile), then within 15 mi, then the rest; feed order within each.
    .sort((a, b) => tier(a.e) - tier(b.e) || a.i - b.i)
    .slice(0, 2);
  if (!candidates.length) return `This weekend: ${events.length} ${events.length === 1 ? "thing" : "things"} to do nearby.`;
  const pick = (c: (typeof candidates)[number]) => {
    const p = shortPhrase(c.e.title, town);
    if (!c.w.running) return `${c.w.day} ${p}`;
    const end = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format((c.e.endMs ?? nowMs) - 1);
    return `${p} through ${end}`;
  };
  // Same day twice reads "Saturday X and Y", not "Saturday X and Saturday Y".
  const [a, b] = candidates;
  const list = !b
    ? pick(a)
    : !a.w.running && !b.w.running && a.w.day === b.w.day
      ? `${pick(a)} and ${shortPhrase(b.e.title, town)}`
      : `${pick(a)} and ${pick(b)}`;
  const rest = events.length - candidates.length;
  return `This weekend: ${list}${rest > 0 ? `, plus ${rest} more nearby` : ""}.`;
}
