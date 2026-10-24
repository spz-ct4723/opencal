# OpenCal on Vercel (Supabase Postgres)

This branch is the cutover from the Mac mini's SQLite database to Supabase Postgres. It stays unmerged until that cutover is approved. The mini keeps tracking `main` and is the fallback.

The Vercel project `opencal` is already linked. Pushes to this branch create preview deployments. The build does not connect to the database and does not run migrations.

## Connection model

| Use | Variable | What it is |
| --- | --- | --- |
| Runtime queries | `DATABASE_URL` | Supavisor **transaction** pooler, port **6543**, with `pgbouncer=true`, `connection_limit=1`, and `sslmode=require` |
| Migrations and the SQLite copy | `DIRECT_URL` | Supavisor **session** pooler (or the direct host), port **5432**, with `sslmode=require` |

Prisma 7.8 has no `directUrl` field on the datasource. `prisma.config.ts` sets the CLI datasource URL to `DIRECT_URL`. `src/lib/db.ts` opens `DATABASE_URL` through `@prisma/adapter-pg` (`PrismaPg` + `pg`). That is the generic node-postgres adapter, not a Neon adapter.

If `DATABASE_URL` is unset, the runtime falls back to `POSTGRES_PRISMA_URL`. If `DIRECT_URL` is unset, migrations fall back to `POSTGRES_URL_NON_POOLING`. Those are the Vercel Marketplace Supabase names. They are unused when `DATABASE_URL` and `DIRECT_URL` are set, which is how this project is configured. Migrations never fall back onto the transaction pooler.

`pgbouncer` and `connection_limit` are Prisma flags. node-postgres does not enforce them, so the runtime pool uses `max: 1` on Vercel and whenever the URL is the transaction pooler. Those two flags are stripped before the string is given to `pg`. `sslmode` is kept. Named prepared statements are not cached, which is what Supavisor transaction mode requires.

The database role is `opencal_app`. It is not a superuser. It must be allowed to `CREATE` objects in schema `public`. The baseline SQL does not create the schema and does not create extensions.

## Baseline migration (final)

Folder: `prisma/migrations/20261023120000_baseline`

File: `prisma/migrations/20261023120000_baseline/migration.sql`

That file is the Postgres baseline. Do not regenerate it. `prisma migrate diff` also emits `CREATE SCHEMA IF NOT EXISTS "public"`, and that statement fails for `opencal_app` (`permission denied for database`) even though `public` already exists. That statement is not in this file.

SHA-256 of `migration.sql` (this is the checksum Prisma stores):

`950a9e48ff1a8cb14ede407415ada1c7056cdaaaa05d55934aef5fa219c15cad`

The old SQLite history is in `prisma/migrations-sqlite/` (folder `20260713003023_init`, lock provider `sqlite`). It is outside `prisma/migrations`, so `prisma migrate deploy` will not run it.

## Environment variables

Set secrets in the Vercel project, not in git. `.env.example` has placeholders only.

| Name | Required | Secret | Environments | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | yes | yes | Production, Preview | Pooled runtime connection |
| `DIRECT_URL` | yes, for migrate and the data copy | yes | Production, Preview (the build does not use it to connect) | Session/direct connection |
| `POSTGRES_PRISMA_URL` | no | yes | — | Fallback only when `DATABASE_URL` is unset |
| `POSTGRES_URL_NON_POOLING` | no | yes | — | Fallback only when `DIRECT_URL` is unset |
| `AUTH_SECRET` | yes | yes | Production, Preview | Auth.js session signing |
| `AUTH_URL` | production only, once the canonical origin is fixed | no | Production, not Preview | Canonical https origin. Overrides the request host |
| `NEXTAUTH_URL` | no | no | same rule as `AUTH_URL` | Legacy alias. `AUTH_URL` wins when both are set |
| `GOOGLE_CLIENT_ID` | for Google connect | no | Production, Preview | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | for Google connect | yes | Production, Preview | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | for Outlook connect | no | Production, Preview | Entra application id |
| `MICROSOFT_CLIENT_SECRET` | for Outlook connect | yes | Production, Preview | Entra client secret |
| `CRON_SECRET` | yes, if cron or an external sync poller is used | yes | Production, Preview | Bearer token for `/api/cron/sync` |
| `DEMO_MODE` | no | no | leave unset | `true` turns on mock calendars and the `demo` MCP bearer. Keep it off |
| `OPENCAL_URL` | no | no | not a Vercel app var | Base URL for the local MCP probe |
| `OPENCAL_MCP_TOKEN` | no | yes | not a Vercel app var | Bearer for that probe. Defaults to `demo` |
| `DATABASE_POOL_MAX` | no | no | local/Docker only | Pool size when not on Vercel and not using port 6543. Default 10 |

There is no token-encryption key. OAuth access tokens, refresh tokens, and iCloud app-specific passwords are stored as plaintext columns on `Account`. Supabase disk encryption is not application-level encryption. Adding a key later means re-encrypting rows that the copy script writes as-is.

`AUTH_SECRET` on Vercel should stay distinct from the mini's secret so the two deployments do not share sessions.

## What the Vercel build does

`vercel-build` and `build` are `prisma generate && next build`.

- `prisma generate` does not open a connection.
- `next build` does not run `prisma migrate deploy` or `prisma db push`.
- Authenticated pages are `force-dynamic`, so the build does not prerender them against the database.

Apply the schema yourself, once, from a machine that has `DIRECT_URL`:

```bash
npm run db:migrate:deploy
```

