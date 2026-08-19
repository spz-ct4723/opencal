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

```bash
git clone https://github.com/spz-ct4723/opencal.git && cd opencal
npm install
cp .env.example .env        # then set AUTH_SECRET (openssl rand -hex 32)
npx prisma migrate dev      # creates the SQLite database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

Optional demo data (mock calendars, sample sync + scheduling links): set `DEMO_MODE="true"` in `.env` and run `npm run seed`, then log in as `demo@opencal.dev` / `demo1234`.

## Databases

- **SQLite** (default) — zero setup, ideal for local dev, VPS, and Docker deployments.
- **PostgreSQL** — set `DATABASE_URL=postgresql://…` and everything adapts automatically (the Prisma provider is resolved from the URL at generate time, and the app picks the matching driver at runtime). Required for serverless hosts like Vercel, where the filesystem is ephemeral.

Apply the schema to Postgres with `npm run db:push`.

## Deploy

### Vercel (via GitHub)

1. Push this repo to GitHub and **Import** it in Vercel.
2. Create a Postgres database (Vercel Marketplace: Neon, Supabase, etc.).
3. Set environment variables on the project:
   - `DATABASE_URL` — your Postgres connection string
   - `AUTH_SECRET` — `openssl rand -hex 32`
   - optionally `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `CRON_SECRET`
4. Deploy. The `vercel-build` script runs `prisma db push` automatically, so the schema is created on first deploy.
5. For background sync, add a Vercel Cron Job hitting `POST /api/cron/sync` with header `Authorization: Bearer $CRON_SECRET`.

### Docker

```bash
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build
```

SQLite data persists in the `opencal-data` volume. Point `DATABASE_URL` at Postgres in `docker-compose.yml` if you prefer.

### Any Node host

```bash
npm ci && npm run build && npm run start
```

Needs Node 20.9+ and a persistent disk (SQLite) or a Postgres URL.

## Environment reference

See [.env.example](.env.example). Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | `file:./dev.db` (SQLite) or `postgresql://…` |
| `AUTH_SECRET` | yes | Session signing secret |
| `NEXTAUTH_URL` | on non-Vercel hosts | Public base URL |
| `GOOGLE_CLIENT_ID/SECRET` | for Google sync | OAuth app with Calendar API |
| `MICROSOFT_CLIENT_ID/SECRET` | for Outlook sync | Entra app with `Calendars.ReadWrite` |
| `CRON_SECRET` | for background sync | Auth for `/api/cron/sync` |
| `DEMO_MODE` | no (default off) | Mock providers + demo login for evaluation |

## Background sync (cron)

```bash
curl -X POST https://your-host/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Run every 1–5 minutes. Google/Outlook feel near real-time with frequent polling; iCloud is slower by design.

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
2. Postgres for serverless hosts; SQLite is fine on a single server with a persistent disk
3. Strong `AUTH_SECRET` and `CRON_SECRET`; TLS in front of the app
4. OAuth apps configured with the exact callback URLs above
5. Schedule `/api/cron/sync` for continuous syncing
6. Consider encrypting `appPassword`/tokens at rest (KMS) for larger deployments

## License

MIT — free to use, modify, and self-host.
