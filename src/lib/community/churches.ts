/**
 * ChurchConnect public directory — consume, do not copy.
 * Same IDs/records as https://www.churchconnect.cloud/find-church
 * and churchconnect.unitedundergod.org. Neighborly does not store churches.
 */

export const CC_PUBLIC_ORIGIN = "https://churchconnect.unitedundergod.org";
export const CC_CLOUD_ORIGIN = "https://www.churchconnect.cloud";

export type CcChurch = {
  id: string;
  source_id: string;
  ein: string;
  slug: string;
  name: string;
  address: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  website: string;
  denomination: string;
  worship_style: string;
  dress_code: string;
  service_times: string;
  pastor_name: string;
  directory_status: string;
  profileUrl: string;
  miles: number | null;
  todayServices: ParsedService[];
};

export type ParsedService = {
  day: string;
  timeLabel: string;
  hour24: number | null;
  morning: boolean;
  raw: string;
};

export type ChurchSearchInput = {
  q?: string;
  zip?: string;
  city?: string;
  state?: string;
  lat?: number;
  lon?: number;
  denomination?: string;
  worship_style?: string;
  today?: boolean;
  morning?: boolean;
  limit?: number;
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) {
      const joined = v
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const rec = item as Record<string, unknown>;
            return [rec.day, rec.time, rec.label, rec.starts, rec.service_time]
              .filter((x) => typeof x === "string" && x.trim())
              .join(" ");
          }
          return "";
        })
        .filter(Boolean)
        .join("; ");
      if (joined) return joined;
    }
    if (v && typeof v === "object") {
      try {
        const s = JSON.stringify(v);
        if (s && s !== "{}" && s !== "[]" && s !== "null") return s;
      } catch {
        /* ignore */
      }
    }
  }
  return "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function churchProfileUrl(church: {
  slug?: string | null;
  source_id?: string | null;
  ein?: string | null;
  id?: string | null;
}): string {
  const slug = (church.slug || "").trim();
  if (slug) return `${CC_PUBLIC_ORIGIN}/church/${encodeURIComponent(slug)}`;
  const id = (church.source_id || church.ein || church.id || "").trim();
  if (id) return `${CC_PUBLIC_ORIGIN}/church/${encodeURIComponent(id)}`;
  return `${CC_PUBLIC_ORIGIN}/find-church`;
}

export function parseServiceTimes(raw: string): ParsedService[] {
  const text = (raw || "").trim();
  if (!text) return [];
  const chunks = text
    .split(/[;|]|(?:\s+and\s+)/i)
    .flatMap((part) => part.split(/,(?=\s*(?:sun|mon|tue|wed|thu|fri|sat|\d))/i))
    .map((s) => s.trim())
    .filter(Boolean);

  const out: ParsedService[] = [];
  let lastDay = "";
  for (const chunk of chunks) {
    const dayMatch = chunk.match(
      /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i,
    );
    const timeMatch = chunk.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i);
    const dayRaw = dayMatch?.[1] || lastDay;
    if (dayMatch) lastDay = dayMatch[1];
    const day = normalizeDay(dayRaw);
    let hour24: number | null = null;
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const mer = (timeMatch[3] || "").toLowerCase().replace(/\./g, "");
      if (mer === "pm" && hour < 12) hour += 12;
      if (mer === "am" && hour === 12) hour = 0;
      hour24 = hour;
    }
    out.push({
      day,
      timeLabel: timeMatch
        ? `${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ""}${timeMatch[3] ? ` ${timeMatch[3]}` : ""}`
        : chunk,
      hour24,
      morning: hour24 != null ? hour24 < 12 : /morning/i.test(chunk),
      raw: chunk,
    });
  }
  return out;
}

function normalizeDay(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("sun")) return "sunday";
  if (s.startsWith("mon")) return "monday";
  if (s.startsWith("tue")) return "tuesday";
  if (s.startsWith("wed")) return "wednesday";
  if (s.startsWith("thu")) return "thursday";
  if (s.startsWith("fri")) return "friday";
  if (s.startsWith("sat")) return "saturday";
  return s;
}

