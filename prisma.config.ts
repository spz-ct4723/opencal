import "dotenv/config";
import { defineConfig } from "prisma/config";
import { directDatabaseUrlForCli } from "./src/lib/database-url";

// Prisma 7.8 reads a single datasource URL from this file (there is no
// directUrl field). That URL is the migration connection: DIRECT_URL, or
// POSTGRES_URL_NON_POOLING when DIRECT_URL is unset.
// The app runtime does not use this URL. src/lib/db.ts uses DATABASE_URL
// (fallback POSTGRES_PRISMA_URL) through PrismaPg.
// `prisma generate` loads this file and does not open a connection.
// The Vercel build does not run migrate.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directDatabaseUrlForCli(),
  },
});
