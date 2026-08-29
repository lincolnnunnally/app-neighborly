-- Standing presence windows: a recurring container (e.g. Thursday 6–9),
-- not a score. Each week's gathering is still a real listing.

create table if not exists standing_windows (
  id           text primary key,
  community_id text,
  title        text not null,
  location     text not null default '',
  weekday      integer not null, -- 0 = Sunday
  start_time   text not null,
  end_time     text not null default '',
  mode         text not null default 'pick', -- pick | vote | adventurous
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