export function weekdayInTz(date = new Date(), tz = "America/New_York"): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" })
    .format(date)
    .toLowerCase();
  return DAYS.includes(name) ? name : name;
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function mapChurch(raw: Record<string, unknown>, originLat?: number, originLon?: number): CcChurch {
  const lat = num(raw.lat);
  const lng = num(raw.lng ?? raw.lon ?? raw.longitude);
  const serviceTimes = firstString(raw.service_times, raw.serviceTimes, raw.sunday_times);
  const todayServices = parseServiceTimes(serviceTimes);
  let miles: number | null = null;
  if (
    originLat != null &&
    originLon != null &&
    lat != null &&
    lng != null &&
    Number.isFinite(originLat) &&
    Number.isFinite(originLon)
  ) {
    miles = Math.round(haversineMiles(originLat, originLon, lat, lng) * 10) / 10;
  }
  const id = firstString(raw.id, raw.source_id, raw.ein, raw.slug) || `cc-${firstString(raw.name)}`;
  return {
    id,
    source_id: firstString(raw.source_id, raw.id, raw.ein),
    ein: firstString(raw.ein),
    slug: firstString(raw.slug, raw.church_slug, raw.subdomain),
    name: firstString(raw.name, raw.church_name) || "Church",
    address: firstString(raw.address, raw.street_address),
    street_address: firstString(raw.street_address, raw.address),
    city: firstString(raw.city),
    state: firstString(raw.state),
    zip_code: firstString(raw.zip_code, raw.zip, raw.postal_code),
    lat,
    lng,
    phone: firstString(raw.phone),
    website: firstString(raw.website),
    denomination: firstString(raw.denomination),
    worship_style: firstString(raw.worship_style, raw.worshipStyle, raw.style),
    dress_code: firstString(raw.dress_code),
    service_times: serviceTimes,
    pastor_name: firstString(raw.pastor_name),
    directory_status: firstString(raw.directory_status),
    profileUrl: churchProfileUrl({
      slug: firstString(raw.slug, raw.church_slug, raw.subdomain),
      source_id: firstString(raw.source_id, raw.id),
      ein: firstString(raw.ein),
      id,
    }),
    miles,
    todayServices,
  };
}

function styleMatches(church: CcChurch, wanted: string): boolean {
  const w = wanted.trim().toLowerCase();
  if (!w || w === "any" || w === "all") return true;
  const have = church.worship_style.trim().toLowerCase();
  if (!have) return false;
  if (w === "traditional") return /tradit|liturg|hymn/.test(have);
  if (w === "contemporary") return /contemp|modern|praise|band/.test(have);
  return have.includes(w);
}

async function fetchCcJson(path: string): Promise<unknown | null> {
  const urls = [`${CC_PUBLIC_ORIGIN}${path}`, `${CC_CLOUD_ORIGIN}${path}`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      return (await res.json()) as unknown;
    } catch {
      /* try next origin */
    }
  }
  return null;
}

function churchesFromPayload(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const rec = data as Record<string, unknown>;
  const list = rec.churches ?? rec.results ?? rec.items;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

export async function searchPublicChurches(input: ChurchSearchInput): Promise<{
  churches: CcChurch[];
  source: string;
  note: string;
  today: string;
}> {
  const zip = (input.zip || "").replace(/\D/g, "").slice(0, 5);
  const city = (input.city || "").trim();
  const state = (input.state || "").trim();
  const q = (input.q || "").trim();
  const denomination = (input.denomination || "").trim();
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 80);
  const today = weekdayInTz();

  const collected = new Map<string, Record<string, unknown>>();

  const absorb = (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const key =
        firstString(row.source_id, row.ein, row.id, row.slug, row.name) ||
        `${row.name}-${row.zip_code}`;
      if (!collected.has(key)) collected.set(key, row);
    }
  };

  if (zip) {
    const nearby = await fetchCcJson(
      `/api/public/churches/nearby/${encodeURIComponent(zip)}?limit=${limit}`,
    );
    absorb(churchesFromPayload(nearby));
  }

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (zip) params.set("zip_code", zip);
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  if (denomination) params.set("denomination", denomination);
  params.set("limit", String(limit));
  const listed = await fetchCcJson(`/api/public/churches?${params.toString()}`);
  absorb(churchesFromPayload(listed));

  let mapped = [...collected.values()].map((row) => mapChurch(row, input.lat, input.lon));

  if (denomination) {
    const d = denomination.toLowerCase();
    mapped = mapped.filter(
      (c) => !c.denomination || c.denomination.toLowerCase().includes(d) || d.includes(c.denomination.toLowerCase()),
    );
  }
  if (input.worship_style) {
    mapped = mapped.filter((c) => styleMatches(c, input.worship_style!));
  }
  if (input.today || input.morning) {
    mapped = mapped.filter((c) => {
      if (!c.service_times) return false;
      const hits = c.todayServices.filter((s) => !s.day || s.day === today);
      if (!hits.length) return false;
      if (input.morning) return hits.some((s) => s.morning);
      return true;
    });
  }

  mapped.sort((a, b) => {
    if (a.miles != null && b.miles != null && a.miles !== b.miles) return a.miles - b.miles;
    if (a.zip_code === zip && b.zip_code !== zip) return -1;
    if (b.zip_code === zip && a.zip_code !== zip) return 1;
    return a.name.localeCompare(b.name);
  });

  const note =
    mapped.length === 0
      ? "No public ChurchConnect churches matched. We do not invent a congregation."
      : mapped.every((c) => !c.service_times && !c.worship_style && !c.denomination)
        ? "Names and addresses are from ChurchConnect. Service times, worship style, and denomination appear here when CC publishes them."
        : "Live from ChurchConnect public records. Confirm times on their profile before you go.";

  return {
    churches: mapped.slice(0, limit),
    source: `${CC_PUBLIC_ORIGIN}/api/public/churches`,
    note,
    today,
  };
}
