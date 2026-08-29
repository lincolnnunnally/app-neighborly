import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseJsonArray, uid } from "@/lib/utils";
import { ensureSeeded } from "./seed";
import type {
  Community,
  CommunityEvent,
  Facility,
  Membership,
  Need,
  Neighbor,
  Profile,
  Service,
} from "./types";

export type HelpOffer = {
  id: string;
  need_id: string;
  user_id: string;
  helper_name: string;
  message: string;
  status: string;
  created_at: string;
  need_title?: string;
  need_author?: string;
};

export type FacilityBooking = {
  id: string;
  facility_id: string;
  community_id: string;
  user_id: string;
  booker_name: string;
  purpose: string;
  date_on: string;
  time_note: string;
  status: string;
  facility_name?: string;
};

export type ActivityItem = {
  id: string;
  kind: "offer" | "event" | "booking" | "need";
  title: string;
  detail: string;
  created_at: string;
  href?: string;
};

async function db() {
  const sql = await getSql();
  await ensureSeeded(sql);
  return sql;
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    bio: String(row.bio ?? ""),
    phone: String(row.phone ?? ""),
    street_hint: String(row.street_hint ?? ""),
    skills: parseJsonArray(String(row.skills ?? "[]")),
    help_offerings: parseJsonArray(String(row.help_offerings ?? "[]")),
    interests: parseJsonArray(String(row.interests ?? "[]")),
    life_season: String(row.life_season ?? ""),
    faith_posture: String(row.faith_posture ?? ""),
    hoping_for: String(row.hoping_for ?? ""),
    availability: parseJsonArray(String(row.availability ?? "[]")),
    is_new_resident: Boolean(row.is_new_resident),
    is_youth: Boolean(row.is_youth),
    notify_events: Boolean(row.notify_events),
    notify_needs: Boolean(row.notify_needs),
    notify_services: Boolean(row.notify_services),
    notify_facilities: Boolean(row.notify_facilities),
    welcome_seen: Boolean(row.welcome_seen),
  };
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
  };
}

function mapNeed(r: Record<string, unknown>): Need {
  return {
    id: String(r.id),
    community_id: String(r.community_id),
    user_id: String(r.user_id),
    author_name: String(r.author_name),
    title: String(r.title),
    description: String(r.description ?? ""),
    category: String(r.category),
    urgency: String(r.urgency),
    status: String(r.status),
    is_paid: Boolean(r.is_paid),
    created_at: String(r.created_at),
    help_count: Number(r.help_count ?? 0),
  };
}

function mapService(r: Record<string, unknown>): Service {
  return {
    id: String(r.id),
    community_id: String(r.community_id),
    user_id: String(r.user_id),
    provider_name: String(r.provider_name),
    title: String(r.title),
    description: String(r.description ?? ""),
    category: String(r.category),
    pricing: String(r.pricing),
    price_note: String(r.price_note ?? ""),
    is_business: Boolean(r.is_business),
    is_youth: Boolean(r.is_youth),
    contact_hint: String(r.contact_hint ?? ""),
    created_at: String(r.created_at),
  };
}

function mapEvent(r: Record<string, unknown>): CommunityEvent {
  return {
    id: String(r.id),
    community_id: String(r.community_id),
    user_id: String(r.user_id),
    host_name: String(r.host_name),
    title: String(r.title),
    description: String(r.description ?? ""),
    kind: String(r.kind),
    location: String(r.location ?? ""),
    starts_at: String(r.starts_at),
    ends_at: String(r.ends_at ?? ""),
    capacity: r.capacity == null ? null : Number(r.capacity),
    rsvp_count: Number(r.rsvp_count ?? 0),
    created_at: String(r.created_at),
    has_rsvp: Boolean(r.has_rsvp),
  };
}

