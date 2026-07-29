import type { Sql } from "@/lib/db";

/** Seed first-market demo data once per DB lifetime. */
export async function ensureSeeded(sql: Sql): Promise<void> {
  const rows = await sql<{ value: string }>`
    select value from seed_meta where key = 'community_v1'
  `;
  if (rows.length > 0) return;

  // Milstead.US — primary test market
  await sql`
    insert into communities (
      id, slug, name, tagline, description, city, state, kind,
      member_count, cover_color, is_featured, invite_code
    ) values (
      'comm_milstead',
      'milstead',
      'Milstead',
      'Neighbors helping neighbors across Milstead',
      'The first Neighborly test market. Post a need, offer a skill, plan a block party, or welcome someone new. Whether you have lived here for decades or just arrived, this is how we look out for each other.',
      'Milstead',
      'GA',
      'neighborhood',
      48,
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
      'Prayer requests, meal trains, rides to service, and practical help for members and neighbors.',
      'Milstead',
      'GA',
      'church',
      32,
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
      21,
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
      14,
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

  // Sample needs
  await sql`
    insert into needs (
      id, community_id, user_id, author_name, title, description,
      category, urgency, status, is_paid
    ) values
    (
      'need_1', 'comm_milstead', 'sample_eleanor', 'Eleanor H.',
      'Need help changing porch lightbulbs',
      'I am 78 and cannot safely climb a ladder. Two porch lights need new bulbs — I have the bulbs already.',
      'household', 'soon', 'open', false
    ),
    (
      'need_2', 'comm_milstead', 'sample_marcus', 'Marcus T.',
      'Looking for Saturday help moving a couch',
      'Need one or two strong people for about 45 minutes this Saturday morning. Happy to pay or trade BBQ.',
      'project', 'normal', 'open', true
    ),
    (
      'need_3', 'comm_milstead', 'sample_priya', 'Priya S.',
      'New here — would love a welcome walk-through',
      'We just moved in on Maple Court. Looking for someone to show us the parks, the library, and a good coffee spot.',
      'care', 'low', 'open', false
    ),
    (
      'need_4', 'comm_milstead', 'sample_tom', 'Tom R.',
      'Leak under kitchen sink — temporary help?',
      'Need someone handy to look before the plumber can come next week. Bucket is catching it for now.',
      'household', 'urgent', 'open', true
    )
  `;

  // Sample services
  await sql`
    insert into services (
      id, community_id, user_id, provider_name, title, description,
      category, pricing, price_note, is_business, is_youth, contact_hint
    ) values
    (
      'svc_1', 'comm_milstead', 'sample_jake', 'Jake M. (age 14)',
      'Lawn mowing & leaf raking',
      'I mow small yards, rake leaves, and water plants. Parents know I am offering this.',
      'kids', 'paid', '$20–35 per yard', false, true, 'Message via Neighborly'
    ),
    (
      'svc_2', 'comm_milstead', 'sample_ana', 'Ana''s Handyman',
      'Small home repairs & fixture swaps',
      'Licensed local handyman. Light fixtures, shelves, drywall patches, door adjustments.',
      'household', 'paid', 'Free estimates', true, false, 'ana-handyman.local'
    ),
    (
      'svc_3', 'comm_milstead', 'sample_dee', 'Dee W.',
      'Elder companion visits',
      'Retired nurse. Happy to visit, chat, run short errands, or sit with someone while family is out.',
      'care', 'volunteer', 'Volunteer — tips optional', false, false, 'Message via Neighborly'
    ),
    (
      'svc_4', 'comm_milstead', 'sample_sam', 'Sam & Mia (siblings)',
      'Pet sitting & dog walks',
      'We walk dogs after school and can feed pets while you travel. References available.',
      'kids', 'paid', '$10/walk or $25/day', false, true, 'Message via Neighborly'
    ),
    (
      'svc_5', 'comm_milstead_church', 'sample_meal', 'Fellowship Meal Train',
      'Meal train coordination',
      'We organize meals for families recovering from illness, new babies, or grief.',
      'care', 'volunteer', 'Volunteer', false, false, 'fellowship@milstead'
    )
  `;

  // Events — use relative dates from "now" via fixed demo dates that feel near-term
  const nextSat = nextWeekdayIso(6, 17, 0);
  const nextSun = nextWeekdayIso(0, 12, 0);
  const inTen = daysFromNowIso(10, 9, 0);

  await sql`
    insert into events (
      id, community_id, user_id, host_name, title, description,
      kind, location, starts_at, ends_at, capacity, rsvp_count
    ) values
    (
      'evt_1', 'comm_milstead', 'sample_org', 'Milstead Neighbors',
      'Maple Court block party',
      'Bring a side dish or dessert. Kids games, music, and a chance to meet the new families on the street.',
      'social', 'Maple Court cul-de-sac', ${nextSat}, '', 80, 23
    ),
    (
      'evt_2', 'comm_milstead', 'sample_org', 'Parks Committee',
      'Creek trail community cleanup',
      'Gloves and bags provided. Great for families. Coffee and donuts at 8:45am.',
      'cleanup', 'Creek Trail parking lot', ${inTen}, '', 40, 12
    ),
    (
      'evt_3', 'comm_milstead', 'sample_org', 'Fire Station Aux.',
      'Neighborhood BBQ & safety open house',
      'Tour the station, meet first responders, and grill out. Free for residents.',
      'food', 'Milstead Fire Station', ${nextSun}, '', 120, 41
    ),
    (
      'evt_4', 'comm_oakridge', 'sample_hoa', 'Oakridge HOA',
      'Pool pavilion open booking day',
      'Reserve the pavilion for birthdays and reunions. Bring your calendar.',
      'meeting', 'Oakridge Pool Pavilion', ${daysFromNowIso(5, 18, 30)}, '', 30, 8
    )
  `;

  await sql`
    insert into facilities (
      id, community_id, name, description, capacity, amenities, rate_note, contact_name
    ) values
    (
      'fac_1', 'comm_milstead', 'Community Center multipurpose room',
      'Indoor space for birthday parties, meetings, and classes. Tables and chairs included.',
      60, ${JSON.stringify(["Tables", "Chairs", "Kitchenette", "Wi‑Fi"])},
      'Resident rate $45 / half day', 'Town office'
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
      'HOA members $25 deposit', 'HOA board'
    )
  `;

  await sql`
    insert into seed_meta (key, value) values ('community_v1', '1')
  `;
}

function daysFromNowIso(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Next occurrence of weekday (0=Sun … 6=Sat) at local hour/minute. */
function nextWeekdayIso(weekday: number, hour: number, minute: number): string {
  const d = new Date();
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
