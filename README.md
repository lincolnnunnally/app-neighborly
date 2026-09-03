# Neighborly

Community connections for neighbors — live test market **Vidalia, Georgia** (Milstead remains).

- Post and answer needs
- Local services (including youth offerings)
- Events & RSVPs
- Facility reservations
- Multi-community membership
- Invite links & QR codes

## Production hosts

- https://neighborly.unitedundergod.org — product home
- https://community.unitedundergod.org — Community Connections label; this app is canonical (the old Next prototype is parked)
- In-app Vidalia board: `/c/vidalia`
- Weekend planner (weather + Pal/Visit Vidalia listings + calendar .ics): `/weekend`
- City / ZIP lookup (cached one day per town, honest empty if new): `/near`
- Pickleball / dads circles: `/c/vidalia-pickleball`, `/c/vidalia-dads`
- Milstead board still live: `/c/milstead`

`milstead.unitedundergod.org` is **not** Neighborly (that host currently serves ChurchConnect). Do not send Neighborly users there. Do not steal that host.

## Stack

TanStack Start, React 19, Tailwind v4, Better Auth.

**Database (ecosystem rule):** production uses the shared **LPL Supabase**
Postgres (`DATABASE_URL`), tables in schema `neighborly`. **Neon is not used**
for this app — Neon is for AppEngine customer databases only. Local sandbox
preview falls back to embedded PGLite when `DATABASE_URL` is unset.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
```
