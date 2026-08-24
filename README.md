# Neighborly

Community connections for neighbors — first market **Milstead**.

- Post and answer needs
- Local services (including youth offerings)
- Events & RSVPs
- Facility reservations
- Multi-community membership
- Invite links & QR codes

## Production hosts

- https://neighborly.unitedundergod.org — product home
- In-app Milstead board: `/c/milstead`

`milstead.unitedundergod.org` is **not** Neighborly (that host currently serves ChurchConnect). Do not send Neighborly users there.

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
