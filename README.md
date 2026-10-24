# OpenCal

**Open-source calendar platform** — multi-calendar sync with privacy controls, scheduling links, a unified calendar view, ICS sharing, teams, and an MCP server for AI assistants. Self-host it anywhere: your laptop, a VPS, Docker, or Vercel.

![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

| Feature | Details |
|---------|---------|
| **Calendar sync** | One-way & multi-way sync between Google, Outlook, and iCloud. Privacy field mapping (titles → "Busy", strip descriptions/locations/attendees), clone-loop protection, color/RSVP filters |
| **Scheduling links** | Calendly-style booking pages: multiple durations, buffers, minimum notice, custom questions, approval flow, branding, collective (multi-host) links |
| **Unified calendar** | Week view across all accounts, create/edit/delete events, hide sync clones, join meetings |
| **Calendar sharing** | ICS feeds (busy-only or full detail) that subscribe from any calendar app |
| **MCP server** | `/api/mcp` tools so AI assistants can list/create/update/delete events and check availability |
| **Teams** | Invite teammates, collective booking links, anonymized busy blocks |

### Providers

| Provider | Auth | Notes |
|----------|------|-------|
| **Google Calendar** | OAuth2 | Connect from **Accounts** once `GOOGLE_CLIENT_ID/SECRET` are set. Redirect URI: `<host>/api/oauth/google/callback`. Tokens auto-refresh |
| **Microsoft Outlook** | OAuth2 / Graph | Connect from **Accounts** once `MICROSOFT_CLIENT_ID/SECRET` are set. Redirect URI: `<host>/api/oauth/outlook/callback`. Tokens auto-refresh |
| **iCloud** | Apple ID + app-specific password (CalDAV) | List/create/update/delete; poll ~5–10 min (Apple limitation) |
| **Mock** | none | Only in demo mode (`DEMO_MODE=true`) for trying the app without OAuth |

## Run locally

Postgres is required. The Mac mini SQLite deployment tracks `main` until this branch is merged.

```bash
git clone https://github.com/spz-ct4723/opencal.git && cd opencal
npm install
cp .env.example .env        # set DATABASE_URL, DIRECT_URL, and AUTH_SECRET
npm run db:migrate:deploy   # applies prisma/migrations to DIRECT_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

Optional demo data: set `DEMO_MODE="true"` in `.env` and run `npm run seed`, then log in as `demo@opencal.dev` / `demo1234`.

## Database

PostgreSQL only on this branch. Runtime uses `DATABASE_URL` (Supabase transaction pooler on Vercel). Migrations use `DIRECT_URL` (session pooler, port 5432). See [docs/VERCEL.md](docs/VERCEL.md).

`npm run db:migrate:deploy` is manual. The Vercel build does not migrate and does not connect to the database.

The pre-cutover SQLite migration history is in `prisma/migrations-sqlite/`. Copy an existing SQLite file with `scripts/migrate-sqlite-to-postgres.ts` (dry-run unless you pass `--apply`).

## Deploy

### Vercel

The project `opencal` is linked. Preview deployments come from non-main branches. Environment variables, the baseline migration, OAuth redirect URIs, and the cutover runbook are in [docs/VERCEL.md](docs/VERCEL.md).

`vercel-build` is `prisma generate && next build`. Apply `prisma/migrations/20261023120000_baseline` yourself with `npm run db:migrate:deploy`.

### Docker

```bash
cp .env.example .env   # point DATABASE_URL and DIRECT_URL at 127.0.0.1:5432
docker compose up -d db
npm run db:migrate:deploy
docker compose up --build
```

Compose includes a local Postgres and overrides the app container URLs to hostname `db`. The password in `docker-compose.yml` is a local default. Host-side `db:migrate:deploy` uses `DIRECT_URL` from `.env` (`127.0.0.1`).

### Any Node host

```bash
npm ci && npm run db:migrate:deploy && npm run build && npm run start
```

Needs Node 20.19+, 22.12+, or 24+ and a Postgres URL.

## Environment reference

See [.env.example](.env.example). Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Pooled Postgres URL (port 6543 on Supabase) |
| `DIRECT_URL` | for migrations | Session/direct Postgres URL (port 5432) |
| `AUTH_SECRET` | yes | Session signing secret |
| `AUTH_URL` | production only | Canonical origin. Leave unset on Vercel Preview |
| `GOOGLE_CLIENT_ID/SECRET` | for Google sync | OAuth app with Calendar API |
| `MICROSOFT_CLIENT_ID/SECRET` | for Outlook sync | Entra app with `Calendars.ReadWrite` |
| `CRON_SECRET` | for background sync | Auth for `/api/cron/sync` |
| `DEMO_MODE` | no (default off) | Mock providers + demo login for evaluation |

## Background sync (cron)

```bash
curl -X POST https://your-host/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

On a single server, run it every 1–5 minutes. On Vercel Hobby, Cron can run only once a day (`vercel.json` uses 12:00 UTC) and only on production. See [docs/VERCEL.md](docs/VERCEL.md).

## MCP (AI assistants)

`POST /api/mcp` with a session cookie (or `Authorization: Bearer demo` in demo mode only):

```bash
curl -X POST https://your-host/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"list_events","params":{}}'
```

Tools: `list_calendars`, `list_events`, `get_availability`, `create_event`, `update_event`, `delete_event`. `GET /api/mcp` returns discovery info.

## ICS share feeds

Create a share link in **Calendar Sharing**, then subscribe in any calendar app:

```
https://your-host/api/share/<token>
```

## Architecture

```
src/
  app/
    (app)/               # Authenticated UI: calendar, syncs, scheduling, …
    book/[user]/[slug]/  # Public booking pages
    api/                 # REST + OAuth + MCP + cron + ICS
  lib/
    providers/           # google | outlook | icloud | mock
    sync/engine.ts       # Clone transform + loop-safe multi-way sync
    scheduling/          # Availability slot computation
    oauth.ts             # OAuth flows + token refresh
prisma/schema.prisma
```

**Sync engine highlights**

1. Pull source calendars into the local event cache
2. Filter by RSVP / free / color
3. Transform fields per privacy config
4. Upsert clones on targets (remote provider + local DB)
5. Delete orphan clones once per target, after all source pairs sync
6. Skip any event already marked `isClone`, so multi-way sync cannot loop

## Production checklist

1. `DEMO_MODE` unset or `false`
2. Postgres via `DATABASE_URL` / `DIRECT_URL`. Apply migrations manually
3. Strong `AUTH_SECRET` and `CRON_SECRET`; TLS in front of the app
4. OAuth apps configured with the callback URLs in [docs/VERCEL.md](docs/VERCEL.md)
5. Hobby Cron is daily. Use an external poller or Vercel Pro for frequent sync
6. Tokens and iCloud app passwords are plaintext columns today. There is no encryption key

## License

MIT — free to use, modify, and self-host.
