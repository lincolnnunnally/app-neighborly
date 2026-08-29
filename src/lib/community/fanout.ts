/**
 * One owner listing → sibling tables on the shared LPL database.
 * Neighborly is the owner door, not a new hub. Each destination is optional:
 * missing tables or FK mismatches fail loud and the UI reports them.
 */
import type { Sql } from "@/lib/db";
import { uid } from "@/lib/utils";

export type FanoutTarget =
  | "kindred"
  | "presence"
  | "knd"
  | "lom"
  | "churchconnect";

export type FanoutResult = {
  dest: FanoutTarget | "churchconnect_volunteer";
  label: string;
  ok: boolean;
  id?: string;
  error?: string;
};

export type GatheringListing = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  city: string;
  hostName: string;
  ownerUserId: string;
  kind?: string;
  standingNote?: string;
};

export type ServeListing = {
  title: string;
  description: string;
  orgName: string;
  orgType: string;
  whenNote: string;
  whereNote: string;
  city: string;
};

const LABELS: Record<FanoutResult["dest"], string> = {
  kindred: "Kindred events",
  presence: "Presence moments",
  knd: "Kids Need Dads meetups",
  lom: "Live On Mission",
  churchconnect: "ChurchConnect activities",
  churchconnect_volunteer: "ChurchConnect volunteer board",
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function splitWhen(startsAt: string): { date: string; time: string; iso: string } {
  const raw = startsAt.trim();
  const date = raw.slice(0, 10);
  const time = raw.includes("T") ? raw.slice(11, 16) : "18:00";
  const iso = raw.length === 16 ? `${raw}:00` : raw;
  return { date, time, iso };
}

function kindredType(kind?: string): string {
  if (kind === "cleanup" || kind === "serve") return "volunteer";
  if (kind === "meeting") return "church";
  return "social";
}

function presenceActivity(kind?: string): string {
  if (kind === "food") return "Meal";
  if (kind === "cleanup") return "Walk";
  if (kind === "kids") return "Game";
  return "Other";
}

async function tryDest(
  dest: FanoutResult["dest"],
  run: () => Promise<string | undefined>,
): Promise<FanoutResult> {
  try {
    const id = await run();
    return { dest, label: LABELS[dest], ok: true, id };
  } catch (e) {
    return { dest, label: LABELS[dest], ok: false, error: errMsg(e).slice(0, 240) };
  }
}

async function findVidaliaChurch(
  sql: Sql,
): Promise<{ id: string; name: string; city: string; state: string; subdomain: string } | null> {
  const q = `select id::text as id, name, coalesce(city,'') as city, coalesce(state,'') as state,
                    coalesce(subdomain,'') as subdomain
               from churches
              where city ilike '%Vidalia%'
                 or name ilike '%United Under God%'
                 or name ilike '%First Baptist%Vidalia%'
              order by case when city ilike '%Vidalia%' then 0 else 1 end
              limit 1`;
  try {
    const rows = await sql.query<{
      id: string;
      name: string;
      city: string;
      state: string;
      subdomain: string;
    }>(q);
    if (rows[0]) return rows[0];
  } catch {
    /* churches table may not exist on this search_path */
  }
  try {
    const rows = await sql.query<{
      id: string;
      name: string;
      city: string;
      state: string;
      subdomain: string;
    }>(
      `select id::text as id, name, coalesce(city,'') as city, coalesce(state,'') as state,
              coalesce(subdomain,'') as subdomain
         from church_organizations
        where city ilike '%Vidalia%' or name ilike '%United Under God%'
        limit 1`,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function fanoutGathering(
  sql: Sql,
  listing: GatheringListing,
  targets: FanoutTarget[],
): Promise<FanoutResult[]> {
  const { date, time, iso } = splitWhen(listing.startsAt);
  const blurb = [
    listing.description,
    listing.standingNote,
    "Public listing from the Vidalia connection desk. Confirm before you go. The win is showing up, not this screen.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const results: FanoutResult[] = [];
  const want = new Set(targets);

  if (want.has("kindred")) {
    results.push(
      await tryDest("kindred", async () => {
        const id = uid("kevt");
        await sql.query(
          `insert into public.kindred_events (
             id, title, description, type, intent, starts_at, location, address, city, region,
             host_name, source, external_id, status, featured, attendees, attended,
             cultivates, stretch_level, social_shape, pastoral_blurb, tags
           ) values (
             $1,$2,$3,$4,'either',$5,$6,$6,$7,'GA',
             $8,'admin',$1,'active', false, '[]'::jsonb, '[]'::jsonb,
             '["joy","courage"]'::jsonb, 'gentle', 'small_group', $9, '[]'::jsonb
           )`,
          [
            id,
            listing.title,
            blurb,
            kindredType(listing.kind),
            iso,
            listing.location,
            listing.city,
            listing.hostName,
            "A public gathering. Friendship can wait until you have sat together once.",
          ],
        );
        return id;
      }),
    );
  }

  if (want.has("presence")) {
    results.push(
      await tryDest("presence", async () => {
        const rows = await sql.query<{ id: string }>(
          `insert into public.presence_moments (
             host_auth_user_id, host_name, activity, title, starts_at, place, city,
             vibes, capacity, note, charter_agreed, status
           ) values (
             $1, $2, $3, $4, $5, $6, $7,
             $8::text[], 8, $9, true, 'open'
           ) returning id::text as id`,
          [
            listing.ownerUserId,
            listing.hostName,
            presenceActivity(listing.kind),
            listing.title,
            iso,
            listing.location,
            `${listing.city}, GA`,
            ["No agenda", "Faith-friendly open"],
            blurb.slice(0, 500),
          ],
        );
        if (!rows[0]?.id) throw new Error("Presence insert returned no id");
        return rows[0].id;
      }),
    );
  }

  if (want.has("knd")) {
    results.push(
      await tryDest("knd", async () => {
        const rows = await sql.query<{ id: string }>(
          `insert into public.knd_local_meetups (
             organizer_id, title, description, city, state, location_details,
             meetup_date, meetup_time, max_attendees
           ) values (
             $1, $2, $3, $4, 'GA', $5, $6::date, $7, null
           ) returning id::text as id`,
          [
            listing.ownerUserId,
            listing.title,
            blurb,
            listing.city,
            listing.location,
            date,
            time.length === 5 ? `${time}:00` : time,
          ],
        );
        if (!rows[0]?.id) throw new Error("Kids Need Dads insert returned no id");
        return rows[0].id;
      }),
    );
  }

  if (want.has("lom")) {
    results.push(
      await tryDest("lom", async () => {
        const rows = await sql.query<{ id: string }>(
          `insert into public.lom_events_activities (
             title, description, type, intent, starts_at, ends_at, location, city,
             host_name, source, featured, status
           ) values (
             $1, $2, $3, 'either', $4, '', $5, $6, $7, 'admin', false, 'active'
           ) returning id::text as id`,
          [
            listing.title,
            blurb,
            kindredType(listing.kind),
            iso,
            listing.location,
            listing.city,
            listing.hostName,
          ],
        );
        if (!rows[0]?.id) throw new Error("Live On Mission insert returned no id");
        return rows[0].id;
      }),
    );
  }

  if (want.has("churchconnect")) {
    const church = await findVidaliaChurch(sql);
    if (!church) {
      results.push({
        dest: "churchconnect",
        label: LABELS.churchconnect,
        ok: false,
        error:
          "No Vidalia / United Under God church row in ChurchConnect yet. Add the church there, then post again.",
      });
    } else {
      results.push(
        await tryDest("churchconnect", async () => {
          const ev = await sql.query<{ id: string }>(
            `insert into public.events (
               title, description, start_date, location, address, category,
               is_published, is_public, status, church_id, event_type, target_audience
             ) values (
               $1, $2, $3, $4, $4, $5, true, true, 'published', $6::uuid, 'community', 'Community'
             ) returning id::text as id`,
            [
              listing.title,
              blurb,
              iso,
              listing.location,
              kindredType(listing.kind) === "volunteer" ? "Outreach" : "Community",
              church.id,
            ],
          );
          const eventId = ev[0]?.id;
          if (!eventId) throw new Error("ChurchConnect events insert returned no id");
          try {
            await sql.query(
              `insert into public.public_events_feed (
                 event_id, church_id, title, description, start_date, location, address,
                 city, state, category, church_name, church_subdomain, church_city, church_state,
                 is_community_wide, is_featured
               ) values (
                 $1::uuid, $2::uuid, $3, $4, $5, $6, $6, $7, 'GA', $8, $9, $10, $11, 'GA', true, false
               )
               on conflict (event_id) do update set title = excluded.title, start_date = excluded.start_date`,
              [
                eventId,
                church.id,
                listing.title,
                blurb,
                iso,
                listing.location,
                listing.city,
                "Community",
                church.name,
                church.subdomain,
                church.city || listing.city,
              ],
            );
          } catch (feedErr) {
            throw new Error(
              `Event row ${eventId} saved; public feed failed: ${errMsg(feedErr).slice(0, 160)}`,
            );
          }
          return eventId;
        }),
      );
    }
  }

  return results;
}

export async function fanoutServe(
  sql: Sql,
  listing: ServeListing,
  targets: FanoutTarget[],
): Promise<FanoutResult[]> {
  const results: FanoutResult[] = [];
  const want = new Set(targets);
  const desc = listing.description;

  if (want.has("lom")) {
    results.push(
      await tryDest("lom", async () => {
        await sql.query(
          `insert into public.lom_needs_requests
             (requester_id, requester_name, title, description, category, urgency, city, date_needed, recurring, status)
           values ($1, $2, $3, $4, 'general', 'normal', $5, $6, false, 'open')`,
          [null, listing.orgName, listing.title, desc, listing.city, listing.whenNote],
        );
        return "lom-need";
      }),
    );
  }

  if (want.has("kindred")) {
    results.push(
      await tryDest("kindred", async () => {
        const id = uid("kevt");
        const when = listing.whenNote || new Date().toISOString();
        await sql.query(
          `insert into public.kindred_events (
             id, title, description, type, intent, starts_at, location, city, region,
             host_name, source, external_id, status, featured, attendees, attended, tags
           ) values (
             $1,$2,$3,'volunteer','serving',$4,$5,$6,'GA',
             $7,'admin',$1,'active', false, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
           )`,
          [
            id,
            listing.title,
            desc,
            when,
            listing.whereNote,
            listing.city,
            listing.orgName,
          ],
        );
        return id;
      }),
    );
  }

  if (want.has("churchconnect")) {
    const church = await findVidaliaChurch(sql);
    if (!church) {
      results.push({
        dest: "churchconnect_volunteer",
        label: LABELS.churchconnect_volunteer,
        ok: false,
        error:
          "No Vidalia / United Under God church row in ChurchConnect yet. Volunteer board needs a church.",
      });
    } else {
      results.push(
        await tryDest("churchconnect_volunteer", async () => {
          const rows = await sql.query<{ id: string }>(
            `insert into public.volunteer_opportunities (
               church_id, title, description, category, commitment_type, schedule_details,
               location, is_public, is_active, contact_name
             ) values (
               $1::uuid, $2, $3, 'outreach', 'one_time', $4, $5, true, true, $6
             ) returning id::text as id`,
            [
              church.id,
              listing.title,
              desc,
              listing.whenNote,
              listing.whereNote || listing.city,
              listing.orgName,
            ],
          );
          if (!rows[0]?.id) throw new Error("ChurchConnect volunteer insert returned no id");
          return rows[0].id;
        }),
      );
    }
  }

  return results;
}
