import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { ensureSeeded } from "./seed";

const VIDALIA = { lat: 32.2174, lon: -82.4135, tz: "America/New_York" };

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
};

export type WeekendPlan = {
  weather: WeatherDay[];
  weatherNote: string;
  arrivingNote: string;
  withChild: WeekendSlot[];
  alone: WeekendSlot[];
  sources: { name: string; url: string; note: string }[];
  weatherError: string | null;
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

async function fetchWeather(): Promise<{ days: WeatherDay[]; error: string | null }> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${VIDALIA.lat}&longitude=${VIDALIA.lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&timezone=${encodeURIComponent(VIDALIA.tz)}&forecast_days=7`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { days: [], error: "Weather did not load. Assume September heat — indoor midday." };
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
    if (!d?.time?.length) return { days: [], error: "Weather did not load. Assume September heat — indoor midday." };
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
    return { days: [], error: "Weather did not load. Assume September heat — indoor midday." };
  }
}

function weatherFor(days: WeatherDay[], iso: string): WeatherDay | null {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: VIDALIA.tz }).format(new Date(iso));
  return days.find((d) => d.date === date) ?? null;
}

function hourEastern(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: VIDALIA.tz,
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
  const label = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const rain = d.rainChance >= 40 ? `, ${d.rainChance}% rain` : "";
  return `${label}: ${d.summary.toLowerCase()}, high ${d.maxF}°${rain}`;
}

function buildArrivingNote(days: WeatherDay[], withChild: WeekendSlot[]): string {
  const today = days[0];
  const tomorrow = days[1];
  if (!today) return "Check the heat before you linger outside. Confirm listings before you go.";
  const paw = withChild.find((s) => /paw patrol/i.test(s.title) && /watch party|10:00/i.test(`${s.title} ${s.starts_at}`));
  const parts = [
    `If you are arriving now — ${formatWeatherDay(today)}${tomorrow ? `. Next day: ${formatWeatherDay(tomorrow)}` : ""}. Indoor and morning first.`,
  ];
  if (paw) {
    parts.push(`Saturday with a child: ${paw.title} at the Pal Theatre (122 Church St) — air-conditioned.`);
  }
  parts.push("Parks after the heat breaks, not at noon. We will not invent a crowd.");
  return parts.join(" ");
}

export async function buildWeekendPlan(): Promise<WeekendPlan> {
  const sql = await getSql();
  await ensureSeeded(sql);
  const { days, error } = await fetchWeather();
  const cutoffMs = Date.now() - 6 * 3600 * 1000;
  const rawRows = await sql<{
    id: string;
    title: string;
    description: string;
    kind: string;
    location: string;
    starts_at: string;
    community_id: string;
  }>`
    select id, title, description, kind, location, starts_at::text as starts_at, community_id
    from events
    where community_id in ('comm_vidalia', 'comm_vidalia_pickleball', 'comm_vidalia_dads')
    order by starts_at asc
    limit 80
  `;
  const rows = rawRows.filter((row) => {
    const t = Date.parse(String(row.starts_at));
    return Number.isFinite(t) && t >= cutoffMs;
  });

  const withChild: WeekendSlot[] = [];
  const alone: WeekendSlot[] = [];

  for (const row of rows) {
    const wx = weatherFor(days, row.starts_at);
    const hour = hourEastern(row.starts_at);
    const indoor = /theatre|theater|gym|museum|library|church|indoor/i.test(`${row.title} ${row.location} ${row.description}`);
    const family = row.kind === "family" || /paw patrol|watch party|splash|kids|child|fun run/i.test(`${row.title} ${row.description}`);
    const adultOnly = /wine|girls night|21\+|not a kid|tribute|skynyrd|freebird/i.test(`${row.title} ${row.description}`);
    let why = "";
    if (wx?.heatWarning && indoor) why = `Heat looks like ${wx.maxF}° — this one is indoors. Good call.`;
    else if (wx?.heatWarning && hour < 11) why = `Hottest part of the day is later (${wx.maxF}°). Morning outdoor is kinder.`;
    else if (wx?.heatWarning && !indoor) why = `High near ${wx.maxF}°. Keep this short, or swap for AC.`;
    else if ((wx?.rainChance ?? 0) >= 50 && indoor) why = `${wx?.rainChance}% rain chance — indoor is the safer slot.`;
    else if (wx) why = `${wx.summary}, high ${wx.maxF}°.`;
    else why = error || "Check the heat before you linger outside.";

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
          : row.description.includes("First Baptist")
            ? "First Baptist Vidalia"
            : "Neighborly public listing",
      sourceUrl: row.description.includes("Pal Theatre")
        ? "https://thepaltheatre.com/"
        : row.description.includes("Visit Vidalia")
          ? "https://visitvidaliaga.com/things-to-do/events/"
          : row.description.includes("fbcvidalia")
            ? "https://fbcvidalia.com/events"
            : "https://neighborly.unitedundergod.org/c/vidalia",
      eventId: row.id,
    };
    if (slot.withChild) withChild.push(slot);
    if (slot.alone) alone.push(slot);
  }

  // Standing places (not ticketed events) — honest labels.
  const sat = saturdayOn(days) ?? days[2];
  if (sat) {
    withChild.push({
      id: "place_ben_smith",
      starts_at: `${sat.date}T17:30:00-04:00`,
      title: "Ben Smith Park — evening, not midday",
      location: "Thompson St, Vidalia",
      why: sat.heatWarning
        ? `High ${sat.maxF}°. Playground/splash pad after the heat breaks, not at noon.`
        : "A simple park. No ticket. Leave if it does not feel like a yes.",
      indoor: false,
      withChild: true,
      alone: false,
      source: "Vidalia Parks & Rec",
      sourceUrl: "https://vidaliaga.gov/departments/parks-and-recreation/",
      eventId: null,
    });
    withChild.push({
      id: "place_fountain",
      starts_at: `${sat.date}T19:30:00-04:00`,
      title: "Onion fountain after dark",
      location: "Behind City Hall, 114 Jackson St",
      why: "Lights and water after sunset. Short, free, and cooler than afternoon.",
      indoor: false,
      withChild: true,
      alone: true,
      source: "Visit Vidalia",
      sourceUrl: "https://visitvidaliaga.com/things-to-do/attractions/",
      eventId: null,
    });
  }

  const weatherNote = error
    ? error
    : days.some((d) => d.heatWarning)
      ? "South Georgia September: do indoor or morning first. Save parks for evening."
      : "Outdoor is reasonable. Still pack water.";

  const withChildSorted = withChild.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const aloneSorted = alone.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const plan: WeekendPlan = {
    weather: days.slice(0, 5),
    weatherNote,
    arrivingNote: buildArrivingNote(days, withChildSorted),
    withChild: withChildSorted,
    alone: aloneSorted,
    sources: [
      { name: "Visit Vidalia", url: "https://visitvidaliaga.com/things-to-do/events/", note: "City tourism calendar" },
      { name: "The Pal Theatre", url: "https://thepaltheatre.com/", note: "Movies and live shows" },
      { name: "Vidalia Parks & Rec", url: "https://vidaliaga.gov/departments/parks-and-recreation/", note: "Parks and fields" },
      { name: "First Baptist Vidalia", url: "https://fbcvidalia.com/events", note: "Pickleball, recovery, grief groups" },
    ],
    weatherError: error,
  };
  return plan;
}

export const getWeekendPlan = createServerFn({ method: "GET" }).handler(async () => {
  return buildWeekendPlan();
});