function mapFacility(r: Record<string, unknown>): Facility {
  return {
    id: String(r.id),
    community_id: String(r.community_id),
    name: String(r.name),
    description: String(r.description ?? ""),
    capacity: r.capacity == null ? null : Number(r.capacity),
    amenities: parseJsonArray(String(r.amenities ?? "[]")),
    rate_note: String(r.rate_note ?? ""),
    contact_name: String(r.contact_name ?? ""),
  };
}

async function ensureMember(sql: Awaited<ReturnType<typeof db>>, userId: string, communityId: string) {
  const m = await sql`
    select id from memberships
    where user_id = ${userId} and community_id = ${communityId} and status = 'active'
    limit 1
  `;
  if (m.length === 0) {
    throw new Error("Join this community first to take this action");
  }
}

// ── Public reads ────────────────────────────────────────────────────────────

export const listCommunities = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<Record<string, unknown>>`
    select * from communities order by is_featured desc, name asc
  `;
  return rows.map(mapCommunity);
});

export const getCommunityBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from communities where slug = ${slug} limit 1
    `;
    return rows[0] ? mapCommunity(rows[0]) : null;
  });

export const resolveInvite = createServerFn({ method: "GET" })
  .validator((code: string) => code.trim().toUpperCase())
  .handler(async ({ data: code }) => {
    const sql = await db();
    const inv = await sql<{ community_id: string; code: string; label: string }>`
      select community_id, code, label from invites where upper(code) = ${code} limit 1
    `;
    if (inv[0]) {
      const c = await sql<Record<string, unknown>>`
        select * from communities where id = ${inv[0].community_id} limit 1
      `;
      if (c[0]) {
        return {
          code: inv[0].code,
          label: inv[0].label,
          community: mapCommunity(c[0]),
        };
      }
    }
    const c2 = await sql<Record<string, unknown>>`
      select * from communities where upper(invite_code) = ${code} limit 1
    `;
    if (!c2[0]) return null;
    return {
      code,
      label: "Community invite",
      community: mapCommunity(c2[0]),
    };
  });

export const getCommunityFeed = createServerFn({ method: "GET" })
  .validator((input: { slug: string; userId?: string }) => input)
  .handler(async ({ data }) => {
    const sql = await db();
    const communities = await sql<Record<string, unknown>>`
      select * from communities where slug = ${data.slug} limit 1
    `;
    const community = communities[0] ? mapCommunity(communities[0]) : null;
    if (!community) {
      return {
        community: null as Community | null,
        needs: [] as Need[],
        services: [] as Service[],
        events: [] as CommunityEvent[],
        facilities: [] as Facility[],
        neighbors: [] as Neighbor[],
      };
    }

    const needsRows = await sql<Record<string, unknown>>`
      select n.*,
        (select count(*)::int from offers_help o where o.need_id = n.id) as help_count
      from needs n
      where n.community_id = ${community.id}
      order by
        case n.urgency when 'urgent' then 0 when 'soon' then 1 when 'normal' then 2 else 3 end,
        n.created_at desc
    `;

    const serviceRows = await sql<Record<string, unknown>>`
      select * from services
      where community_id = ${community.id}
      order by is_youth asc, is_business desc, created_at desc
    `;

    const eventRows = await sql<Record<string, unknown>>`
      select e.*,
        case when ${data.userId ?? ""} = '' then false
          else exists(
            select 1 from event_rsvps r
            where r.event_id = e.id and r.user_id = ${data.userId ?? ""}
          )
        end as has_rsvp
      from events e
      where e.community_id = ${community.id}
      order by e.starts_at asc
    `;

    const facilityRows = await sql<Record<string, unknown>>`
      select * from facilities where community_id = ${community.id} order by name
    `;

    const neighborRows = await sql<Record<string, unknown>>`
      select p.user_id, p.display_name, p.bio, p.street_hint, p.skills,
        p.help_offerings, p.is_new_resident, p.is_youth, m.role
      from memberships m
      join profiles p on p.user_id = m.user_id
      where m.community_id = ${community.id} and m.status = 'active'
      order by p.is_new_resident desc, p.display_name asc
      limit 40
    `;

    const neighbors: Neighbor[] = neighborRows.map((r) => ({
      user_id: String(r.user_id),
      display_name: String(r.display_name),
      bio: String(r.bio ?? ""),
      street_hint: String(r.street_hint ?? ""),
      skills: parseJsonArray(String(r.skills ?? "[]")),
      help_offerings: parseJsonArray(String(r.help_offerings ?? "[]")),
      is_new_resident: Boolean(r.is_new_resident),
      is_youth: Boolean(r.is_youth),
      role: String(r.role),
    }));

    // DC-1: never inject named sample neighbors. Empty people lists stay empty
    // until real members join.

    return {
      community,
      needs: needsRows.map(mapNeed),
      services: serviceRows.map(mapService),
      events: eventRows.map(mapEvent),
      facilities: facilityRows.map(mapFacility),
      neighbors,
    };
  });

export const listOffersForNeed = createServerFn({ method: "GET" })
  .validator((needId: string) => needId)
  .handler(async ({ data: needId }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from offers_help where need_id = ${needId} order by created_at desc
    `;
    return rows.map(
      (r): HelpOffer => ({
        id: String(r.id),
        need_id: String(r.need_id),
        user_id: String(r.user_id),
        helper_name: String(r.helper_name),
        message: String(r.message ?? ""),
        status: String(r.status),
        created_at: String(r.created_at),
      }),
    );
  });

