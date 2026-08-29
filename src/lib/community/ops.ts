import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { uid } from "@/lib/utils";
import { ensureSeeded } from "./seed";
import { isOwnerEmail } from "@/lib/admin-stats";
import { fanoutGathering, fanoutServe, type FanoutResult, type FanoutTarget } from "./fanout";

export type { FanoutResult, FanoutTarget };

async function db() {
  const sql = await getSql();
  await ensureSeeded(sql);
  return sql;
}

async function requireOwner() {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  if (!isOwnerEmail(user.email)) throw new Error("Not the owner door");
  return user;
}

export type CommunityPulse = {
  id: string;
  slug: string;
  name: string;
  city: string;
  members: number;
  openNeeds: number;
  serveNeeds: number;
  events: number;
  rsvps: number;
};

export type SiblingPulse = {
  id: string;
  label: string;
  url: string;
  people: number | null;
  gatherings: number | null;
  extraLabel: string;
  extra: number | null;
  visible: boolean;
};

export type OpsIssue = {
  id: string;
  title: string;
  body: string;
  source_app: string;
  status: string;
  created_at: string;
};

export type OpsNeed = {
  id: string;
  title: string;
  author_name: string;
  category: string;
  status: string;
  community: string;
  created_at: string;
};

export type OpsEvent = {
  id: string;
  title: string;
  host_name: string;
  location: string;
  starts_at: string;
  rsvp_count: number;
  community: string;
};

export type StandingWindow = {
  id: string;
  title: string;
  location: string;
  weekday: number;
  start_time: string;
  end_time: string;
  mode: string;
  notes: string;
};

export type ConnectionPulse = {
  communities: CommunityPulse[];
  siblings: SiblingPulse[];
  issues: OpsIssue[];
  serveNeeds: OpsNeed[];
  upcomingEvents: OpsEvent[];
  standingWindows: StandingWindow[];
};

