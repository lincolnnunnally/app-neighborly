import type { Sql } from "@/lib/db";
import { TOOMBS_PANTRY_LISTINGS, type PublicPantryListing } from "./toombs-pantries";

function nameKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type PlentyPlace = { name: string; hours?: string; closed?: boolean; address?: string; city?: string; phone?: string };

async function plentyHours(): Promise<PlentyPlace[]> {
  const res = await fetch("https://plenty.unitedundergod.org/api/around", {
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { places?: PlentyPlace[] };
  return json.places || [];
}

function overlayListing(row: PublicPantryListing, live: PlentyPlace[]): PublicPantryListing {
  const key = nameKey(row.name);
  const hit = live.find((p) => {
    const k = nameKey(p.name);
    return k.includes(key) || key.includes(k);
  });
  if (!hit?.hours && !hit?.closed) return row;
  return {
    ...row,
    address: hit.address || row.address,
    city: hit.city || row.city,
    phone: hit.phone || row.phone,
    serve_times: hit.hours || row.serve_times,
    other_notes: hit.closed
      ? "Visited in person — building empty / closed. Do not send people here."
      : `Hours from a Plenty walk-in. ${row.other_notes || ""}`.trim(),
    source_name: "Plenty field visit (plenty.unitedundergod.org/around)",
    source_url: "https://plenty.unitedundergod.org/around",
    verified_on: hit.hours || hit.closed ? new Date().toISOString().slice(0, 10) : row.verified_on,
    closed: Boolean(hit.closed) || row.closed
  };
}

/**
 * Seed first-market structure once per DB lifetime.
 *
 * DC-1: do NOT invent named neighbors, fake needs, or fake services presented
 * as real people. Communities and facilities are real places/structures;
 * open boards start empty so the first real posts are honest.
 *
 * Public gatherings (pickleball, Celebrate Recovery) are listed as system
 * rows with host_name "Public listing" — not as if a neighbor posted them.
 */
export async function ensureSeeded(sql: Sql): Promise<void> {
  await ensureMilsteadV1(sql);
  await ensureVidaliaV2(sql);
  await ensureVidaliaV3(sql);
  await ensurePlaceCoords(sql);
  await refreshVidaliaPublicEvents(sql);
  await refreshToombsPantries(sql);
}

/**
 * Publish the sourced Toombs County pantry listings.
 *
 * Not seed_meta-gated: like refreshVidaliaPublicEvents, this re-runs so a
 * correction in toombs-pantries.ts reaches an existing database. It only ever
 * touches rows still owned by 'system' — the moment a neighbor claims a listing
 * (updatePantryListing sets listed_by to them), their version is final and this
 * function leaves it alone. That is the whole point of claiming.
 *
 * These rows start as public-source transcriptions. A local visit fills
 * verified_on; the card then drops "Unconfirmed". Closed visits stay listed
 * so a search does not send a hungry neighbor to an empty building.
 */
export async function refreshToombsPantries(sql: Sql): Promise<void> {
  const live = await plentyHours().catch(() => []);
  for (const raw of TOOMBS_PANTRY_LISTINGS) {
    const p = overlayListing(raw, live);
    const community = await sql<{ id: string }>`
      select id from communities where id = ${p.communityId}
    `;
    if (community.length === 0) continue;

    try {
      const existing = await sql<{ id: string; listed_by: string }>`
        select id, listed_by from facilities where id = ${p.id}
      `;

      if (existing.length > 0) {
        if (existing[0].listed_by !== "system") continue; // a neighbor owns it now
        const amenities = JSON.stringify(p.closed ? ["Food pantry", "Closed"] : ["Food pantry"]);
        const verifiedOn = p.verified_on || "";
        await sql`
          update facilities set
            name = ${p.name},
            description = ${p.description},
            address = ${p.address},
            city = ${p.city},
            zip = ${p.zip},
            serve_days = ${p.serve_days},
            serve_times = ${p.serve_times},
            residency_note = ${p.residency_note},
            visit_frequency = ${p.visit_frequency},
            id_docs = ${p.id_docs},
            other_notes = ${p.other_notes},
            phone = ${p.phone},
            website = ${p.website},
            facebook_url = ${p.facebook_url},
            source_name = ${p.source_name},
            source_url = ${p.source_url},
            verified_on = ${verifiedOn},
            amenities = ${amenities}
          where id = ${p.id} and listed_by = 'system'
        `;
        continue;
      }

      const amenities = JSON.stringify(p.closed ? ["Food pantry", "Closed"] : ["Food pantry"]);
      const verifiedOn = p.verified_on || "";
      await sql`
        insert into facilities (
          id, community_id, name, description, capacity, amenities, rate_note, contact_name,
          place_kind, address, city, zip, serve_days, serve_times,
          residency_note, visit_frequency, id_docs, other_notes, phone, website, facebook_url,
          listed_by, listed_by_name, source_name, source_url, verified_on
        ) values (
          ${p.id},
          ${p.communityId},
          ${p.name},
          ${p.description},
          null,
          ${amenities},
          'Food pantry listing — not a reservable room',
          ${p.name},
          'pantry',
          ${p.address},
          ${p.city},
          ${p.zip},
          ${p.serve_days},
          ${p.serve_times},
          ${p.residency_note},
          ${p.visit_frequency},
          ${p.id_docs},
          ${p.other_notes},
          ${p.phone},
          ${p.website},
          ${p.facebook_url},
          'system',
          'Public listing',
          ${p.source_name},
          ${p.source_url},
          ${verifiedOn}
        )
      `;
    } catch {
      // Columns arrive with migration 0012; a database mid-migration must not
      // take the whole board down.
      return;
    }
  }
}

async function ensurePlaceCoords(sql: Sql): Promise<void> {
  try {
    await sql`
      update communities
      set zip = '30474', lat = 32.2174, lon = -82.4135
      where id = 'comm_vidalia' and (coalesce(zip, '') = '' or lat is null)
    `;
  } catch {
    /* column missing until 0007 runs */
  }
}

async function ensureMilsteadV1(sql: Sql): Promise<void> {
  const rows = await sql<{ value: string }>`
    select value from seed_meta where key = 'community_v1'
  `;
  if (rows.length > 0) return;

  // Milstead.US — primary test market (real place brand)
  await sql`
    insert into communities (
      id, slug, name, tagline, description, city, state, kind,
      member_count, cover_color, is_featured, invite_code
    ) values (
      'comm_milstead',
      'milstead',
      'Milstead',
      'Neighbors helping neighbors across Milstead',
      'The first Neighborly test market. Post a real need, offer a real skill, plan a gathering, or welcome someone new. Whether you have lived here for decades or just arrived, this is how we look out for each other.',
      'Milstead',
      'GA',
      'neighborhood',
      0,
      'sage',
      true,
      'MILSTEAD-WELCOME'
    )
  `;

  await sql`
    insert into communities (
      id, slug, name, tagline, description, city, state, kind,
      member_count, cover_color, is_featured, invite_code
    ) values
    (
      'comm_milstead_church',
      'milstead-fellowship',
      'Milstead Fellowship',
      'Faith community care network',
      'Prayer requests, meal trains, rides to service, and practical help for members and neighbors — posted by real people only.',
      'Milstead',
      'GA',
      'church',
      0,
      'sky',
      false,
      'FELLOWSHIP-CARE'
    ),
    (
      'comm_oakridge',
      'oakridge-hoa',
      'Oakridge HOA',
      'HOA events, facilities, and neighbor requests',
      'Pool pavilion bookings, common-area cleanups, and help for residents who need a hand.',
      'Milstead',
      'GA',
      'neighborhood',
      0,
      'clay',
      false,
      'OAKRIDGE-JOIN'
    ),
    (
      'comm_lakeside',
      'lakeside-getaway',
      'Lakeside Getaway',
      'Vacation-home owners looking after each other',
      'For part-time residents who want to stay connected when they are in town — and find trusted local help when they are away.',
      'Lake Sinclair',
      'GA',
      'vacation',
      0,
      'water',
      false,
      'LAKESIDE-KEYS'
    )
  `;

  // System invites (also used for QR / flyer links)
  await sql`
    insert into invites (id, community_id, code, created_by, label) values
    ('inv_milstead_main', 'comm_milstead', 'MILSTEAD-WELCOME', 'system', 'Main Milstead invite'),
    ('inv_milstead_qr', 'comm_milstead', 'MILSTEAD-QR', 'system', 'Mailbox QR flyer'),
    ('inv_fellowship', 'comm_milstead_church', 'FELLOWSHIP-CARE', 'system', 'Fellowship invite'),
    ('inv_oakridge', 'comm_oakridge', 'OAKRIDGE-JOIN', 'system', 'Oakridge HOA'),
    ('inv_lakeside', 'comm_lakeside', 'LAKESIDE-KEYS', 'system', 'Lakeside vacation homes')
  `;

  // Facilities only — no fabricated neighbors. Empty needs/services/events until
  // real people post (honest empty states on the board).
  await sql`
    insert into facilities (
      id, community_id, name, description, capacity, amenities, rate_note, contact_name
    ) values
    (
      'fac_1', 'comm_milstead', 'Community Center multipurpose room',
      'Indoor space for birthday parties, meetings, and classes. Tables and chairs included. Confirm availability with the town office.',
      60, ${JSON.stringify(["Tables", "Chairs", "Kitchenette", "Wi‑Fi"])},
      'Resident rate — confirm with town', 'Town office'
    ),
    (
      'fac_2', 'comm_milstead', 'Riverside picnic pavilion',
      'Covered pavilion by the playground. Ideal for family reunions and small gatherings.',
      40, ${JSON.stringify(["Grills", "Power outlets", "Restrooms nearby"])},
      'Free for residents with reservation', 'Parks desk'
    ),
    (
      'fac_3', 'comm_oakridge', 'Oakridge pool pavilion',
      'HOA pavilion next to the pool. Members only for private events.',
      35, ${JSON.stringify(["Pool access", "Tables", "Shade"])},
      'HOA members — deposit may apply', 'HOA board'
    )
  `;

  await sql`
    insert into seed_meta (key, value) values ('community_v1', '1')
  `;
}

async function ensureVidaliaV2(sql: Sql): Promise<void> {
  const rows = await sql<{ value: string }>`
    select value from seed_meta where key = 'community_v2_vidalia'
  `;
  if (rows.length > 0) return;

  await sql`
    insert into communities (
      id, slug, name, tagline, description, city, state, kind,
      member_count, cover_color, is_featured, invite_code
    ) values
    (
      'comm_vidalia',
      'vidalia',
      'Vidalia',
      'Neighbors helping neighbors in the Sweet Onion City',
      'Vidalia, Georgia — a small town where people still gather: pickleball, church, downtown, the Onion Festival, and quiet tables where a new person can be known. Post a real need, offer a real skill, or show up to a public gathering. The neighbor list stays empty until real people join.',
      'Vidalia',
      'GA',
      'neighborhood',
      0,
      'sage',
      true,
      'VIDALIA-WELCOME'
    ),
    (
      'comm_vidalia_pickleball',
      'vidalia-pickleball',
      'Vidalia pickleball',
      'Play together, then talk',
      'Public play at the Recreation Complex (102 Stockyard Rd) and indoor play at First Baptist Vidalia gym. Beginners welcome. A simple way to meet people without forcing a conversation first.',
      'Vidalia',
      'GA',
      'interest',
      0,
      'sky',
      false,
      'VIDALIA-PICKLEBALL'
    ),
    (
      'comm_vidalia_dads',
      'vidalia-dads',
      'Vidalia dads',
      'Dads who still matter to their kids',
      'For dads — including after divorce — who want to be known, tell the truth, and become the father their kids still have. Coffee, pickleball, and a circle that will not look away. Deeper father support also lives at Kids Need Dads.',
      'Vidalia',
      'GA',
      'interest',
      0,
      'clay',
      false,
      'VIDALIA-DADS'
    )
  `;

  await sql`
    insert into invites (id, community_id, code, created_by, label) values
    ('inv_vidalia_main', 'comm_vidalia', 'VIDALIA-WELCOME', 'system', 'Main Vidalia invite'),
    ('inv_vidalia_qr', 'comm_vidalia', 'VIDALIA-QR', 'system', 'Vidalia flyer / QR'),
    ('inv_vidalia_pb', 'comm_vidalia_pickleball', 'VIDALIA-PICKLEBALL', 'system', 'Pickleball circle'),
    ('inv_vidalia_dads', 'comm_vidalia_dads', 'VIDALIA-DADS', 'system', 'Vidalia dads circle')
  `;

  await sql`
    insert into facilities (
      id, community_id, name, description, capacity, amenities, rate_note, contact_name
    ) values
    (
      'fac_vid_rec', 'comm_vidalia', 'Vidalia Recreation Complex',
      'City parks and recreation: playing fields, tennis, walking trail, outdoor pickleball, and the Dixon Building for gatherings. 102 Stockyard Rd. Parks & Rec: 912-537-7913. Register or rent at the city Rec1 catalog.',
      80, ${JSON.stringify(["Pickleball courts", "Fields", "Walking trail", "Dixon Building", "Restrooms"])},
      'Public park — rentals through Parks & Rec', 'Vidalia Parks & Rec'
    ),
    (
      'fac_vid_pal', 'comm_vidalia', 'PAL Theatre',
      'Historic downtown theatre at 122 Church St — movies, cooking demos, art classes, and open mics. A natural place to meet people without a pitch.',
      200, ${JSON.stringify(["Downtown", "Movies", "Community events"])},
      'Check PAL Theatre listings', 'PAL Theatre'
    ),
    (
      'fac_vid_library', 'comm_vidalia', 'Vidalia Regional Library',
      '610 Jackson St. Story times, book clubs, tech help, and a quiet public table. Rotary and civic groups also meet here.',
      40, ${JSON.stringify(["Public wifi", "Meeting rooms", "Programs for all ages"])},
      'Free public library', 'Vidalia Regional Library'
    ),
    (
      'fac_vid_downtown', 'comm_vidalia', 'Downtown Vidalia',
      'Church Street shops, The Market on Church, coffee and cafes. Small-town downtown where a new person can still be a regular.',
      null, ${JSON.stringify(["Walkable", "Shops", "Cafes"])},
      'Public streets', 'Downtown Vidalia Association'
    ),
    (
      'fac_vid_fbc_gym', 'comm_vidalia_pickleball', 'First Baptist Vidalia gym',
      'Indoor pickleball listed on the church calendar: Sunday 2:30pm, Tuesday 6:30pm, beginner class Monday 4:30pm. Open to the community as posted — confirm on fbcvidalia.com/events.',
      24, ${JSON.stringify(["Indoor courts", "Beginner class"])},
      'Community pickleball as posted by the church', 'First Baptist Vidalia'
    ),
    (
      'fac_vid_rec_courts', 'comm_vidalia_pickleball', 'Rec Complex pickleball courts',
      'Outdoor dedicated pickleball at 102 Stockyard Rd. Open play often Monday and Thursday 5:30pm and Sunday 2:00pm. Free public courts.',
      16, ${JSON.stringify(["Outdoor courts", "Lights", "Restrooms"])},
      'Free public play', 'Vidalia Parks & Rec'
    )
  `;

  await sql`
    insert into seed_meta (key, value) values ('community_v2_vidalia', '1')
  `;
}

async function ensureVidaliaV3(sql: Sql): Promise<void> {
  const rows = await sql<{ value: string }>`
    select value from seed_meta where key = 'community_v3_vidalia_interests'
  `;
  if (rows.length > 0) return;

  await sql`
    insert into communities (
      id, slug, name, tagline, description, city, state, kind,
      member_count, cover_color, is_featured, invite_code
    ) values
    (
      'comm_vidalia_makers',
      'vidalia-makers',
      'Vidalia makers',
      'Wood, metal, spoons, shops',
      'For people who like making things with their hands — woodworking, welding, blacksmithing, spoon carving. Empty until real makers join. We do not invent a workshop full of neighbors.',
      'Vidalia',
      'GA',
      'interest',
      0,
      'clay',
      false,
      'VIDALIA-MAKERS'
    ),
    (
      'comm_vidalia_outdoors',
      'vidalia-outdoors',
      'Vidalia outdoors',
      'Off screens, into creation',
      'Walks, trails, mushrooms, time outside. A gentle way to meet people without a performance.',
      'Vidalia',
      'GA',
      'interest',
      0,
      'water',
      false,
      'VIDALIA-OUTDOORS'
    )
  `;

  await sql`
    insert into invites (id, community_id, code, created_by, label) values
    ('inv_vidalia_makers', 'comm_vidalia_makers', 'VIDALIA-MAKERS', 'system', 'Makers circle'),
    ('inv_vidalia_outdoors', 'comm_vidalia_outdoors', 'VIDALIA-OUTDOORS', 'system', 'Outdoors circle')
  `;

  await sql`
    insert into seed_meta (key, value) values ('community_v3_vidalia_interests', '1')
  `;
}

/** Fixed calendar date in America/New_York. */
function easternDateISO(dateStr: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  for (const off of ["-04:00", "-05:00"] as const) {
    const iso = `${dateStr}T${hh}:${mm}:00${off}`;
    const dt = new Date(iso);
    const checkDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
    const checkHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false })
        .format(dt)
        .replace("24", "0"),
    );
    if (checkDate === dateStr && checkHour === hour) return iso;
  }
  return `${dateStr}T${hh}:${mm}:00-04:00`;
}