// ── Authenticated profile / membership ──────────────────────────────────────

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from profiles where user_id = ${context.userId} limit 1
    `;
    return rows[0] ? mapProfile(rows[0]) : null;
  });

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      display_name: string;
      bio?: string;
      phone?: string;
      street_hint?: string;
      skills?: string[];
      help_offerings?: string[];
      interests?: string[];
      life_season?: string;
      faith_posture?: string;
      hoping_for?: string;
      availability?: string[];
      is_new_resident?: boolean;
      is_youth?: boolean;
      notify_events?: boolean;
      notify_needs?: boolean;
      notify_services?: boolean;
      notify_facilities?: boolean;
      welcome_seen?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const name = data.display_name.trim();
    if (!name) throw new Error("Display name is required");

    const existing = await sql`select user_id from profiles where user_id = ${context.userId}`;
    const skills = JSON.stringify(data.skills ?? []);
    const help = JSON.stringify(data.help_offerings ?? []);
    const interests = JSON.stringify(data.interests ?? []);
    const availability = JSON.stringify(data.availability ?? []);
    const lifeSeason = data.life_season ?? "";
    const faithPosture = data.faith_posture ?? "";
    const hopingFor = data.hoping_for ?? "";

    if (existing.length === 0) {
      await sql`
        insert into profiles (
          user_id, display_name, bio, phone, street_hint, skills, help_offerings,
          interests, life_season, faith_posture, hoping_for, availability,
          is_new_resident, is_youth, notify_events, notify_needs,
          notify_services, notify_facilities, welcome_seen
        ) values (
          ${context.userId},
          ${name},
          ${data.bio ?? ""},
          ${data.phone ?? ""},
          ${data.street_hint ?? ""},
          ${skills},
          ${help},
          ${interests},
          ${lifeSeason},
          ${faithPosture},
          ${hopingFor},
          ${availability},
          ${Boolean(data.is_new_resident)},
          ${Boolean(data.is_youth)},
          ${data.notify_events ?? true},
          ${data.notify_needs ?? true},
          ${data.notify_services ?? true},
          ${data.notify_facilities ?? false},
          ${Boolean(data.welcome_seen)}
        )
      `;
    } else {
      await sql`
        update profiles set
          display_name = ${name},
          bio = ${data.bio ?? ""},
          phone = ${data.phone ?? ""},
          street_hint = ${data.street_hint ?? ""},
          skills = ${skills},
          help_offerings = ${help},
          interests = ${interests},
          life_season = ${lifeSeason},
          faith_posture = ${faithPosture},
          hoping_for = ${hopingFor},
          availability = ${availability},
          is_new_resident = ${Boolean(data.is_new_resident)},
          is_youth = ${Boolean(data.is_youth)},
          notify_events = ${data.notify_events ?? true},
          notify_needs = ${data.notify_needs ?? true},
          notify_services = ${data.notify_services ?? true},
          notify_facilities = ${data.notify_facilities ?? false},
          welcome_seen = coalesce(${data.welcome_seen ?? null}, welcome_seen),
          updated_at = now()
        where user_id = ${context.userId}
      `;
    }

    const rows = await sql<Record<string, unknown>>`
      select * from profiles where user_id = ${context.userId} limit 1
    `;
    return mapProfile(rows[0]!);
  });

export const getMyMemberships = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select m.*, c.slug as c_slug, c.name as c_name, c.tagline as c_tagline,
        c.city as c_city, c.state as c_state, c.kind as c_kind,
        c.member_count as c_member_count, c.cover_color as c_cover,
        c.is_featured as c_featured, c.invite_code as c_invite, c.description as c_desc
      from memberships m
      join communities c on c.id = m.community_id
      where m.user_id = ${context.userId}
      order by m.is_primary desc, c.name asc
    `;
    return rows.map(
      (r): Membership => ({
        id: String(r.id),
        user_id: String(r.user_id),
        community_id: String(r.community_id),
        role: String(r.role),
        status: String(r.status),
        joined_via: String(r.joined_via),
        is_primary: Boolean(r.is_primary),
        community: {
          id: String(r.community_id),
          slug: String(r.c_slug),
          name: String(r.c_name),
          tagline: String(r.c_tagline ?? ""),
          description: String(r.c_desc ?? ""),
          city: String(r.c_city ?? ""),
          state: String(r.c_state ?? ""),
          kind: String(r.c_kind) as Community["kind"],
          member_count: Number(r.c_member_count ?? 0),
          cover_color: String(r.c_cover ?? "sage"),
          is_featured: Boolean(r.c_featured),
          invite_code: String(r.c_invite),
        },
      }),
    );
  });