That runs `prisma migrate deploy` against `DIRECT_URL` and records `20261023120000_baseline` in `_prisma_migrations` with the checksum above. Run it as `opencal_app`. A second run applies nothing. The script refuses a port 6543 / `pgbouncer=true` URL.

Do not run `prisma migrate dev` against Supabase. That tries to create a shadow database, which `opencal_app` cannot do. Future schema changes: generate SQL locally with `prisma migrate diff`, commit a new folder under `prisma/migrations`, and apply it with `npm run db:migrate:deploy`.

## Cutover runbook

1. Leave this PR unmerged. Confirm the preview build is green and the mini is still serving from `main`.
2. On the empty Supabase project, run `npm run db:migrate:deploy` with `DIRECT_URL` set to the session pooler (port 5432). Confirm `_prisma_migrations.migration_name` is `20261023120000_baseline` and the checksum matches the value above.
3. Register the OAuth redirect URIs below before connecting Google or Outlook.
4. Pause writes on the mini (stop the launchd service, or accept a short freeze).
5. Copy the mini's SQLite file to the machine that will run the copy. The copy script only reads that file.
6. Dry-run, then apply. Both use `DIRECT_URL`, not the transaction pooler.

```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts --sqlite /path/to/opencal.db --dry-run
npx tsx scripts/migrate-sqlite-to-postgres.ts --sqlite /path/to/opencal.db --apply
```

`--apply` upserts on primary key inside one transaction. It keeps ids, timestamps, and foreign keys. Booleans stored as 0/1, datetimes stored as ISO text, and JSON stored as text are converted on the way in. After the write it compares every column and rolls back if anything differs. Running it again updates rows in place.

7. Smoke-test the Vercel deployment: register, log in, open the calendar. Connect a provider only after the redirect URIs exist.
8. Merge only when that check is acceptable. Until then the mini on `main` is still the live app.

The copy script is not run by CI, the Vercel build, or `npm install`.

## Rollback

- Do not merge this PR. The mini's launchd service keeps running the SQLite app from `main`.
- The copy script does not modify the SQLite file.
- A bad preview database can be dropped and recreated in Supabase. Re-apply the baseline, then re-run the copy.
- Vercel environment variables can stay. They do not affect the mini.
- After a merge you no longer want, redeploy `main` on Vercel or disable the Vercel project and keep using the mini. Do not point the mini at Supabase until `main` contains this branch.

## OAuth redirect URIs

Callbacks are built from the browser's origin (`/api/oauth/{google|outlook}/callback`), not from `AUTH_URL`.

Register these on the Google Cloud OAuth client and the Entra app redirect URI list:

- `https://opencal-eight.vercel.app/api/oauth/google/callback`
- `https://opencal-eight.vercel.app/api/oauth/outlook/callback`

Preview deployments get their own host. The stable alias for this branch will look like:

`https://opencal-git-cursor-vercel-supabase-postgres-9798-davids-projects-55de01b1.vercel.app`

DNS labels are limited to 63 characters, so Vercel may shorten that alias. After the preview deployment exists, copy the exact branch URL from the Vercel deployment page and register:

- `https://<that-host>/api/oauth/google/callback`
- `https://<that-host>/api/oauth/outlook/callback`

Per-deployment URLs (`opencal-<hash>-…vercel.app`) change on every push. Register the branch alias if you need OAuth on the preview. iCloud has no OAuth callback. It uses an Apple ID and an app-specific password stored on the account row.

The OAuth state cookie is `Secure` when the request is HTTPS.

Leave `AUTH_URL` and `NEXTAUTH_URL` unset on Preview. `trustHost` is on, so Auth.js uses the preview host. If `AUTH_URL` is set, Auth.js rewrites the request origin to that value and preview sign-in follows the production host. Set `AUTH_URL` on Production only, to `https://opencal-eight.vercel.app` (or a later custom domain).

## Cron and the Hobby plan

`vercel.json` schedules `GET /api/cron/sync` at `0 12 * * *` (12:00 UTC, once a day). Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set. `GET` and `POST` both require that header. If the secret is missing, the route returns 401.

Hobby Cron cannot run more than once a day, and Cron does not run on preview deployments. The daily job is a safety net for production, not the 1–5 minute poll this app was written for. Google and Outlook will look stale. iCloud was already limited to about 5–10 minutes by Apple.

The route sets `maxDuration` to 60 seconds, which is the Hobby function ceiling. A sync that calls several providers can still be killed at that limit. An external scheduler (the mini's launchd) may `POST` the production URL more often, but the function is subject to the same duration cap. Vercel Pro is what raises the cron interval to once a minute and raises the duration ceiling.

## MCP and the filesystem

`/api/mcp` is a normal serverless route and works on Vercel with a session cookie. `src/mcp/standalone.ts` is a long-running local process. Do not try to host it on Vercel. Point `OPENCAL_URL` at the deployment. The `demo` bearer works only when `DEMO_MODE=true`.

The app does not write the database, tokens, or uploads to the local disk. Serverless instances have no persistent disk. That is why SQLite is not the Vercel database.

## Local Postgres and Docker

`docker compose up` starts Postgres 16 and the app. The compose password `opencal` is a local default, not a Vercel credential. Apply the schema with `npm run db:migrate:deploy` before using the app. The container does not migrate on startup.

## Secrets in git

The public history is one commit, `872b1002b44659d6c24f42e616c072c7f5c471bb`. It contains no `.env` file, no SQLite database, no private key, and no OAuth client secret. The only `DATABASE_URL` in that commit is the SQLite path `file:/data/opencal.db` in the old Dockerfile. Do not commit the real Supabase URLs.
