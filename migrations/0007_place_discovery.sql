-- Place discovery: ZIP/city lookup, refresh cadence, fit preferences.
-- No fabricated listings. Refresh is a timestamp + log, not an LLM crawl.

alter table communities add column if not exists zip text not null default '';
alter table communities add column if not exists lat double precision;
alter table communities add column if not exists lon double precision;
alter table communities add column if not exists calendar_refreshed_at timestamptz;

create index if not exists communities_city_state_idx on communities (lower(city), lower(state));
create index if not exists communities_zip_idx on communities (zip);

alter table profiles add column if not exists setting_pref text not null default '';
-- outdoor | indoor | mixed | ''
alter table profiles add column if not exists mobility text not null default '';
-- walking | seated | mixed | ''
alter table profiles add column if not exists digest_opt_in boolean not null default false;
alter table profiles add column if not exists digest_cadence text not null default 'off';
-- off | weekly | daily — daily is the paid-shape; we do not charge until mail is proven.

create table if not exists place_refresh_log (
  id text primary key,
  community_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'ok',
  listings_found integer not null default 0,
  note text not null default ''
);
create index if not exists place_refresh_log_community_idx on place_refresh_log (community_id, started_at desc);
