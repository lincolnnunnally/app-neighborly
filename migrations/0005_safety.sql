-- Safety: report content/people, and block a neighbor so they leave your feed.
-- One pair of tables for the whole board — no parallel moderation stack.

create table if not exists safety_reports (
  id               text primary key,
  reporter_id      text not null,
  content_type     text not null, -- person | need | event | service
  content_id       text,
  reported_user_id text,
  content_excerpt  text,
  reason           text not null,
  details          text not null default '',
  status           text not null default 'open', -- open | reviewing | resolved
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists safety_reports_status_idx
  on safety_reports (status, created_at desc);
create index if not exists safety_reports_reporter_idx
  on safety_reports (reporter_id, created_at desc);

create table if not exists user_blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocked_idx on user_blocks (blocked_id);
