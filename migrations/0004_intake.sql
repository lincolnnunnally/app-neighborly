-- Community intake: self-described season, faith posture, hopes, availability.
-- Not a clinical label. Not a dating wall. Used to recommend groups and
-- sibling apps — never to lock someone into one circle.

alter table profiles add column if not exists life_season text not null default '';
alter table profiles add column if not exists faith_posture text not null default '';
alter table profiles add column if not exists hoping_for text not null default '';
alter table profiles add column if not exists availability text not null default '[]';
