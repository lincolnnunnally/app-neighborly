-- Food pantry directory on existing Places (facilities).
-- place_kind distinguishes pantry listings from reservable rooms/pavilions.
-- No fabricated pantry hours or addresses — neighbors add/claim real listings.

alter table facilities add column if not exists place_kind text not null default 'reserve';
-- reserve | pantry
alter table facilities add column if not exists address text not null default '';
alter table facilities add column if not exists city text not null default '';
alter table facilities add column if not exists zip text not null default '';
alter table facilities add column if not exists serve_days text not null default '';
alter table facilities add column if not exists serve_times text not null default '';
alter table facilities add column if not exists residency_note text not null default '';
alter table facilities add column if not exists visit_frequency text not null default '';
alter table facilities add column if not exists id_docs text not null default '';
alter table facilities add column if not exists other_notes text not null default '';
alter table facilities add column if not exists phone text not null default '';
alter table facilities add column if not exists website text not null default '';
alter table facilities add column if not exists listed_by text not null default '';
alter table facilities add column if not exists listed_by_name text not null default '';

create index if not exists facilities_place_kind_idx on facilities (community_id, place_kind);
