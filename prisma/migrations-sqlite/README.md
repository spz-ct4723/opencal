# SQLite migrations (archived)

These files are the schema history for the Mac mini SQLite database that tracks `main`.

Prisma on this branch migrates Postgres only, from `prisma/migrations`. Do not move this directory back there: `prisma migrate deploy` would try to run SQLite SQL against Supabase.

The data copy from the mini's SQLite file is `scripts/migrate-sqlite-to-postgres.ts`. It does not use these migration files.
