-- Provenance for pantry listings.
--
-- 0011 let a neighbor list a pantry they can speak for. Some real Toombs County
-- pantries are published by the agency itself (a food bank locator, a church's
-- own ministry page, a county referral list) and belong on the board before any
-- neighbor happens to claim them. Those rows are listed_by = 'system' /
-- listed_by_name = 'Public listing' — the same honest shape events already use
-- for public listings — and they must carry WHERE the facts came from and WHEN
-- they were last checked, so a neighbor can judge them and call ahead.
--
-- This is the opposite of inventing a listing: no row may exist here without a
-- source_url a person can open.

alter table facilities add column if not exists source_url text not null default '';
alter table facilities add column if not exists source_name text not null default '';
-- YYYY-MM-DD the facts above were last read off the source.
alter table facilities add column if not exists verified_on text not null default '';

create index if not exists facilities_pantry_city_idx
  on facilities (place_kind, city);
