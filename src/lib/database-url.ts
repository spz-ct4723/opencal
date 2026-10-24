/**
 * Supabase connection strings.
 *
 * Runtime (PrismaPg): DATABASE_URL, else POSTGRES_PRISMA_URL.
 *   Transaction pooler, port 6543, usually with pgbouncer=true,
 *   connection_limit=1, and sslmode=require.
 *
 * Prisma CLI / migrate: DIRECT_URL, else POSTGRES_URL_NON_POOLING.
 *   Session pooler or direct host, port 5432. Prisma 7.8 has no
 *   datasource.directUrl; prisma.config.ts sets datasource.url to this.
 *
 * The POSTGRES_* fallbacks are used only when the primary name is unset.
 * Migrations never fall back to the pooled URL.
 */

const PRISMA_ONLY_PARAMS = [
  "pgbouncer",
  "connection_limit",
  "pool_timeout",
  "statement_cache_size",
] as const;

export class DatabaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUrlError";
  }
}

function firstEnv(
  names: readonly string[]
): { name: string; value: string } | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { name, value };
  }
  return undefined;
}

export function queryParams(connectionString: string): URLSearchParams {
  const q = connectionString.indexOf("?");
  if (q === -1) return new URLSearchParams();
  return new URLSearchParams(connectionString.slice(q + 1));
}

/** Port from the authority section. Does not parse the password. */
export function connectionPort(connectionString: string): string | null {
  const withoutQuery = connectionString.split("?")[0] ?? connectionString;
  const at = withoutQuery.lastIndexOf("@");
  const host = at >= 0 ? withoutQuery.slice(at + 1) : withoutQuery;
  const match = host.match(/:(\d+)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function isTransactionPooler(connectionString: string): boolean {
  if (queryParams(connectionString).get("pgbouncer") === "true") return true;
  return connectionPort(connectionString) === "6543";
}

/**
 * Ensure Supavisor transaction-mode URLs carry the Prisma pooler flags.
 * node-postgres ignores these flags; Pool `max` enforces the limit.
 */
export function withPoolerParams(connectionString: string): string {
  if (!isTransactionPooler(connectionString)) return connectionString;
  const q = connectionString.indexOf("?");
  const base = q === -1 ? connectionString : connectionString.slice(0, q);
  const params = queryParams(connectionString);
  if (!params.has("pgbouncer")) params.set("pgbouncer", "true");
  if (!params.has("connection_limit")) params.set("connection_limit", "1");
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Drop Prisma-only params before handing a string to node-postgres. sslmode stays. */
export function connectionStringForPg(connectionString: string): string {
  const q = connectionString.indexOf("?");
  const base = q === -1 ? connectionString : connectionString.slice(0, q);
  const params = queryParams(connectionString);
  for (const key of PRISMA_ONLY_PARAMS) params.delete(key);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function pooledDatabaseUrl(): string {
  const found = firstEnv(["DATABASE_URL", "POSTGRES_PRISMA_URL"]);
  if (!found) {
    throw new DatabaseUrlError(
      "Missing pooled Postgres URL. Set DATABASE_URL, or POSTGRES_PRISMA_URL if you use the Vercel Marketplace Supabase integration without DATABASE_URL."
    );
  }
  return withPoolerParams(found.value);
}

export function directDatabaseUrl(): string | undefined {
  return firstEnv(["DIRECT_URL", "POSTGRES_URL_NON_POOLING"])?.value;
}

export function assertDirectDatabaseUrl(): string {
  const found = firstEnv(["DIRECT_URL", "POSTGRES_URL_NON_POOLING"]);
  if (!found) {
    throw new DatabaseUrlError(
      "Missing direct Postgres URL. Set DIRECT_URL, or POSTGRES_URL_NON_POOLING when using the Marketplace integration. Migrations must use port 5432."
    );
  }
  if (isTransactionPooler(found.value)) {
    throw new DatabaseUrlError(
      `${found.name} is the transaction pooler (port 6543 or pgbouncer=true). Point it at the session pooler or direct host on port 5432.`
    );
  }
  return found.value;
}

/**
 * URL stored for the Prisma CLI. Generate does not connect.
 * When no direct URL is configured, this is a placeholder so `prisma generate`
 * still loads. migrate-deploy refuses that placeholder.
 */
export function directDatabaseUrlForCli(): string {
  const direct = directDatabaseUrl();
  if (!direct) return "postgresql://127.0.0.1:5432/opencal";
  if (isTransactionPooler(direct)) {
    throw new DatabaseUrlError(
      "DIRECT_URL / POSTGRES_URL_NON_POOLING must not be the transaction pooler."
    );
  }
  return direct;
}

export function poolMax(connectionString: string): number {
  if (process.env.VERCEL === "1" || isTransactionPooler(connectionString)) {
    return 1;
  }
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return 10;
}
