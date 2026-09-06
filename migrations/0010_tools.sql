-- Physical tool inventory (NOT services/labor). Sandlot remains kids toys only.
-- Live Stripe is parked: payment_intent columns are stubs until keys + flag.

create table if not exists tools (
  id                       text primary key,
  community_id             text not null references communities(id) on delete cascade,
  user_id                  text not null,
  owner_name               text not null,
  title                    text not null,
  description              text not null default '',
  category                 text not null default 'lawn',
  -- lawn | power | automotive | home_repair | trailers | outdoor | other
  condition                text not null default 'good',
  -- excellent | good | fair | needs_work
  photo_urls               text not null default '[]',
  daily_rate_cents         integer not null default 0,
  replacement_value_cents  integer not null default 0,
  runs_ready               boolean not null default false,
  status                   text not null default 'listed', -- listed | paused
  street_hint              text not null default '',
  created_at               timestamptz not null default now()
);
create index if not exists tools_community_id_idx on tools (community_id);
create index if not exists tools_user_id_idx on tools (user_id);
create index if not exists tools_category_idx on tools (category);

create table if not exists tool_bookings (
  id                         text primary key,
  tool_id                    text not null references tools(id) on delete cascade,
  community_id               text not null,
  owner_user_id              text not null,
  borrower_user_id           text not null,
  borrower_name              text not null,
  start_date                 text not null, -- YYYY-MM-DD
  end_date                   text not null,
  days                       integer not null,
  meetup_note                text not null default '',
  rental_cents               integer not null,
  platform_fee_cents         integer not null,
  owner_payout_cents         integer not null,
  deposit_cents              integer not null,
  status                     text not null default 'reserved',
  -- reserved | pickup_arranged | out | return_pending | returned | cancelled | disputed
  payment_status             text not null default 'coming_soon',
  -- coming_soon | authorized | captured | released | failed
  stripe_rental_intent_id    text not null default '',
  stripe_deposit_intent_id   text not null default '',
  owner_confirmed_return     boolean not null default false,
  borrower_confirmed_return  boolean not null default false,
  damage_note                text not null default '',
  admin_note                 text not null default '',
  created_at                 timestamptz not null default now()
);
create index if not exists tool_bookings_tool_id_idx on tool_bookings (tool_id);
create index if not exists tool_bookings_borrower_idx on tool_bookings (borrower_user_id);
create index if not exists tool_bookings_owner_idx on tool_bookings (owner_user_id);

create table if not exists tool_messages (
  id            text primary key,
  booking_id    text not null references tool_bookings(id) on delete cascade,
  user_id       text not null,
  author_name   text not null,
  message       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists tool_messages_booking_id_idx on tool_messages (booking_id);
