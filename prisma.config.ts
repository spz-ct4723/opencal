import "dotenv/config";
import fs from "fs";
import path from "path";
import { defineConfig } from "prisma/config";

// OpenCal supports SQLite (default, great for local dev and single-server
// self-hosting) and PostgreSQL (recommended for serverless hosts like Vercel).
// Prisma pins the datasource provider in the schema file, so when
// DATABASE_URL points at Postgres we generate a resolved copy of the schema
// with the provider swapped and point the CLI at it. The app picks the
// matching driver adapter at runtime in src/lib/db.ts.
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const isPostgres = url.startsWith("postgres");

let schema = "prisma/schema.prisma";
if (isPostgres) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "prisma", "schema.prisma"),
    "utf8"
  );
  const resolved = source.replace(
    /provider\s*=\s*"sqlite"/,
    'provider = "postgresql"'
  );
  schema = "prisma/schema.resolved.prisma";
  fs.writeFileSync(path.join(process.cwd(), schema), resolved);
}

export default defineConfig({
  schema,
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
