-- Lightweight provider portfolio on the existing services listing.
-- Inquiry is in-app only — no Stripe / Engrave Pay.

alter table services add column if not exists photo_url text not null default '';
alter table services add column if not exists portfolio_url text not null default '';
alter table services add column if not exists maker_bio text not null default '';

create table if not exists service_inquiries (
  id              text primary key,
  service_id      text not null references services(id) on delete cascade,
  user_id         text not null,
  inquirer_name   text not null,
  message         text not null default '',
  status          text not null default 'sent', -- sent | read
  created_at      timestamptz not null default now()
);
create index if not exists service_inquiries_service_id_idx on service_inquiries (service_id);
create index if not exists service_inquiries_user_id_idx on service_inquiries (user_id);
