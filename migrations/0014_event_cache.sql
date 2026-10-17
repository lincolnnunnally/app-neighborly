-- Weekend feed cache: public events fetched daily from public sources.
-- The app reads these server-side as the table owner. RLS is on so the data API
-- can only ever expose the public event rows, never source health.

create table if not exists event_sources (
  id               text primary key,
  name             text not null default '',
  kind             text not null default '',
  url              text not null default '',
  last_attempt_at  timestamptz,
  last_success_at  timestamptz,
  last_error       text,
  last_count       integer not null default 0,
  covered_from     date,
  covered_to       date
);

create table if not exists public_events (
  id          text primary key,
  source_id   text not null,
  title       text not null,
  start_at    timestamptz not null,
  end_at      timestamptz,
  all_day     boolean not null default false,
  multi_day   boolean not null default false,
  venue       text not null default '',
  city        text not null default '',
  lat         double precision,
  lon         double precision,
  url         text not null,
  image       text,
  organizer   text not null default '',
  category    text not null default 'community',
  free        boolean,
  summary     text not null default '',
  fetched_at  timestamptz not null default now()
);
create index if not exists public_events_source_idx on public_events (source_id);
create index if not exists public_events_start_idx on public_events (start_at);

create table if not exists venue_geocodes (
  query       text primary key,
  lat         double precision,
  lon         double precision,
  found       boolean not null default false,
  looked_up_at timestamptz not null default now()
);

alter table event_sources enable row level security;
alter table public_events enable row level security;
alter table venue_geocodes enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and not exists (select 1 from pg_policies where schemaname = current_schema() and tablename = 'public_events' and policyname = 'public_events_read') then
    execute 'create policy public_events_read on public_events for select to anon, authenticated using (true)';
  end if;
end $$;
