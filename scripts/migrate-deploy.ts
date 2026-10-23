/**
 * Apply pending Postgres migrations with the direct/session URL.
 * Not part of the Vercel build. Run it yourself against Supabase:
 *   npm run db:migrate:deploy
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { assertDirectDatabaseUrl } from "../src/lib/database-url";

function main() {
  const direct = assertDirectDatabaseUrl();
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DIRECT_URL: direct },
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main();
