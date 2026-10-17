import { haversineMiles } from "./geo";
import { runSources } from "./sources";
import { DEFAULT_TZ, effectiveEndMs, localDateKey, overlapsWindow, weekendWindow, type WeekendWindow } from "./time";
import type { EventSearchResult, PublicEvent } from "./types";

export const RADIUS_CHOICES = [10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_MI = 25;

export function normalizeRadius(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS_MI;
  return Math.min(150, Math.max(5, Math.round(n)));
}

/** How far the "a short drive away" ring reaches for a given radius. */
export function wideRadiusFor(radiusMi: number): number {
  return Math.min(150, Math.max(60, Math.round(radiusMi * 2.5)));
}

function windowOut(w: WeekendWindow) {
  return {
    label: w.label,
    startIso: new Date(w.startMs).toISOString(),
    endIso: new Date(w.endMs).toISOString(),
    friKey: w.friKey,
    sunKey: w.sunKey,
    tz: w.tz,
  };
}

function dedupeKey(e: PublicEvent, tz: string): string {
  const t = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 48);
  return `${t}|${localDateKey(e.startMs, tz)}|${e.lat?.toFixed(2)},${e.lon?.toFixed(2)}`;
}

/** Day it shows under, timed before all-day/ongoing, then time, then distance. */
function sortForWindow(list: PublicEvent[], w: WeekendWindow, tz: string): PublicEvent[] {
  const dayOf = (e: PublicEvent) => localDateKey(Math.max(e.startMs, w.startMs), tz);
  return list.sort((a, b) => {
    const da = dayOf(a), db = dayOf(b);
    if (da !== db) return da < db ? -1 : 1;
    const oa = a.allDay || a.multiDay ? 1 : 0;
    const ob = b.allDay || b.multiDay ? 1 : 0;
    if (oa !== ob) return oa - ob;
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    return (a.distanceMi ?? 0) - (b.distanceMi ?? 0);
  });
}

/** A daily gallery or repeating show appears once, with its other days listed. */
function collapseRepeats(list: PublicEvent[], tz: string): PublicEvent[] {
  const byKey = new Map<string, PublicEvent>();
  const out: PublicEvent[] = [];
  for (const e of list) {
    const k = `${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "")}|${e.venue.toLowerCase()}`;
    const first = byKey.get(k);
    if (!first) {
      const copy = { ...e, alsoOn: [] as string[] };
      byKey.set(k, copy);
      out.push(copy);
      continue;
    }
    const day = localDateKey(e.startMs, tz);
    if (day !== localDateKey(first.startMs, tz) && !first.alsoOn!.includes(day)) first.alsoOn!.push(day);
  }
  return out;
}

/**
 * One event listed once per venue (a game-watch party at 3 bars, a chain-wide
 * class) becomes one card: the closest venue leads, the rest ride along.
 */
export function groupMultiVenue(list: PublicEvent[]): PublicEvent[] {
  const byKey = new Map<string, PublicEvent>();
  const sorted = [...list].sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0));
  for (const e of sorted) {
    const k = `${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 64)}|${Math.round(e.startMs / 60000)}`;
    const lead = byKey.get(k);
    if (!lead) {
      byKey.set(k, { ...e, otherPlaces: [] });
      continue;
    }
    if (lead.venue.toLowerCase() === e.venue.toLowerCase()) continue;
    if (lead.otherPlaces!.some((p) => p.venue.toLowerCase() === e.venue.toLowerCase())) continue;
    lead.otherPlaces!.push({ id: e.id, venue: e.venue, city: e.city, distanceMi: e.distanceMi, url: e.url });
  }
  return [...byKey.values()].map((e) => (e.otherPlaces!.length ? e : { ...e, otherPlaces: undefined }));
}

/**
 * Real public events for this weekend around a point.
 *
 * `events`   — this weekend, within the radius.
 * `nearby`   — this weekend, radius … wide radius (the honest "a short drive" answer).
 * `nextWeekend` — next weekend within the wide radius, for when this one is thin.
 * `extra` lets the caller fold in the town's own neighbor-board listings.
 */
export async function searchPublicEvents(opts: {
  lat: number;
  lon: number;
  label: string;
  zip?: string;
  radiusMi?: number;
  nowMs?: number;
  tz?: string;
  extra?: PublicEvent[];
}): Promise<EventSearchResult> {
  const tz = opts.tz || DEFAULT_TZ;
  const nowMs = opts.nowMs ?? Date.now();
  const radiusMi = normalizeRadius(opts.radiusMi);
  const wideMi = wideRadiusFor(radiusMi);
  const w = weekendWindow(nowMs, tz, 0);
  const w2 = weekendWindow(nowMs, tz, 1);

  const runs = await runSources({ lat: opts.lat, lon: opts.lon, wideMi, fromKey: w.friKey, toKey: w2.sunKey, tz });
  const pool: PublicEvent[] = [...(opts.extra ?? []), ...runs.flatMap((r) => r.events)];

  const seen = new Set<string>();
  const located: PublicEvent[] = [];
  for (const e of pool) {
    if (e.lat == null || e.lon == null || !Number.isFinite(e.startMs)) continue;
    const key = dedupeKey(e, tz);
    if (seen.has(key)) continue;
    seen.add(key);
    located.push({ ...e, distanceMi: Math.round(haversineMiles(opts.lat, opts.lon, e.lat, e.lon) * 10) / 10 });
  }

  // A months-long exhibit is not "this weekend" news; keep multi-day things under ~2 weeks.
  const reasonable = located.filter((e) => effectiveEndMs(e) - e.startMs < 16 * 24 * 3600 * 1000);
  const thisWeekend = groupMultiVenue(reasonable.filter((e) => overlapsWindow(e, w, nowMs)));
  const events = collapseRepeats(sortForWindow(thisWeekend.filter((e) => (e.distanceMi ?? 0) <= radiusMi), w, tz), tz).slice(0, 80);
  const nearby = collapseRepeats(
    sortForWindow(
      thisWeekend.filter((e) => (e.distanceMi ?? 0) > radiusMi && (e.distanceMi ?? 0) <= wideMi),
      w,
      tz,
    ),
    tz,
  ).slice(0, 30);
  const nextWeekend = collapseRepeats(
    sortForWindow(
      groupMultiVenue(reasonable.filter((e) => overlapsWindow(e, w2, nowMs) && (e.distanceMi ?? 0) <= wideMi)),
      w2,
      tz,
    ),
    tz,
  ).slice(0, 30);

  return {
    place: { label: opts.label, lat: opts.lat, lon: opts.lon, zip: opts.zip || "" },
    radiusMi,
    wideRadiusMi: wideMi,
    window: windowOut(w),
    nextWindow: windowOut(w2),
    events,
    nearby,
    nextWeekend,
    sources: runs
      .filter((r) => r.def.url)
      .map((r) => ({ id: r.def.id, name: r.def.name, url: r.def.url, status: r.status, count: r.events.length })),
    generatedAt: new Date(nowMs).toISOString(),
  };
}
