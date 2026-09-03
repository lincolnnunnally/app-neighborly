import type { Sql } from "@/lib/db";
import { uid } from "@/lib/utils";
import type { Community } from "./types";
import { refreshVidaliaPublicEvents } from "./seed";

export type GeoPlace = {
  zip: string;
  city: string;
  state: string;
  stateName: string;
  lat: number;
  lon: number;
};

export type PlaceLookup = {
  community: Community;
  created: boolean;
  geo: GeoPlace | null;
  refresh: { status: string; note: string };
};

const ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

function slugify(value: string): string {
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

async function zippopotam(path: string): Promise<GeoPlace | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us${path}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      "post code"?: string;
      places?: {
        "place name": string;
        longitude: string;
        latitude: string;
        state: string;
        "state abbreviation": string;
      }[];
    };
    const p = data.places?.[0];
    if (!p) return null;
    return {
      zip: String(data["post code"] || path.split("/").pop() || ""),
      city: p["place name"],
      state: p["state abbreviation"],
      stateName: p.state,
      lat: Number(p.latitude),
      lon: Number(p.longitude),
    };
  } catch {
    return null;
  }
}

export async function geocodeQuery(q: string): Promise<GeoPlace | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const zip = trimmed.match(ZIP_RE);
  if (zip) return zippopotam(`/us/${zip[1]}`);

  const withState = trimmed.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
  if (withState) {
    const city = slugify(withState[1]).replace(/-/g, "%20");
    const st = withState[2].toLowerCase();
    return zippopotam(`/us/${st}/${city}`);
  }

  // First market is Georgia. City-only tries GA, then fails honestly.
  const ga = await zippopotam(`/us/ga/${slugify(trimmed).replace(/-/g, "%20")}`);
  return ga;
}

async function findExisting(
  sql: Sql,
  geo: GeoPlace | null,
  q: string,
): Promise<Record<string, unknown> | null> {
  if (geo?.zip) {
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
  const slugGuess = slugify(q.replace(ZIP_RE, "").trim() || geo?.city || q);
  if (slugGuess) {
    const bySlug = await sql<Record<string, unknown>>`
      select * from communities where slug = ${slugGuess} or slug = ${`${slugGuess}-${(geo?.state || "ga").toLowerCase()}`} limit 1
    `;
    if (bySlug[0]) return bySlug[0];
  }
  return null;
}

async function createTown(sql: Sql, geo: GeoPlace): Promise<Record<string, unknown>> {
  const base = slugify(geo.city) || `zip-${geo.zip}`;
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
      ${geo.zip},
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
      note = "Refreshed Vidalia public listings (Pal, Visit Vidalia, FBC, Parks). No Facebook scrape.";
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

export async function findOrCreatePlace(sql: Sql, q: string): Promise<PlaceLookup> {
  const query = q.trim();
  if (!query) {
    const vidalia = await sql<Record<string, unknown>>`
      select * from communities where slug = 'vidalia' limit 1
    `;
    if (!vidalia[0]) throw new Error("Vidalia is not seeded yet.");
    const community = mapCommunity(vidalia[0]);
    const refresh = await maybeRefreshListings(sql, community);
    return { community, created: false, geo: null, refresh };
  }

  const geo = await geocodeQuery(query);
  const existing = await findExisting(sql, geo, query);
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
    const community = mapCommunity(existing);
    if (geo) {
      community.zip = community.zip || geo.zip;
      community.lat = community.lat ?? geo.lat;
      community.lon = community.lon ?? geo.lon;
    }
    const refresh = await maybeRefreshListings(sql, community);
    return { community, created: false, geo, refresh };
  }

  if (!geo) {
    throw new Error(
      "Could not find that city or ZIP. Try a 5-digit ZIP or “City, ST” (example: Vidalia, GA).",
    );
  }

  const created = await createTown(sql, geo);
  const community = mapCommunity(created);
  const refresh = await maybeRefreshListings(sql, community);
  return { community, created: true, geo, refresh };
}