async function countPublic(table: string): Promise<number | null> {
  if (!/^[a-z_]+$/.test(table)) return null;
  const sql = await db();
  try {
    const found = await sql.query<{ n: number }>(
      `select count(*)::int as n
         from information_schema.tables
        where table_schema in ('public', 'neighborly')
          and table_name = $1`,
      [table],
    );
    if (!found[0] || Number(found[0].n) === 0) return null;
    const rows = await sql.query<{ c: number }>(`select count(*)::int as c from ${table}`);
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

async function countPublicWhere(table: string, whereSql: string): Promise<number | null> {
  if (!/^[a-z_]+$/.test(table)) return null;
  const sql = await db();
  try {
    const found = await sql.query<{ n: number }>(
      `select count(*)::int as n
         from information_schema.tables
        where table_schema in ('public', 'neighborly')
          and table_name = $1`,
      [table],
    );
    if (!found[0] || Number(found[0].n) === 0) return null;
    const rows = await sql.query<{ c: number }>(
      `select count(*)::int as c from ${table} where ${whereSql}`,
    );
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

export async function loadConnectionPulse(): Promise<ConnectionPulse> {
  const sql = await db();

  const communityRows = await sql<Record<string, unknown>>`
    select
      c.id, c.slug, c.name, c.city, c.member_count,
      (select count(*)::int from needs n where n.community_id = c.id and n.status = 'open') as open_needs,
      (select count(*)::int from needs n where n.community_id = c.id and n.category = 'serve' and n.status = 'open') as serve_needs,
      (select count(*)::int from events e where e.community_id = c.id) as events,
      (select coalesce(sum(e.rsvp_count), 0)::int from events e where e.community_id = c.id) as rsvps
    from communities c
    order by c.is_featured desc, c.name asc
  `;

  const communities: CommunityPulse[] = communityRows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    city: String(r.city ?? ""),
    members: Number(r.member_count ?? 0),
    openNeeds: Number(r.open_needs ?? 0),
    serveNeeds: Number(r.serve_needs ?? 0),
    events: Number(r.events ?? 0),
    rsvps: Number(r.rsvps ?? 0),
  }));

  const [
    kndPeople,
    kndMeetups,
    lomNeeds,
    lomActs,
    kindredPeople,
    kindredEvents,
    presenceMoments,
    asPeople,
  ] = await Promise.all([
    countPublic("knd_user_profiles"),
    countPublicWhere("knd_local_meetups", "meetup_date >= current_date"),
    countPublicWhere("lom_needs_requests", "status = 'open'"),
    countPublicWhere("lom_events_activities", "status = 'active'"),
    countPublic("kindred_profiles"),
    countPublicWhere("kindred_events", "status = 'active'"),
    countPublicWhere("presence_moments", "status = 'open'"),
    countPublic("as_profiles"),
  ]);

  const siblings: SiblingPulse[] = [
    {
      id: "knd",
      label: "Kids Need Dads",
      url: "https://dads.unitedundergod.org",
      people: kndPeople,
      gatherings: kndMeetups,
      extraLabel: "Upcoming dad meetups",
      extra: kndMeetups,
      visible: kndPeople !== null,
    },
    {
      id: "kindred",
      label: "Kindred (friendship)",
      url: "https://kindred.unitedundergod.org/admin",
      people: kindredPeople,
      gatherings: kindredEvents,
      extraLabel: "Active events",
      extra: kindredEvents,
      visible: kindredPeople !== null,
    },
    {
      id: "aligned",
      label: "Aligned Souls",
      url: "https://alignedsouls.unitedundergod.org/admin",
      people: asPeople,
      gatherings: null,
      extraLabel: "Matches are never padded",
      extra: null,
      visible: asPeople !== null,
    },
    {
      id: "lom",
      label: "Live On Mission",
      url: "https://liveonmission.unitedundergod.org/admin-ops",
      people: null,
      gatherings: lomActs,
      extraLabel: "Open serve needs",
      extra: lomNeeds,
      visible: lomActs !== null || lomNeeds !== null,
    },
    {
      id: "presence",
      label: "Presence Moments",
      url: "https://presence.unitedundergod.org/admin",
      people: null,
      gatherings: presenceMoments,
      extraLabel: "Open moments",
      extra: presenceMoments,
      visible: presenceMoments !== null,
    },
  ];

  let issues: OpsIssue[] = [];
  try {
    const issueRows = await sql<Record<string, unknown>>`
      select id, title, body, source_app, status, created_at
      from ops_issues
      order by case status when 'open' then 0 when 'doing' then 1 else 2 end, created_at desc
      limit 40
    `;
    issues = issueRows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      body: String(r.body ?? ""),
      source_app: String(r.source_app),
      status: String(r.status),
      created_at: String(r.created_at),
    }));
  } catch {
    issues = [];
  }

  const serveRows = await sql<Record<string, unknown>>`
    select n.id, n.title, n.author_name, n.category, n.status, n.created_at, c.name as community
    from needs n
    join communities c on c.id = n.community_id
    where n.category = 'serve'
    order by n.created_at desc
    limit 20
  `;
  const serveNeeds: OpsNeed[] = serveRows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    author_name: String(r.author_name),
    category: String(r.category),
    status: String(r.status),
    community: String(r.community),
    created_at: String(r.created_at),
  }));

  const eventRows = await sql<Record<string, unknown>>`
    select e.id, e.title, e.host_name, e.location, e.starts_at, e.rsvp_count, c.name as community
    from events e
    join communities c on c.id = e.community_id
    order by e.starts_at asc
    limit 20
  `;
  const upcomingEvents: OpsEvent[] = eventRows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    host_name: String(r.host_name),
    location: String(r.location ?? ""),
    starts_at: String(r.starts_at),
    rsvp_count: Number(r.rsvp_count ?? 0),
    community: String(r.community),
  }));

  let standingWindows: StandingWindow[] = [];
  try {
    const winRows = await sql<Record<string, unknown>>`
      select id, title, location, weekday, start_time, end_time, mode, notes
      from standing_windows
      order by weekday asc, start_time asc
    `;
    standingWindows = winRows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      location: String(r.location ?? ""),
      weekday: Number(r.weekday ?? 0),
      start_time: String(r.start_time ?? ""),
      end_time: String(r.end_time ?? ""),
      mode: String(r.mode ?? "pick"),
      notes: String(r.notes ?? ""),
    }));
  } catch {
    standingWindows = [];
  }

  return { communities, siblings, issues, serveNeeds, upcomingEvents, standingWindows };
}

export const getConnectionPulse = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    | { status: "signed_out" }
    | { status: "forbidden"; email: string | null }
    | { status: "ok"; email: string; pulse: ConnectionPulse }
  > => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser();
    if (!user) return { status: "signed_out" };
    if (!isOwnerEmail(user.email)) return { status: "forbidden", email: user.email };
    return {
      status: "ok",
      email: user.email ?? "lincoln@unitedundergod.org",
      pulse: await loadConnectionPulse(),
    };
  },
);

const DEFAULT_TARGETS: FanoutTarget[] = ["kindred", "presence", "knd", "lom", "churchconnect"];

