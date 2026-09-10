# Neighborly

Community connections for neighbors — live test market **Vidalia, Georgia** (Milstead remains).

- Free-text search across every board — needs, events, services, tools, places,
  pantries, communities, and (signed in) neighbors
- Post and answer needs
- Local services (including youth offerings)
- Borrow / list physical tools (Stripe payments parked)
- Events & RSVPs, including Bible studies / small groups / ministry
- Facility reservations
- Food pantry listings on Places (Toombs / Vidalia; neighbors add/claim — no invented hours)
- Ministry door: studies, ways to serve, and how to start one
- Multi-community membership
- Invite links & QR codes

## Production hosts

- https://neighborly.unitedundergod.org — product home
- https://community.unitedundergod.org — Community Connections label; this app is canonical (the old Next prototype is parked)
- In-app Vidalia board: `/c/vidalia`
- Weekend planner (weather + Pal/Visit Vidalia listings + calendar .ics): `/weekend`
- City / ZIP lookup (cached one day per town; lookup does **not** auto-create an empty board): `/near`
- Churches door (ChurchConnect public records, not a second DB): `/churches`
- Search anything (public, works signed out; `?slug=` scopes it to one board): `/search`
- Bible studies, ministry & ways to serve: `/ministry?place=vidalia`
- Pickleball / dads circles: `/c/vidalia-pickleball`, `/c/vidalia-dads`
- Milstead board still live: `/c/milstead`

`milstead.unitedundergod.org` is **not** Neighborly (that host currently serves ChurchConnect). Do not send Neighborly users there. Do not steal that host.

## Stack

TanStack Start, React 19, Tailwind v4, Better Auth.

## Search

`/search` and the board filter share one scoring module (`src/lib/community/search.ts`)
so the server SQL pass and the client-side board filter rank the same words the
same way. Intent expansion lets spoken words ("groceries", "hungry") reach real
rows whose text differs ("benevolence closet"), but a **synonym alone never
counts as a match** — those hits are labelled *loosely related* and ranked below
anything containing a word that was actually typed. SQL uses `lower(...) like $n`
rather than `ilike` or `to_tsvector`, so PGLite preview and Supabase Postgres
behave identically with no extension to install.

## Pantry listings & provenance

Pantry rows carry `source_url` / `source_name` / `verified_on` (migration 0012).
The Toombs County listings in `src/lib/community/toombs-pantries.ts` are
transcribed from public sources — chiefly the Southeast Health District's dated
*Toombs County Community Resource Guide* — and ship as `Public listing` rows with
`verified_on` empty, which the UI renders as **Unconfirmed** with a call-ahead
line and a link to the source. Hours are published only where two independent
sources agree; where sources disagree on an address, no address is published at
all — unless a newer first-party source settles it (God's Store House moved in
2022, which its own filed accounts and the local paper both record, so the
current address is published with a note about the stale directory line).
Listings carry `facebook_url` (migration 0013) alongside `website`: for a small
church pantry, the Facebook page is usually where a closure or a changed day is
announced first, so it is the most useful link when hours are unconfirmed. Any member can claim a public listing and correct it, which makes them its
owner and stops the seed from touching it again. See the rules at the top of
`toombs-pantries.ts` before adding rows.

**Database (ecosystem rule):** production uses the shared **LPL Supabase**
Postgres (`DATABASE_URL`), tables in schema `neighborly`. **Neon is not used**
for this app — Neon is for AppEngine customer databases only. Local sandbox
preview falls back to embedded PGLite when `DATABASE_URL` is unset.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck

# Browser QA (dev server must be running on :8080)
node scripts/qa-search.mjs     # search, pantries, ministry, login redirect
node scripts/qa-pantries.mjs
```

`scripts/qa-*.mjs` honour `PW_CHROMIUM_PATH` when the pinned Playwright browser
build is not the one installed on the runner.