export const joinCommunities = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityIds: string[];
      primaryId?: string;
      joinedVia?: string;
      inviteCode?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const ids = [...new Set(data.communityIds.filter(Boolean))];
    if (ids.length === 0) throw new Error("Pick at least one community");

    const profile = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (profile.length === 0) {
      throw new Error("Create your profile before joining communities");
    }

    let via = data.joinedVia ?? "browse";
    if (data.inviteCode) {
      via = via === "browse" ? "invite" : via;
      await sql`
        update invites set uses = uses + 1
        where upper(code) = ${data.inviteCode.trim().toUpperCase()}
      `;
    }

    const existing = await sql<{ community_id: string }>`
      select community_id from memberships where user_id = ${context.userId}
    `;
    const have = new Set(existing.map((e) => e.community_id));
    const primary = data.primaryId && ids.includes(data.primaryId) ? data.primaryId : ids[0];

    if (primary) {
      await sql`
        update memberships set is_primary = false where user_id = ${context.userId}
      `;
    }

    for (const cid of ids) {
      if (have.has(cid)) {
        if (cid === primary) {
          await sql`
            update memberships set is_primary = true
            where user_id = ${context.userId} and community_id = ${cid}
          `;
        }
        continue;
      }
      await sql`
        insert into memberships (id, user_id, community_id, role, status, joined_via, is_primary)
        values (
          ${uid("mem")},
          ${context.userId},
          ${cid},
          'member',
          'active',
          ${via},
          ${cid === primary}
        )
      `;
      await sql`
        update communities set member_count = member_count + 1 where id = ${cid}
      `;
    }

    return { ok: true as const };
  });

export const leaveCommunity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((communityId: string) => communityId)
  .handler(async ({ context, data: communityId }) => {
    const sql = await db();
    const res = await sql`
      delete from memberships
      where user_id = ${context.userId} and community_id = ${communityId}
      returning id
    `;
    if (res.length > 0) {
      await sql`
        update communities set member_count = greatest(member_count - 1, 0)
        where id = ${communityId}
      `;
    }
    return { ok: true as const };
  });

