import type { Sql } from "@/lib/db";

/**
 * Seed first-market structure once per DB lifetime.
 *
 * DC-1: do NOT invent named neighbors, fake needs, or fake services presented
 * as real people. Communities and facilities are real places/structures;
 * open boards start empty so the first real posts are honest.
 */
export async function ensureSeeded(sql: Sql): Promise<void> {
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
