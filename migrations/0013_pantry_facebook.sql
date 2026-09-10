-- A Facebook page for a pantry listing.
--
-- Most Toombs County pantries have no website at all, but several keep an
-- active Facebook page — and for a small church pantry that page is usually
-- where a change of hours actually gets announced. That makes it the single
-- most useful link we can hand a neighbor whose listed hours we could not
-- confirm, so it gets its own column rather than competing with `website`
-- (a couple of them have both).

alter table facilities add column if not exists facebook_url text not null default '';
