import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { listBoardEvents, listSisterCityEvents, parseEventStartMs, type BoardEventRow } from "./board-events";
import { ensureSeeded } from "./seed";
import { canViewCommunity } from "./access";
import { isMembersOnlyCommunity } from "./public-filters";
import { findOrCreatePlace, geocodeQuery, resolveCommunityForPlace } from "./place";
import { searchPublicEvents, normalizeRadius } from "@/lib/events/search";
import { inferCategory } from "@/lib/events/parse";
import type { EventSearchResult, PublicEvent } from "@/lib/events/types";
import { scoreFit, splitByFit, type FitPrefs } from "./fit";
import type { Community } from "./types";

const DEFAULT_TZ = "America/New_York";
const VIDALIA_COORDS = { lat: 32.2174, lon: -82.4135 };

/** Known board towns without a stored point (unincorporated or lake areas). */
const TOWN_COORDS: Record<string, { lat: number; lon: number }> = {
  "vidalia,ga": VIDALIA_COORDS,
  "milstead,ga": { lat: 33.6857, lon: -84.0127 },
  "lake sinclair,ga": { lat: 33.1665, lon: -83.2702 },
};

export async function pointFor(c: { lat?: number | null; lon?: number | null; city?: string; state?: string; zip?: string }) {
  if (c.lat != null && c.lon != null) return { lat: Number(c.lat), lon: Number(c.lon) };
  const key = `${(c.city || "").toLowerCase()},${(c.state || "").toLowerCase()}`;
  if (TOWN_COORDS[key]) return TOWN_COORDS[key];
  const q = c.zip || [c.city, c.state].filter(Boolean).join(", ");
  if (q) {
    try {
      const g = await geocodeQuery(q);
      if (g) return { lat: g.lat, lon: g.lon };
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function boardRowToEvent(row: BoardEventRow, community: Community, pt: { lat: number; lon: number }): PublicEvent | null {
  const startMs = parseEventStartMs(row.starts_at);
  if (startMs == null) return null;
  const endMs = row.ends_at ? parseEventStartMs(row.ends_at) : null;
  return {
    id: `board:${row.id}`,
    title: row.title,
    startMs,
    endMs: endMs && endMs > startMs ? endMs : null,
    allDay: false,
    multiDay: false,
    venue: row.location || community.name,
    city: community.city || "",
    lat: pt.lat,
    lon: pt.lon,
    url: `/c/${community.slug}?tab=events`,
    image: null,
    organizer: `${community.name} neighbors`,
    sourceId: "board",
    category: row.kind === "family" ? "family" : inferCategory(row.title, row.description),
    free: null,
    summary: row.description.slice(0, 280),
    rsvpCount: Number(row.rsvp_count ?? 0),
  };
}

/** Live public feed for a point: never throws, returns null if the point is unknown. */
export async function loadEventFeed(opts: {
  point: { lat: number; lon: number } | null;
  label: string;
  zip?: string;
  radiusMi?: number;
  extra?: PublicEvent[];
}): Promise<EventSearchResult | null> {
  if (!opts.point) return null;
  try {
    return await searchPublicEvents({
      lat: opts.point.lat,
      lon: opts.point.lon,
      label: opts.label,
      zip: opts.zip,
      radiusMi: normalizeRadius(opts.radiusMi),
      tz: DEFAULT_TZ,
      extra: opts.extra,
    });
  } catch (e) {
    console.warn("[events] feed failed", e);
    return null;
  }
}

export type WeatherDay = {
  date: string;
  maxF: number;
  minF: number;
  rainChance: number;
  summary: string;
  outdoorOk: boolean;
  heatWarning: boolean;
};

export type WeekendSlot = {
  id: string;
  starts_at: string;
  title: string;
  location: string;
  why: string;
  indoor: boolean;
  withChild: boolean;
  alone: boolean;
  source: string;
  sourceUrl: string;
  eventId: string | null;
  kind: string;
  fitLabel?: "good" | "ok" | "stretch";
  fitWhy?: string;
};

export type WeekendPlan = {
  weather: WeatherDay[];
  weatherNote: string;
  arrivingNote: string;
  all: WeekendSlot[];
  withChild: WeekendSlot[];
  alone: WeekendSlot[];
  other: WeekendSlot[];
  sources: { name: string; url: string; note: string }[];
  weatherError: string | null;
  place: {
    slug: string;
    name: string;
    city: string;
    state: string;
    zip: string;
    created: boolean;
    /** False when the town has no Neighborly board yet (slug is only a label). */
    board: boolean;
  };
  refresh: { status: string; note: string };
  fitApplied: boolean;
  /** Live public events (festivals, shows, park days) plus this board's own gatherings. */
  feed: EventSearchResult | null;
};

function wmoSummary(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Wintry";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Storms";
  return "Mixed";
}

async function fetchWeather(
  lat: number,
  lon: number,
  tz: string,
): Promise<{ days: WeatherDay[]; error: string | null }> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&timezone=${encodeURIComponent(tz)}&forecast_days=7`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { days: [], error: "Weather is unavailable right now — check the forecast before you head out." };
    const data = (await res.json()) as {
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    };
    const d = data.daily;
    if (!d?.time?.length) return { days: [], error: "Weather is unavailable right now — check the forecast before you head out." };
    const days: WeatherDay[] = d.time.map((date, i) => {
      const maxF = Math.round(d.temperature_2m_max[i] ?? 90);
      const rainChance = d.precipitation_probability_max[i] ?? 0;
      const heatWarning = maxF >= 88;
      const wet = rainChance >= 50;
      return {
        date,
        maxF,
        minF: Math.round(d.temperature_2m_min[i] ?? 70),
        rainChance,
        summary: wmoSummary(d.weather_code[i] ?? 1),
        outdoorOk: !heatWarning && !wet,
        heatWarning,
      };
    });
    return { days, error: null };
  } catch {
    return { days: [], error: "Weather is unavailable right now — check the forecast before you head out." };
  }
}

function weatherFor(days: WeatherDay[], iso: string, tz: string): WeatherDay | null {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  return days.find((d) => d.date === date) ?? null;
}

function hourInTz(iso: string, tz: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    })
      .format(new Date(iso))
      .replace("24", "0"),
  );
}

function saturdayOn(days: WeatherDay[]): WeatherDay | undefined {
  return days.find((d) => {
    const [y, m, dd] = d.date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, dd, 16, 0, 0)).getUTCDay() === 6;
  });
}

function formatWeatherDay(d: WeatherDay): string {
  const label = new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const rain = d.rainChance >= 40 ? `, ${d.rainChance}% rain` : "";
  return `${label}: ${d.summary.toLowerCase()}, high ${d.maxF}°${rain}`;
}

function buildArrivingNote(days: WeatherDay[], withChild: WeekendSlot[], placeName: string): string {
  const today = days[0];
  const tomorrow = days[1];
  if (!today) return `Check the forecast for ${placeName} before you head out.`;
  const paw = withChild.find((s) => /paw patrol/i.test(s.title) && /watch party|10:00/i.test(`${s.title} ${s.starts_at}`));
  const hot = [today, tomorrow].some((d) => d && d.maxF >= 85);
  const cold = [today, tomorrow].some((d) => d && d.maxF < 50);
  const wet = [today, tomorrow].some((d) => d && d.rainChance >= 50);
  const tip = hot
    ? "Hot — plan indoor or early."
    : cold
      ? "Bring a jacket."
      : wet
        ? "Pack an umbrella."
        : "Good weather to be outside.";
  const parts = [
    `${placeName}: ${formatWeatherDay(today)}${tomorrow ? `. ${formatWeatherDay(tomorrow)}` : ""}. ${tip}`,
  ];
  if (paw) {
    parts.push(`For families: ${paw.title} at the Pal Theatre (122 Church St).`);
  }
  return parts.join(" ");
}

/** Fri–Sun of the coming weekend. The forecast strips and the weather line all use this same range. */
export function weekendWeatherDays(days: WeatherDay[]): WeatherDay[] {
  // Only the first run of Fri/Sat/Sun — never next week's Friday.
  const isWkd = (d: WeatherDay) => [5, 6, 0].includes(new Date(`${d.date}T12:00:00Z`).getUTCDay());
  const start = days.findIndex(isWkd);
  if (start < 0) return days.slice(0, 3);
  const wk: WeatherDay[] = [];
  for (let i = start; i < days.length && wk.length < 3 && isWkd(days[i]); i++) wk.push(days[i]);
  return wk;
}

function weatherNoteFor(days: WeatherDay[], error: string | null): string {
  if (error) return "The forecast is unavailable right now — check the sky before you head out.";
  const use = weekendWeatherDays(days);
  if (!use.length) return "";
  const hi = Math.max(...use.map((d) => d.maxF));
  const lo = Math.min(...use.map((d) => d.minF));
  const rain = Math.max(...use.map((d) => d.rainChance));
  if (hi >= 85) return `Warm this weekend (highs near ${hi}°) — go early, and save the parks for evening.`;
  if (rain >= 50) return `Rain is likely at times (${rain}%) — have an indoor backup.`;
  if (hi < 55) return `Chilly this weekend (highs near ${hi}°) — bring a jacket.`;
  if (lo < 50) return `Cool mornings (${lo}°), highs near ${hi}° — bring a layer.`;
  return `Highs near ${hi}° — good weather to be outside.`;
}

function applyFit(slots: WeekendSlot[], prefs?: FitPrefs | null): WeekendSlot[] {
  return slots.map((slot) => {
    const fit = scoreFit(slot, prefs);
    return {
      ...slot,
      why: fit.why ? `${slot.why} ${fit.why}`.trim() : slot.why,
      fitLabel: fit.label,
      fitWhy: fit.why,
    };
  });
}

export async function buildWeekendPlan(opts?: {
  slug?: string;
  query?: string;
  prefs?: FitPrefs | null;
  create?: boolean;
  radiusMi?: number;
}): Promise<WeekendPlan> {
  const sql = await getSql();
  await ensureSeeded(sql);
  const q = (opts?.query || opts?.slug || "vidalia").trim() || "vidalia";
  const looked = opts?.create
    ? await findOrCreatePlace(sql, q, { create: true })
    : await resolveCommunityForPlace(sql, q);
  if (!looked.community) {
    const geo = looked.geo;
    const emptyName = geo?.city || q;
    const pt = geo ? { lat: geo.lat, lon: geo.lon } : null;
    const [wx, feed] = await Promise.all([
      pt ? fetchWeather(pt.lat, pt.lon, DEFAULT_TZ) : Promise.resolve({ days: [] as WeatherDay[], error: null }),
      loadEventFeed({ point: pt, label: geo ? `${geo.city}, ${geo.state}` : q, zip: geo?.zip, radiusMi: opts?.radiusMi }),
    ]);
    return {
      feed,
      weather: wx.days.slice(0, 5),
      weatherNote: wx.days.length ? weatherNoteFor(wx.days.slice(0, 5), wx.error) : "",
      arrivingNote: "",
      all: [],
      withChild: [],
      alone: [],
      other: [],
      sources: [],
      weatherError: null,
      place: {
        slug: geo ? `${geo.city}-${geo.state}`.toLowerCase().replace(/\s+/g, "-") : q,
        name: emptyName,
        city: geo?.city || "",
        state: geo?.state || "",
        zip: geo?.zip || "",
        created: false,
        board: false,
      },
      refresh: looked.refresh,
      fitApplied: false,
    };
  }
  const community: Community = looked.community;
  const tz = DEFAULT_TZ;
  const point =
    (await pointFor({ ...community, lat: community.lat ?? looked.geo?.lat, lon: community.lon ?? looked.geo?.lon })) ??
    VIDALIA_COORDS;
  const { lat, lon } = point;
  const weatherP = fetchWeather(lat, lon, tz);
  const boardRows = await listBoardEvents(sql, community.id);
  const sisterRows = await listSisterCityEvents(sql, {
    id: community.id,
    city: community.city || "Vidalia",
    state: community.state || "GA",
  });
  const seen = new Set<string>();
  const rows: BoardEventRow[] = [];
  for (const row of [...boardRows, ...sisterRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  const extra = rows
    .map((row) => boardRowToEvent(row, community, point))
    .filter((e): e is PublicEvent => e != null);
  const [{ days, error }, feed] = await Promise.all([
    weatherP,
    loadEventFeed({
      point,
      label: `${community.city || community.name}, ${community.state || "GA"}`,
      zip: community.zip || looked.geo?.zip,
      radiusMi: opts?.radiusMi,
      extra,
    }),
  ]);

  const all: WeekendSlot[] = [];
  const withChild: WeekendSlot[] = [];
  const alone: WeekendSlot[] = [];

  for (const row of rows) {
    const startIso = row.starts_at;
    const startMs = parseEventStartMs(startIso);
    const wx = startMs != null ? weatherFor(days, startIso, tz) : null;
    const hour = startMs != null ? hourInTz(startIso, tz) : 12;
    const indoor = /theatre|theater|gym|museum|library|church|indoor/i.test(`${row.title} ${row.location} ${row.description}`);
    const family = row.kind === "family" || /paw patrol|watch party|splash|kids|child|fun run/i.test(`${row.title} ${row.description}`);
    const adultOnly = /wine|girls night|21\+|not a kid|tribute|skynyrd|freebird/i.test(`${row.title} ${row.description}`);
    let why = "";
    if (wx?.heatWarning && indoor) why = `High near ${wx.maxF}° — this one is indoors.`;
    else if (wx?.heatWarning && hour < 11) why = `Hottest part of the day is later (${wx.maxF}°). Morning outdoor is kinder.`;
    else if (wx?.heatWarning && !indoor) why = `High near ${wx.maxF}°. Bring water and find some shade.`;
    else if ((wx?.rainChance ?? 0) >= 50 && indoor) why = `${wx?.rainChance}% rain chance — indoor is the safer slot.`;
    else if (wx) why = `${wx.summary}, high ${wx.maxF}°.`;
    else why = error || "Check the forecast before you head out.";

    const slot: WeekendSlot = {
      id: row.id,
      starts_at: row.starts_at,
      title: row.title,
      location: row.location,
      why,
      indoor,
      withChild: family && !adultOnly,
      alone: !family || adultOnly,
      source: row.description.includes("Pal Theatre")
        ? "The Pal Theatre"
        : row.description.includes("Visit Vidalia")
          ? "Visit Vidalia"
          : row.description.includes("fbcvidalia.org")
            ? "First Baptist Vidalia, Georgia"
            : row.description.includes("Recreation Complex") || row.description.includes("Stockyard")
              ? "Vidalia Parks & Rec"
              : "Neighborly public listing",
      sourceUrl: row.description.includes("Pal Theatre")
        ? "https://thepaltheatre.com/"
        : row.description.includes("Visit Vidalia")
          ? "https://visitvidaliaga.com/things-to-do/events/"
          : row.description.includes("fbcvidalia.org")
            ? "https://www.fbcvidalia.org"
            : row.description.includes("Recreation Complex") || row.description.includes("Stockyard")
              ? "https://vidaliaga.gov/departments/parks-and-recreation/"
              : `https://neighborly.unitedundergod.org/c/${community.slug}`,
      eventId: row.id,
      kind: row.kind || "social",
    };
    all.push(slot);
    if (slot.withChild) withChild.push(slot);
    if (slot.alone) alone.push(slot);
  }

  // Standing places only where we have verified public parks — not invented for a new ZIP.
  const sat = saturdayOn(days) ?? days[2];
  if (sat && community.slug === "vidalia") {
    withChild.push({
      id: "place_ben_smith",
      starts_at: `${sat.date}T17:30:00-04:00`,
      title: "Ben Smith Park in the evening",
      location: "Thompson St, Vidalia",
      why: sat.heatWarning
        ? `High ${sat.maxF}°. The playground and splash pad are best once the heat breaks.`
        : "Playground, shade, and room to run. Free.",
      indoor: false,
      withChild: true,
      alone: false,
      source: "Vidalia Parks & Rec",
      sourceUrl: "https://vidaliaga.gov/departments/parks-and-recreation/",
      eventId: null,
      kind: "kids",
    });
    withChild.push({
      id: "place_fountain",
      starts_at: `${sat.date}T19:30:00-04:00`,
      title: "The onion fountain after dark",
      location: "Behind City Hall, 114 Jackson St",
      why: "Lights and water after sunset. A short, free walk downtown.",
      indoor: false,
      withChild: true,
      alone: true,
      source: "Visit Vidalia",
      sourceUrl: "https://visitvidaliaga.com/things-to-do/attractions/",
      eventId: null,
      kind: "kids",
    });
  }

  const standing = withChild.filter((s) => !s.eventId);
  for (const slot of standing) {
    if (!all.some((a) => a.id === slot.id)) all.push(slot);
  }

  const weatherNote = weatherNoteFor(days.slice(0, 5), error);

  const prefs = opts?.prefs ?? null;
  const allSorted = splitByFit(applyFit(all, prefs), prefs).primary;
  const withChildSorted = applyFit(withChild, prefs);
  const aloneSorted = applyFit(alone, prefs);
  const childSplit = splitByFit(withChildSorted, prefs);
  const aloneSplit = splitByFit(aloneSorted, prefs);
  const other: WeekendSlot[] = [];

  const vidaliaSources = [
    { name: "Visit Vidalia", url: "https://visitvidaliaga.com/things-to-do/events/", note: "City tourism calendar" },
    { name: "The Pal Theatre", url: "https://thepaltheatre.com/", note: "Movies and live shows" },
    { name: "Vidalia Parks & Rec", url: "https://vidaliaga.gov/departments/parks-and-recreation/", note: "Parks and fields" },
    {
      name: "First Baptist Vidalia, Georgia",
      url: "https://www.fbcvidalia.org",
      note: "107 E Second St — worship and GriefShare",
    },
  ];

  const plan: WeekendPlan = {
    feed,
    weather: days.slice(0, 5),
    weatherNote,
    arrivingNote: buildArrivingNote(days, childSplit.primary, community.name),
    all: allSorted,
    withChild: childSplit.primary,
    alone: aloneSplit.primary,
    other,
    sources:
      community.slug === "vidalia"
        ? vidaliaSources
        : [
            {
              name: `${community.name} board`,
              url: `https://neighborly.unitedundergod.org/c/${community.slug}`,
              note: looked.created
                ? "Neighbor gatherings and help, posted by people who live here."
                : "Neighbor gatherings and help, posted by people who live here.",
            },
          ],
    weatherError: error,
    place: {
      slug: community.slug,
      name: community.name,
      city: community.city,
      state: community.state,
      zip: community.zip || looked.geo?.zip || "",
      created: looked.created,
      board: true,
    },
    refresh: looked.refresh,
    fitApplied: Boolean(prefs && (prefs.interests.length || prefs.setting_pref || prefs.mobility)),
  };
  return plan;
}

export const getWeekendPlan = createServerFn({ method: "GET" }).handler(async () => {
  return buildWeekendPlan();
});

export const loadWeekendPlan = createServerFn({ method: "GET" })
  .validator(
    (input: { place?: string; query?: string; interests?: string; setting?: string; mobility?: string; radius?: number }) =>
      input,
  )
  .handler(async ({ data }) => {
    const interests = (data.interests || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const prefs: FitPrefs | null =
      interests.length || data.setting || data.mobility
        ? { interests, setting_pref: data.setting || "", mobility: data.mobility || "" }
        : null;
    const plan = await buildWeekendPlan({
      slug: data.place,
      query: data.query || data.place,
      prefs,
      radiusMi: data.radius,
    });
    // Members-only boards: no weekend view for visitors (null → 404).
    if (plan.place.board && isMembersOnlyCommunity(plan.place.slug)) {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const row = await sql<{ id: string }>`select id from communities where slug = ${plan.place.slug} limit 1`;
      if (!row[0] || !(await canViewCommunity(sql, { id: row[0].id, slug: plan.place.slug }))) return null;
    }
    return plan;
  });
