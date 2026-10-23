import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  connectionStringForPg,
  poolMax,
  pooledDatabaseUrl,
} from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient() {
  const url = pooledDatabaseUrl();
  // Named prepared statements are not cached: PrismaPg only names them when
  // statementNameGenerator is set. Supavisor transaction mode (port 6543)
  // cannot keep named statements across clients. Pool max is 1 on Vercel.
  const pool = new Pool({
    connectionString: connectionStringForPg(url),
    max: poolMax(url),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
