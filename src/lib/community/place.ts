import type { Sql } from "@/lib/db";
import { uid } from "@/lib/utils";
import type { Community } from "./types";
import { refreshVidaliaPublicEvents } from "./seed";
import { normalizeState } from "./us-states";

export type GeoPlace = {
  zip: string;
  city: string;
  state: string;
  stateName: string;
  lat: number;
  lon: number;
};

export type PlaceLookup = {
  community: Community | null;
  created: boolean;
  geo: GeoPlace | null;
  refresh: { status: string; note: string };
  wouldCreate: boolean;
};

const ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function mapCommunity(row: Record<string, unknown>): Community {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    tagline: String(row.tagline ?? ""),
    description: String(row.description ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    kind: String(row.kind ?? "neighborhood") as Community["kind"],
    member_count: Number(row.member_count ?? 0),
    cover_color: String(row.cover_color ?? "sage"),
    is_featured: Boolean(row.is_featured),
    invite_code: String(row.invite_code),
    zip: String(row.zip ?? ""),
    lat: row.lat == null || row.lat === "" ? null : Number(row.lat),
    lon: row.lon == null || row.lon === "" ? null : Number(row.lon),
  };
}

type ZippoPlace = {
  "place name"?: string;
  longitude?: string;
  latitude?: string;
  state?: string;
  "state abbreviation"?: string;
  "post code"?: string;
};

export type ZippoPayload = {
  "post code"?: string;
  "place name"?: string;
  state?: string;
  "state abbreviation"?: string;
  places?: ZippoPlace[];
};

/** City lookups put state on the document; ZIP lookups put state on each place. */
export function mapZippopotam(data: ZippoPayload, path = ""): GeoPlace | null {
  const p = data.places?.[0];
  if (!p) return null;
  const city = String(p["place name"] || data["place name"] || "").trim();
  const state = normalizeState(p["state abbreviation"] || data["state abbreviation"] || p.state || data.state);
  const zipRaw = String(data["post code"] || p["post code"] || "");
  const zip = zipRaw.replace(/\D/g, "").slice(0, 5);
  const lat = Number(p.latitude);
  const lon = Number(p.longitude);
  if (!city || !state || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const tail = path.split("/").pop() || "";
  return {
    zip: ZIP_RE.test(zip) ? zip : ZIP_RE.test(tail) ? tail : zip,
    city,
    state,
    stateName: String(p.state || data.state || ""),
    lat,
    lon,
  };
}

async function zippopotam(path: string): Promise<GeoPlace | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us${path}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return mapZippopotam((await res.json()) as ZippoPayload, path);
  } catch {
    return null;
  }
}

function parseCityState(trimmed: string): { city: string; state: string } | null {
  const comma = trimmed.match(/^(.+?)[,]+[\s]*([A-Za-z][A-Za-z\s.]{1,24})$/);
  if (comma) {
    const state = normalizeState(comma[2]);
    const city = comma[1].trim();
    if (city && state) return { city, state };
  }
  const spaced = trimmed.match(/^(.+?)\s+([A-Za-z]{2})$/);
  if (spaced) {
    const state = normalizeState(spaced[2]);
    const city = spaced[1].replace(/,$/, "").trim();
    if (city && state) return { city, state };
  }
  const named = trimmed.match(/^(.+?)\s+([A-Za-z][A-Za-z\s]{3,22})$/);
  if (named) {
    const state = normalizeState(named[2]);
    const city = named[1].replace(/,$/, "").trim();
    if (city && state) return { city, state };
  }
  return null;
}