// ── Needs / help ────────────────────────────────────────────────────────────

export const createNeed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityId: string;
      title: string;
      description?: string;
      category?: string;
      urgency?: string;
      is_paid?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId, data.communityId);
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const author = profile[0]?.display_name ?? "Neighbor";
    const id = uid("need");
    await sql`
      insert into needs (
        id, community_id, user_id, author_name, title, description,
        category, urgency, status, is_paid
      ) values (
        ${id},
        ${data.communityId},
        ${context.userId},
        ${author},
        ${title},
        ${data.description ?? ""},
        ${data.category ?? "general"},
        ${data.urgency ?? "normal"},
        'open',
        ${Boolean(data.is_paid)}
      )
    `;
    return { id };
  });

export const offerHelp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { needId: string; message?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const need = await sql<{ id: string; community_id: string; user_id: string; status: string }>`
      select id, community_id, user_id, status from needs where id = ${data.needId} limit 1
    `;
    if (!need[0]) throw new Error("Need not found");
    if (need[0].user_id === context.userId) throw new Error("You can't offer help on your own need");
    await ensureMember(sql, context.userId, need[0].community_id);

    const already = await sql`
      select id from offers_help where need_id = ${data.needId} and user_id = ${context.userId} limit 1
    `;
    if (already.length > 0) return { ok: true as const, already: true };

    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const helper = profile[0]?.display_name ?? "Neighbor";
    await sql`
      insert into offers_help (id, need_id, user_id, helper_name, message, status)
      values (
        ${uid("help")},
        ${data.needId},
        ${context.userId},
        ${helper},
        ${data.message?.trim() || "I can help with this."},
        'offered'
      )
    `;
    if (need[0].status === "open") {
      await sql`update needs set status = 'matched' where id = ${data.needId}`;
    }
    return { ok: true as const, already: false };
  });

export const acceptHelpOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { offerId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const rows = await sql<{ id: string; need_id: string; status: string }>`
      select o.id, o.need_id, o.status
      from offers_help o
      join needs n on n.id = o.need_id
      where o.id = ${data.offerId} and n.user_id = ${context.userId}
      limit 1
    `;
    if (!rows[0]) throw new Error("Offer not found");
    await sql`update offers_help set status = 'accepted' where id = ${data.offerId}`;
    await sql`update offers_help set status = 'withdrawn' where need_id = ${rows[0].need_id} and id <> ${data.offerId} and status = 'offered'`;
    await sql`update needs set status = 'matched' where id = ${rows[0].need_id}`;
    return { ok: true as const };
  });

export const markNeedDone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((needId: string) => needId)
  .handler(async ({ context, data: needId }) => {
    const sql = await db();
    const res = await sql`
      update needs set status = 'done'
      where id = ${needId} and user_id = ${context.userId}
      returning id
    `;
    if (res.length === 0) throw new Error("Need not found");
    return { ok: true as const };
  });

export const listMyIncomingOffers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select o.*, n.title as need_title, n.author_name as need_author
      from offers_help o
      join needs n on n.id = o.need_id
      where n.user_id = ${context.userId}
      order by o.created_at desc
      limit 40
    `;
    return rows.map(
      (r): HelpOffer => ({
        id: String(r.id),
        need_id: String(r.need_id),
        user_id: String(r.user_id),
        helper_name: String(r.helper_name),
        message: String(r.message ?? ""),
        status: String(r.status),
        created_at: String(r.created_at),
        need_title: String(r.need_title ?? ""),
        need_author: String(r.need_author ?? ""),
      }),
    );
  });

export const listMyOutgoingOffers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select o.*, n.title as need_title, n.author_name as need_author
      from offers_help o
      join needs n on n.id = o.need_id
      where o.user_id = ${context.userId}
      order by o.created_at desc
      limit 40
    `;
    return rows.map(
      (r): HelpOffer => ({
        id: String(r.id),
        need_id: String(r.need_id),
        user_id: String(r.user_id),
        helper_name: String(r.helper_name),
        message: String(r.message ?? ""),
        status: String(r.status),
        created_at: String(r.created_at),
        need_title: String(r.need_title ?? ""),
        need_author: String(r.need_author ?? ""),
      }),
    );
  });