/** Sunday=0 … Saturday=6 in America/New_York. Returns an offset ISO string. */
function nextEasternISO(sundayBasedDow: number, hour: number, minute: number): string {
  const tz = "America/New_York";
  const now = new Date();
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const nameToDow: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayDow = nameToDow[weekdayName] ?? now.getDay();
  let add = (sundayBasedDow - todayDow + 7) % 7;
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const hhNow = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(now).replace("24", "0"),
  );
  const mmNow = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "2-digit" }).format(now));
  if (add === 0 && (hhNow > hour || (hhNow === hour && mmNow >= minute))) add = 7;
  const dayMs = Date.parse(`${todayDate}T12:00:00Z`) + add * 86400000;
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dayMs));
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  for (const off of ["-04:00", "-05:00"] as const) {
    const iso = `${dateStr}T${hh}:${mm}:00${off}`;
    const dt = new Date(iso);
    const checkDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
    const checkHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(dt).replace("24", "0"),
    );
    const checkMin = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "2-digit" }).format(dt));
    if (checkDate === dateStr && checkHour === hour && checkMin === minute) return iso;
  }
  return `${dateStr}T${hh}:${mm}:00-04:00`;
}

async function upsertSystemEvent(
  sql: Sql,
  row: {
    id: string;
    community_id: string;
    title: string;
    description: string;
    kind: string;
    location: string;
    starts_at: string;
  },
): Promise<void> {
  const existing = await sql<{ id: string }>`select id from events where id = ${row.id}`;
  if (existing.length > 0) {
    await sql`
      update events
      set title = ${row.title},
          description = ${row.description},
          kind = ${row.kind},
          location = ${row.location},
          starts_at = ${row.starts_at},
          host_name = 'Public listing'
      where id = ${row.id}
    `;
    return;
  }
  await sql`
    insert into events (
      id, community_id, user_id, host_name, title, description, kind, location, starts_at, ends_at, capacity, rsvp_count
    ) values (
      ${row.id},
      ${row.community_id},
      'system',
      'Public listing',
      ${row.title},
      ${row.description},
      ${row.kind},
      ${row.location},
      ${row.starts_at},
      '',
      null,
      0
    )
  `;
}