export async function geocodeQuery(q: string): Promise<GeoPlace | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const zip = trimmed.match(ZIP_RE);
  if (zip) return zippopotam(`/us/${zip[1]}`);

  const parsed = parseCityState(trimmed);
  if (parsed) {
    // zippopotam wants spaces as %20, not hyphens
    const city = encodeURIComponent(parsed.city.trim().replace(/\s+/g, " "));
    const found = await zippopotam(`/us/${parsed.state.toLowerCase()}/${city}`);
    if (found) return found;
    const slugCity = slugify(parsed.city).replace(/-/g, "%20");
    return zippopotam(`/us/${parsed.state.toLowerCase()}/${slugCity}`);
  }

  // First market is Georgia. City-only tries GA, then fails honestly.
  const ga = await zippopotam(`/us/ga/${encodeURIComponent(trimmed)}`);
  if (ga) return ga;
  return zippopotam(`/us/ga/${slugify(trimmed).replace(/-/g, "%20")}`);
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const url =
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates` +
      `?x=${encodeURIComponent(String(lon))}&y=${encodeURIComponent(String(lat))}` +
      `&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as {
        result?: {
          geographies?: Record<string, { BASENAME?: string; NAME?: string; ZCTA5?: string; STATE?: string }[]>;
        };
      };
      const geo = data.result?.geographies ?? {};
      const zcta = geo["2020 Census ZIP Code Tabulation Areas"]?.[0] ?? geo.ZCTA5?.[0];
      const places = geo["Incorporated Places"]?.[0] ?? geo.Places?.[0];
      const states = geo.States?.[0] as { BASENAME?: string; STUSAB?: string; NAME?: string } | undefined;
      const zip = String(zcta?.ZCTA5 || zcta?.BASENAME || "").replace(/\D/g, "").slice(0, 5);
      const city = String(places?.BASENAME || places?.NAME || "").replace(/ city$/i, "");
      const state = normalizeState(states?.STUSAB) || normalizeState(states?.BASENAME);
      if (zip && ZIP_RE.test(zip)) {
        const fromZip = await zippopotam(`/us/${zip}`);
        if (fromZip) return fromZip;
      }
      if (city && state) {
        const fromCity = await geocodeQuery(`${city}, ${state}`);
        if (fromCity) return fromCity;
      }
    }
  } catch {
    /* try nominatim */
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}` +
      `&lon=${encodeURIComponent(String(lon))}&format=jsonv2`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        "User-Agent": "Neighborly/1.0 (https://neighborly.unitedundergod.org)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: { postcode?: string; city?: string; town?: string; village?: string; state?: string };
    };
    const zip = String(data.address?.postcode || "").replace(/\D/g, "").slice(0, 5);
    if (zip && ZIP_RE.test(zip)) return zippopotam(`/us/${zip}`);
    const city = data.address?.city || data.address?.town || data.address?.village || "";
    const state = normalizeState(data.address?.state);
    if (city && state) return geocodeQuery(`${city}, ${state}`);
  } catch {
    return null;
  }
  return null;
}

async function findExisting(
  sql: Sql,
  geo: GeoPlace | null,
  q: string,
): Promise<Record<string, unknown> | null> {
  // Slug first — same as `/c/$slug`. Do not let a ZIP collision steal Vidalia.
  const slugFromQuery = slugify(q.replace(ZIP_RE, "").trim());
  if (slugFromQuery) {
    const byExactSlug = await sql<Record<string, unknown>>`
      select * from communities where slug = ${slugFromQuery} limit 1
    `;
    if (byExactSlug[0]) return byExactSlug[0];
  }
  if (geo?.zip && ZIP_RE.test(geo.zip)) {
    const byZip = await sql<Record<string, unknown>>`
      select * from communities
      where zip = ${geo.zip} and kind = 'neighborhood'
      order by is_featured desc
      limit 1
    `;
    if (byZip[0]) return byZip[0];
  }
  if (geo?.city && geo.state) {
    const byCity = await sql<Record<string, unknown>>`
      select * from communities
      where lower(city) = ${geo.city.toLowerCase()}
        and lower(state) = ${geo.state.toLowerCase()}
        and kind = 'neighborhood'
      order by is_featured desc
      limit 1
    `;
    if (byCity[0]) return byCity[0];
  }
  const rawGuess = slugify(q.replace(ZIP_RE, "").trim() || geo?.city || q);
  const cityGuess = geo?.city ? slugify(geo.city) : "";
  const guesses = [...new Set([rawGuess, cityGuess, cityGuess && geo?.state ? `${cityGuess}-${geo.state.toLowerCase()}` : ""].filter(Boolean))];
  for (const slugGuess of guesses) {
    const bySlug = await sql<Record<string, unknown>>`
      select * from communities
      where slug = ${slugGuess}
         or slug = ${`${slugGuess}-${(geo?.state || "ga").toLowerCase()}`}
      limit 1
    `;
    if (bySlug[0]) return bySlug[0];
  }
  return null;
}

async function createTown(sql: Sql, geo: GeoPlace): Promise<Record<string, unknown>> {
  if (!geo.city || !geo.state) {
    throw new Error("Could not create a town without a city and state.");
  }
  const base = slugify(geo.city) || (geo.zip ? `zip-${geo.zip}` : "");
  if (!base) throw new Error("Could not name that town.");
  let slug = base;
  const taken = await sql<{ slug: string }>`select slug from communities where slug = ${slug} limit 1`;
  if (taken[0]) slug = slugify(`${geo.city}-${geo.state}`) || `${base}-${geo.zip}`;
  const id = `comm_${slug}`.slice(0, 64);
  const code = `${slugify(geo.city).replace(/-/g, "").slice(0, 16).toUpperCase()}-WELCOME`.slice(0, 32);
  const name = geo.city;
  const tagline = `Neighbors in ${geo.city}, ${geo.state}`;
  const description = `${geo.city}, ${geo.state} ${geo.zip ? `(${geo.zip})` : ""} — a Neighborly board. Public listings appear when someone who lives here adds a real calendar source, or when we already curate this town. We will not invent neighbors or events.`;

  await sql`
    insert into communities (
      id, slug, name, tagline, description, city, state, kind,
      member_count, cover_color, is_featured, invite_code, zip, lat, lon
    ) values (
      ${id},
      ${slug},
      ${name},
      ${tagline},
      ${description},
      ${geo.city},
      ${geo.state},
      'neighborhood',
      0,
      'sage',
      false,
      ${code},
      ${geo.zip || ""},
      ${geo.lat},
      ${geo.lon}
    )
  `;
  await sql`
    insert into invites (id, community_id, code, created_by, label) values
    (${`inv_${slug}`}, ${id}, ${code}, 'system', ${`${name} invite`})
  `;
  const rows = await sql<Record<string, unknown>>`select * from communities where id = ${id} limit 1`;
  return rows[0]!;
}

const DAY_MS = 24 * 3600 * 1000;

export async function maybeRefreshListings(
  sql: Sql,
  community: Community,
): Promise<{ status: string; note: string }> {
  const rows = await sql<{ calendar_refreshed_at: string | null }>`
    select calendar_refreshed_at::text as calendar_refreshed_at
    from communities where id = ${community.id} limit 1
  `;
  const last = rows[0]?.calendar_refreshed_at ? Date.parse(String(rows[0].calendar_refreshed_at)) : 0;
  if (Number.isFinite(last) && last > 0 && Date.now() - last < DAY_MS) {
    return {
      status: "cached",
      note: "This town was refreshed in the last day. We do not re-crawl on every view.",
    };
  }

  const logId = uid("refresh");
  await sql`
    insert into place_refresh_log (id, community_id, status, note)
    values (${logId}, ${community.id}, 'ok', 'started')
  `;

  let listings = 0;
  let note = "";
  try {
    if (community.id === "comm_vidalia" || community.slug === "vidalia") {
      await refreshVidaliaPublicEvents(sql);
      const count = await sql<{ c: number }>`
        select count(*)::int as c from events where community_id in ('comm_vidalia', 'comm_vidalia_pickleball', 'comm_vidalia_dads')
      `;
      listings = Number(count[0]?.c || 0);
      note =
        "Refreshed Vidalia, Georgia public listings (Pal, Visit Vidalia, Parks, FBC Georgia). Not Vidalia, Louisiana. No Facebook scrape.";
    } else {
      note =
        "No curated calendar for this town yet. The board stays empty until a neighbor or organizer adds a real public listing. We will not invent events with AI.";
    }
    await sql`
      update communities set calendar_refreshed_at = now() where id = ${community.id}
    `;
    await sql`
      update place_refresh_log
      set finished_at = now(), status = 'ok', listings_found = ${listings}, note = ${note}
      where id = ${logId}
    `;
    return { status: "ok", note };
  } catch (e) {
    const err = e instanceof Error ? e.message : "refresh failed";
    await sql`
      update place_refresh_log
      set finished_at = now(), status = 'error', note = ${err}
      where id = ${logId}
    `;
    return { status: "error", note: err };
  }
}

function applyGeo(community: Community, geo: GeoPlace | null): Community {
  if (!geo) return community;
  return {
    ...community,
    zip: community.zip || geo.zip,
    lat: community.lat ?? geo.lat,
    lon: community.lon ?? geo.lon,
  };
}

/** Prefer an existing board slug (e.g. `place=vidalia`) before geocode/ZIP. */
export async function resolveCommunityForPlace(
  sql: Sql,
  q: string,
): Promise<PlaceLookup> {
  const query = q.trim() || "vidalia";
  if (!ZIP_RE.test(query)) {
    const slug = slugify(query);
    if (slug) {
      const bySlug = await sql<Record<string, unknown>>`
        select * from communities where slug = ${slug} limit 1
      `;
      if (bySlug[0]) {
        const community = mapCommunity(bySlug[0]);
        const refresh = await maybeRefreshListings(sql, community);
        return { community, created: false, geo: null, refresh, wouldCreate: false };
      }
    }
  }
  return lookupPlace(sql, query);
}

export async function lookupPlace(
  sql: Sql,
  q: string,
  opts?: { lat?: number; lon?: number },
): Promise<PlaceLookup> {
  const query = q.trim();
  let geo: GeoPlace | null = null;
  if (opts?.lat != null && opts?.lon != null) {
    geo = await reverseGeocode(opts.lat, opts.lon);
  }
  if (!geo && query) geo = await geocodeQuery(query);

  if (!query && !geo) {
    const vidalia = await sql<Record<string, unknown>>`
      select * from communities where slug = 'vidalia' limit 1
    `;
    if (!vidalia[0]) throw new Error("Vidalia is not seeded yet.");
    const community = mapCommunity(vidalia[0]);
    const refresh = await maybeRefreshListings(sql, community);
    return { community, created: false, geo: null, refresh, wouldCreate: false };
  }

  const existing = await findExisting(sql, geo, query || geo?.city || "");
  if (existing) {
    if (geo && !(existing.zip || existing.lat)) {
      await sql`
        update communities
        set zip = coalesce(nullif(zip, ''), ${geo.zip}),
            lat = coalesce(lat, ${geo.lat}),
            lon = coalesce(lon, ${geo.lon})
        where id = ${String(existing.id)}
      `;
    }
    const community = applyGeo(mapCommunity(existing), geo);
    const refresh = await maybeRefreshListings(sql, community);
    return { community, created: false, geo, refresh, wouldCreate: false };
  }

  return {
    community: null,
    created: false,
    geo,
    refresh: {
      status: geo ? "empty" : "miss",
      note: geo
        ? `${geo.city}, ${geo.state} has no Neighborly board yet. We did not open an empty town on this lookup.`
        : "Could not find that city or ZIP. Try a 5-digit ZIP or “City, ST” (example: Vidalia, GA).",
    },
    wouldCreate: Boolean(geo),
  };
}

export async function findOrCreatePlace(
  sql: Sql,
  q: string,
  opts?: { create?: boolean; lat?: number; lon?: number },
): Promise<PlaceLookup> {
  const looked = await lookupPlace(sql, q, opts);
  if (looked.community || !opts?.create) return looked;
  if (!looked.geo) {
    throw new Error(
      looked.refresh.note || "Could not find that city or ZIP. Try a 5-digit ZIP or “City, ST” (example: Vidalia, GA).",
    );
  }
  const created = await createTown(sql, looked.geo);
  const community = applyGeo(mapCommunity(created), looked.geo);
  const refresh = await maybeRefreshListings(sql, community);
  return { community, created: true, geo: looked.geo, refresh, wouldCreate: false };
}