// ── Services ────────────────────────────────────────────────────────────────

export const createService = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityId: string;
      title: string;
      description?: string;
      category?: string;
      pricing?: string;
      price_note?: string;
      is_business?: boolean;
      is_youth?: boolean;
      contact_hint?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId, data.communityId);
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const provider = profile[0]?.display_name ?? "Neighbor";
    const id = uid("svc");
    await sql`
      insert into services (
        id, community_id, user_id, provider_name, title, description,
        category, pricing, price_note, is_business, is_youth, contact_hint
      ) values (
        ${id},
        ${data.communityId},
        ${context.userId},
        ${provider},
        ${title},
        ${data.description ?? ""},
        ${data.category ?? "general"},
        ${data.pricing ?? "volunteer"},
        ${data.price_note ?? ""},
        ${Boolean(data.is_business)},
        ${Boolean(data.is_youth)},
        ${data.contact_hint ?? ""}
      )
    `;
    return { id };
  });

// ── Events ──────────────────────────────────────────────────────────────────

export const createEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityId: string;
      title: string;
      description?: string;
      kind?: string;
      location?: string;
      starts_at: string;
      capacity?: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId, data.communityId);
    const title = data.title.trim();
    if (!title || !data.starts_at) throw new Error("Title and start time required");
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const host = profile[0]?.display_name ?? "Neighbor";
    const id = uid("evt");
    await sql`
      insert into events (
        id, community_id, user_id, host_name, title, description,
        kind, location, starts_at, capacity, rsvp_count
      ) values (
        ${id},
        ${data.communityId},
        ${context.userId},
        ${host},
        ${title},
        ${data.description ?? ""},
        ${data.kind ?? "social"},
        ${data.location ?? ""},
        ${data.starts_at},
        ${data.capacity ?? null},
        0
      )
    `;
    return { id };
  });

export const rsvpEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((eventId: string) => eventId)
  .handler(async ({ context, data: eventId }) => {
    const sql = await db();
    const evt = await sql<{ community_id: string }>`
      select community_id from events where id = ${eventId} limit 1
    `;
    if (!evt[0]) throw new Error("Event not found");
    await ensureMember(sql, context.userId, evt[0].community_id);

    const existing = await sql`
      select id from event_rsvps where event_id = ${eventId} and user_id = ${context.userId}
    `;
    if (existing.length > 0) return { ok: true as const, already: true };
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const name = profile[0]?.display_name ?? "Neighbor";
    await sql`
      insert into event_rsvps (id, event_id, user_id, display_name)
      values (${uid("rsvp")}, ${eventId}, ${context.userId}, ${name})
    `;
    await sql`
      update events set rsvp_count = rsvp_count + 1 where id = ${eventId}
    `;
    return { ok: true as const, already: false };
  });

export const cancelRsvp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((eventId: string) => eventId)
  .handler(async ({ context, data: eventId }) => {
    const sql = await db();
    const res = await sql`
      delete from event_rsvps
      where event_id = ${eventId} and user_id = ${context.userId}
      returning id
    `;
    if (res.length > 0) {
      await sql`
        update events set rsvp_count = greatest(rsvp_count - 1, 0) where id = ${eventId}
      `;
    }
    return { ok: true as const };
  });

// ── Facilities ──────────────────────────────────────────────────────────────

