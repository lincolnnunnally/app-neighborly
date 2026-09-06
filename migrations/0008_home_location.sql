-- Saved home place for "my community / researching."
-- ZIP or city+state is enough. Browser geolocation is optional and never auto-creates a town.

alter table profiles add column if not exists home_zip text not null default '';
alter table profiles add column if not exists home_city text not null default '';
alter table profiles add column if not exists home_state text not null default '';
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists home_lon double precision;