export const ownerCreateEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityId: string;
      title: string;
      description?: string;
      location?: string;
      starts_at: string;
      kind?: string;
      targets?: FanoutTarget[];
      standing?: {
        weekday: number;
        start_time: string;
        end_time?: string;
        mode?: string;
      };
    }) => input,
  )
  .handler(async ({ context, data }) => {
    await requireOwner();
    const sql = await db();
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    if (!data.starts_at) throw new Error("When is required");
    const comm = await sql<{ id: string; city: string }>`
      select id, city from communities where id = ${data.communityId} limit 1
    `;
    if (!comm[0]) throw new Error("Community not found");
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const host = profile[0]?.display_name || "Owner listing";
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let standingNote = "";
    if (data.standing) {
      const day = weekdayNames[data.standing.weekday] ?? "weekly";
      const mode = data.standing.mode || "pick";
      standingNote = `Standing window: ${day} ${data.standing.start_time}${data.standing.end_time ? `–${data.standing.end_time}` : ""} (${mode}). Same people, new memory — not a new match.`;
      const winId = uid("win");
      try {
        await sql`
          insert into standing_windows (
            id, community_id, title, location, weekday, start_time, end_time, mode, notes
          ) values (
            ${winId},
            ${data.communityId},
            ${title},
            ${data.location ?? ""},
            ${data.standing.weekday},
            ${data.standing.start_time},
            ${data.standing.end_time ?? ""},
            ${mode},
            ${data.description ?? ""}
          )
        `;
      } catch (e) {
        standingNote += ` (window row not saved: ${e instanceof Error ? e.message : "unknown"})`;
      }
    }
    const description = [data.description ?? "", standingNote].filter(Boolean).join("\n\n");
    const id = uid("evt");
    await sql`
      insert into events (
        id, community_id, user_id, host_name, title, description, kind, location, starts_at, ends_at, capacity, rsvp_count
      ) values (
        ${id},
        ${data.communityId},
        ${context.userId},
        ${host},
        ${title},
        ${description},
        ${data.kind ?? "social"},
        ${data.location ?? ""},
        ${data.starts_at},
        '',
        null,
        0
      )
    `;
    const fanout = await fanoutGathering(
      sql,
      {
        title,
        description,
        location: data.location ?? "",
        startsAt: data.starts_at,
        city: comm[0].city || "Vidalia",
        hostName: host,
        ownerUserId: context.userId,
        kind: data.kind,
        standingNote,
      },
      data.targets?.length ? data.targets : DEFAULT_TARGETS,
    );
    return { id, fanout };
  });

export const ownerCreateServeNeed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityId: string;
      orgType: string;
      orgName: string;
      title: string;
      description?: string;
      whenNote?: string;
      whereNote?: string;
      targets?: FanoutTarget[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    await requireOwner();
    const sql = await db();
    const title = data.title.trim();
    const org = data.orgName.trim();
    if (!title || !org) throw new Error("Organization and need are required");
    const comm = await sql<{ id: string; name: string }>`
      select id, name from communities where id = ${data.communityId} limit 1
    `;
    if (!comm[0]) throw new Error("Community not found");
    const author = `${org} (${data.orgType || "group"})`;
    const desc = [
      data.description?.trim() || "",
      data.whenNote?.trim() ? `When: ${data.whenNote.trim()}` : "",
      data.whereNote?.trim() ? `Where: ${data.whereNote.trim()}` : "",
      "Posted by the ops desk so people who want to serve can show up with others.",
    ]
      .filter(Boolean)
      .join("\n");
    const id = uid("need");
    await sql`
      insert into needs (
        id, community_id, user_id, author_name, title, description, category, urgency, status, is_paid
      ) values (
        ${id},
        ${data.communityId},
        ${context.userId},
        ${author},
        ${title},
        ${desc},
        'serve',
        'normal',
        'open',
        false
      )
    `;

    const fanout = await fanoutServe(
      sql,
      {
        title,
        description: desc,
        orgName: author,
        orgType: data.orgType,
        whenNote: data.whenNote ?? "",
        whereNote: data.whereNote ?? "",
        city: "Vidalia",
      },
      data.targets?.length ? data.targets : ["lom", "kindred", "churchconnect"],
    );
    const lom = fanout.find((f) => f.dest === "lom");
    return {
      id,
      fanout,
      lomPosted: Boolean(lom?.ok),
      lomError: lom?.ok ? null : lom?.error ?? null,
    };
  });

export const ownerCreateIssue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; body?: string; source_app?: string }) => input)
  .handler(async ({ context, data }) => {
    await requireOwner();
    const sql = await db();
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    const id = uid("iss");
    await sql`
      insert into ops_issues (id, title, body, source_app, status, created_by)
      values (
        ${id},
        ${title},
        ${data.body ?? ""},
        ${data.source_app || "neighborly"},
        'open',
        ${context.userId}
      )
    `;
    return { id };
  });

export const ownerUpdateIssue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => input)
  .handler(async ({ data }) => {
    await requireOwner();
    const sql = await db();
    const status = data.status;
    if (!["open", "doing", "done"].includes(status)) throw new Error("Bad status");
    await sql`
      update ops_issues set status = ${status}, updated_at = now() where id = ${data.id}
    `;
    return { ok: true as const };
  });