export const requestFacility = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      facilityId: string;
      communityId: string;
      purpose: string;
      date_on: string;
      time_note?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId, data.communityId);
    if (!data.purpose.trim() || !data.date_on) throw new Error("Purpose and date required");
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const name = profile[0]?.display_name ?? "Neighbor";
    const id = uid("book");
    await sql`
      insert into facility_bookings (
        id, facility_id, community_id, user_id, booker_name,
        purpose, date_on, time_note, status
      ) values (
        ${id},
        ${data.facilityId},
        ${data.communityId},
        ${context.userId},
        ${name},
        ${data.purpose},
        ${data.date_on},
        ${data.time_note ?? ""},
        'requested'
      )
    `;
    return { id };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select b.*, f.name as facility_name
      from facility_bookings b
      join facilities f on f.id = b.facility_id
      where b.user_id = ${context.userId}
      order by b.created_at desc
      limit 30
    `;
    return rows.map(
      (r): FacilityBooking => ({
        id: String(r.id),
        facility_id: String(r.facility_id),
        community_id: String(r.community_id),
        user_id: String(r.user_id),
        booker_name: String(r.booker_name),
        purpose: String(r.purpose),
        date_on: String(r.date_on),
        time_note: String(r.time_note ?? ""),
        status: String(r.status),
        facility_name: String(r.facility_name ?? ""),
      }),
    );
  });

export const createPersonalInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { communityId: string; label?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await db();
    await ensureMember(sql, context.userId, data.communityId);
    const code = `NBR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const id = uid("inv");
    await sql`
      insert into invites (id, community_id, code, created_by, label)
      values (
        ${id},
        ${data.communityId},
        ${code},
        ${context.userId},
        ${data.label ?? "Personal invite"}
      )
    `;
    return { id, code };
  });

export const getMyActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const items: ActivityItem[] = [];

    const offersIn = await sql<Record<string, unknown>>`
      select o.id, o.helper_name, o.message, o.created_at, o.status, n.title
      from offers_help o
      join needs n on n.id = o.need_id
      where n.user_id = ${context.userId}
      order by o.created_at desc limit 10
    `;
    for (const r of offersIn) {
      items.push({
        id: `in_${r.id}`,
        kind: "offer",
        title: `${r.helper_name} offered help`,
        detail: `${r.title} · ${r.status}${r.message ? ` — ${r.message}` : ""}`,
        created_at: String(r.created_at),
        href: "/app/needs",
      });
    }

    const offersOut = await sql<Record<string, unknown>>`
      select o.id, o.status, o.created_at, n.title, n.author_name
      from offers_help o
      join needs n on n.id = o.need_id
      where o.user_id = ${context.userId}
      order by o.created_at desc limit 8
    `;
    for (const r of offersOut) {
      items.push({
        id: `out_${r.id}`,
        kind: "offer",
        title: `You offered help to ${r.author_name}`,
        detail: `${r.title} · ${r.status}`,
        created_at: String(r.created_at),
        href: "/app/needs",
      });
    }

    const rsvps = await sql<Record<string, unknown>>`
      select r.id, r.created_at, e.title, e.starts_at
      from event_rsvps r
      join events e on e.id = r.event_id
      where r.user_id = ${context.userId}
      order by r.created_at desc limit 8
    `;
    for (const r of rsvps) {
      items.push({
        id: `rsvp_${r.id}`,
        kind: "event",
        title: `RSVP: ${r.title}`,
        detail: "You're going",
        created_at: String(r.created_at),
        href: "/app/events",
      });
    }

    const books = await sql<Record<string, unknown>>`
      select b.id, b.created_at, b.status, b.date_on, f.name
      from facility_bookings b
      join facilities f on f.id = b.facility_id
      where b.user_id = ${context.userId}
      order by b.created_at desc limit 8
    `;
    for (const r of books) {
      items.push({
        id: `book_${r.id}`,
        kind: "booking",
        title: `Facility request: ${r.name}`,
        detail: `${r.date_on} · ${r.status}`,
        created_at: String(r.created_at),
        href: "/app/places",
      });
    }

    items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return items.slice(0, 20);
  });
