-- Neighborly community connections schema

create table if not exists communities (
  id            text primary key,
  slug          text not null unique,
  name          text not null,
  tagline       text not null default '',
  description   text not null default '',
  city          text not null default '',
  state         text not null default '',
  kind          text not null default 'neighborhood', -- neighborhood | church | school | interest | vacation
  member_count  integer not null default 0,
  cover_color   text not null default 'sage',
  is_featured   boolean not null default false,
  invite_code   text not null unique,
  created_at    timestamptz not null default now()
);

create table if not exists profiles (
  user_id           text primary key,
  display_name      text not null,
  bio               text not null default '',
  phone             text not null default '',
  street_hint       text not null default '', -- "Oak Lane near the park" — no full address required
  skills            text not null default '[]', -- JSON string array
  help_offerings    text not null default '[]', -- JSON string array
  interests         text not null default '[]',
  is_new_resident   boolean not null default false,
  is_youth          boolean not null default false, -- kids offering services (with parent oversight note)
  notify_events     boolean not null default true,
  notify_needs      boolean not null default true,
  notify_services   boolean not null default true,
  notify_facilities boolean not null default false,
  welcome_seen      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists memberships (
  id              text primary key,
  user_id         text not null,
  community_id    text not null references communities(id) on delete cascade,
  role            text not null default 'member', -- member | helper | organizer | business
  status          text not null default 'active', -- active | pending
  joined_via      text not null default 'browse', -- browse | invite | qr | link | search
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, community_id)
);
create index if not exists memberships_user_id_idx on memberships (user_id);
create index if not exists memberships_community_id_idx on memberships (community_id);

create table if not exists needs (
  id              text primary key,
  community_id    text not null references communities(id) on delete cascade,
  user_id         text not null,
  author_name     text not null,
  title           text not null,
  description     text not null default '',
  category        text not null default 'general', -- household | yard | errands | tech | care | project | other
  urgency         text not null default 'normal', -- low | normal | soon | urgent
  status          text not null default 'open', -- open | matched | done | cancelled
  is_paid         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists needs_community_id_idx on needs (community_id);

create table if not exists services (
  id              text primary key,
  community_id    text not null references communities(id) on delete cascade,
  user_id         text not null,
  provider_name   text not null,
  title           text not null,
  description     text not null default '',
  category        text not null default 'general',
  pricing         text not null default 'volunteer', -- volunteer | paid | tip | free
  price_note      text not null default '',
  is_business     boolean not null default false,
  is_youth        boolean not null default false,
  contact_hint    text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists services_community_id_idx on services (community_id);

create table if not exists events (
  id              text primary key,
  community_id    text not null references communities(id) on delete cascade,
  user_id         text not null,
  host_name       text not null,
  title           text not null,
  description     text not null default '',
  kind            text not null default 'social', -- social | cleanup | kids | food | meeting | other
  location        text not null default '',
  starts_at       text not null, -- ISO date-time string for simple demo
  ends_at         text not null default '',
  capacity        integer,
  rsvp_count      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists events_community_id_idx on events (community_id);

create table if not exists event_rsvps (
  id              text primary key,
  event_id        text not null references events(id) on delete cascade,
  user_id         text not null,
  display_name    text not null,
  created_at      timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists facilities (
  id              text primary key,
  community_id    text not null references communities(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  capacity        integer,
  amenities       text not null default '[]', -- JSON
  rate_note       text not null default '',
  contact_name    text not null default '',
  created_at      timestamptz not null default now()
);

create table if not exists facility_bookings (
  id              text primary key,
  facility_id     text not null references facilities(id) on delete cascade,
  community_id    text not null,
  user_id         text not null,
  booker_name     text not null,
  purpose         text not null default '',
  date_on         text not null, -- YYYY-MM-DD
  time_note       text not null default '',
  status          text not null default 'requested', -- requested | approved | declined
  created_at      timestamptz not null default now()
);

create table if not exists offers_help (
  id              text primary key,
  need_id         text not null references needs(id) on delete cascade,
  user_id         text not null,
  helper_name     text not null,
  message         text not null default '',
  status          text not null default 'offered', -- offered | accepted | withdrawn
  created_at      timestamptz not null default now()
);

create table if not exists invites (
  id              text primary key,
  community_id    text not null references communities(id) on delete cascade,
  code            text not null unique,
  created_by      text not null default 'system',
  label           text not null default '',
  uses            integer not null default 0,
  max_uses        integer,
  created_at      timestamptz not null default now()
);
create index if not exists invites_code_idx on invites (code);

create table if not exists seed_meta (
  key   text primary key,
  value text not null
);
