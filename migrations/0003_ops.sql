-- Owner ops desk: issues to work, not invented activity.
-- Volunteer requests stay on `needs` (category = 'serve') so there is one
-- board for neighbors — no parallel volunteer table.

create table if not exists ops_issues (
  id          text primary key,
  title       text not null,
  body        text not null default '',
  source_app  text not null default 'neighborly',
  status      text not null default 'open', -- open | doing | done
  created_by  text not null default 'owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ops_issues_status_idx on ops_issues (status, created_at desc);