export async function refreshVidaliaPublicEvents(sql: Sql): Promise<void> {
  const communities = await sql<{ id: string }>`
    select id from communities where id = 'comm_vidalia'
  `;
  if (communities.length === 0) return;

  const listings = [
    {
      id: "evt_vidalia_fbc_pb_sun",
      community_id: "comm_vidalia_pickleball",
      title: "Indoor pickleball — First Baptist gym",
      description:
        "Public listing (not a neighbor-hosted event): Sunday pickleball in the First Baptist Vidalia gym at 2:30pm, as posted on fbcvidalia.com/events. RSVP here if you want company walking in. Confirm on the church calendar before you go.",
      kind: "social",
      location: "First Baptist Vidalia gym",
      starts_at: nextEasternISO(0, 14, 30),
    },
    {
      id: "evt_vidalia_fbc_pb_beginner",
      community_id: "comm_vidalia_pickleball",
      title: "Beginner pickleball class — First Baptist gym",
      description:
        "Public listing: Monday 4:30pm beginner pickleball class at First Baptist Vidalia gym. New players welcome. Confirm on fbcvidalia.com/events.",
      kind: "social",
      location: "First Baptist Vidalia gym",
      starts_at: nextEasternISO(1, 16, 30),
    },
    {
      id: "evt_vidalia_fbc_pb_tue",
      community_id: "comm_vidalia_pickleball",
      title: "Tuesday pickleball — First Baptist gym",
      description:
        "Public listing: Tuesday 6:30pm pickleball at First Baptist Vidalia gym. Confirm on the church calendar.",
      kind: "social",
      location: "First Baptist Vidalia gym",
      starts_at: nextEasternISO(2, 18, 30),
    },
    {
      id: "evt_vidalia_rec_pb",
      community_id: "comm_vidalia_pickleball",
      title: "Outdoor pickleball — Rec Complex",
      description:
        "Public listing: open play at Vidalia Recreation Complex, 102 Stockyard Rd. Courts are public and free. Typical open play has been Sunday 2:00pm and Monday/Thursday 5:30pm — show up, or post a need if you want a hitting partner.",
      kind: "social",
      location: "102 Stockyard Rd, Vidalia",
      starts_at: nextEasternISO(0, 14, 0),
    },
    {
      id: "evt_vidalia_celebrate_recovery",
      community_id: "comm_vidalia",
      title: "Celebrate Recovery — First Baptist Vidalia",
      description:
        "Public listing: Thursday 6:00–8:00pm Christ-centered recovery gathering at First Baptist Vidalia (gym/sanctuary). For anyone walking through hurt, pain, or habit. You do not have to have it together to sit in the room. Confirm at fbcvidalia.com/events.",
      kind: "meeting",
      location: "First Baptist Vidalia — gym / sanctuary",
      starts_at: nextEasternISO(4, 18, 0),
    },
    {
      id: "evt_vidalia_downtown",
      community_id: "comm_vidalia",
      title: "Downtown Vidalia — one honest conversation",
      description:
        "A standing invitation, not a fake meetup: Church Street, the PAL Theatre, or the library. RSVP if you want to be findable for coffee. Until someone else RSVPs, the chair is empty — that honesty is the point.",
      kind: "social",
      location: "Downtown Vidalia",
      starts_at: nextEasternISO(5, 10, 0),
    },
    {
      id: "evt_vidalia_dads_coffee",
      community_id: "comm_vidalia_dads",
      title: "Vidalia dads — first coffee (open chair)",
      description:
        "A standing invitation, not a fake meetup: the first dad who arrives in town can host coffee downtown and RSVP here so others can find the table. Until someone hosts, this is an empty chair — not a room full of invented brothers.",
      kind: "social",
      location: "Downtown Vidalia — host names the table when they RSVP",
      starts_at: nextEasternISO(6, 9, 0),
    },
    {
      id: "evt_pal_paw_party_20260905",
      community_id: "comm_vidalia",
      title: "PAW Patrol: Dino Movie watch party",
      description:
        "Public listing from The Pal Theatre (thepaltheatre.com): Saturday Sept 5, 2026 at 10:00am. $5. Decorations, photo ops, themed treats, crafts, tattoos, raffle. Confirm tickets on the Pal site before you go. Air-conditioned — a good heat-of-the-day plan with a child.",
      kind: "family",
      location: "The Pal Theatre, 122 Church St, Vidalia",
      starts_at: easternDateISO("2026-09-05", 10, 0),
    },
    {
      id: "evt_pal_paw_sat_1400",
      community_id: "comm_vidalia",
      title: "PAW Patrol: Dino Movie — 2pm show",
      description:
        "Public listing: Pal Theatre regular showing Saturday Sept 5, 2026 at 2:00pm. Confirm showtimes at thepaltheatre.com. Indoor.",
      kind: "family",
      location: "The Pal Theatre, 122 Church St, Vidalia",
      starts_at: easternDateISO("2026-09-05", 14, 0),
    },
    {
      id: "evt_pal_freebird_20260903",
      community_id: "comm_vidalia",
      title: "Freebird: The Ultimate Lynyrd Skynyrd Experience",
      description:
        "Public listing from The Pal Theatre: Thursday Sept 3, 2026 at 7:00pm. Southern rock tribute. Tickets at thepaltheatre.com. Not a kid show.",
      kind: "social",
      location: "The Pal Theatre, 122 Church St, Vidalia",
      starts_at: easternDateISO("2026-09-03", 19, 0),
    },
    {
      id: "evt_altama_lipsync_20260910",
      community_id: "comm_vidalia",
      title: "Altama Museum Lip Sync Battle at STC",
      description:
        "Public listing via Visit Vidalia: Thursday Sept 10, 2026. Confirm time and tickets with Altama Museum / Visit Vidalia before you go (visitvidaliaga.com).",
      kind: "social",
      location: "Southeastern Technical College, Vidalia",
      starts_at: easternDateISO("2026-09-10", 19, 0),
    },
    {
      id: "evt_pal_gno_20260912",
      community_id: "comm_vidalia",
      title: "Girls Night Out: Practical Magic 2",
      description:
        "Public listing from The Pal Theatre: Saturday Sept 12, 2026 at 6:00pm. Two glasses of wine or wine slushies and charcuterie included. 21+ energy — not a child plan. Tickets at thepaltheatre.com.",
      kind: "social",
      location: "The Pal Theatre, 122 Church St, Vidalia",
      starts_at: easternDateISO("2026-09-12", 18, 0),
    },
    {
      id: "evt_dva_winedown_20260917",
      community_id: "comm_vidalia",
      title: "Wine Down Downtown",
      description:
        "Public listing via Visit Vidalia / Downtown Vidalia Association: Thursday Sept 17, 2026. Confirm details at visitvidaliaga.com before you go. A way to meet people who already live here.",
      kind: "social",
      location: "Downtown Vidalia",
      starts_at: easternDateISO("2026-09-17", 18, 0),
    },
  ];

  for (const row of listings) {
    await upsertSystemEvent(sql, row);
  }
}
