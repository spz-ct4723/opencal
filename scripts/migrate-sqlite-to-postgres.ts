/**
 * Copy every OpenCal row from the Mac mini SQLite file into Postgres.
 *
 * Does not run unless you pass --apply. Default is a dry run.
 * Not part of the Vercel build. Uses the direct URL (port 5432), never the
 * transaction pooler.
 *
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts --sqlite /path/to/opencal.db --dry-run
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts --sqlite /path/to/opencal.db --apply
 *
 * Re-running --apply upserts on primary key, so IDs, timestamps, and
 * relations stay stable. Row values are compared after the write.
 */
import "dotenv/config";
import { Client } from "pg";
import { DatabaseSync } from "node:sqlite";
import {
  assertDirectDatabaseUrl,
  connectionStringForPg,
} from "../src/lib/database-url";

type ColType = "text" | "bool" | "int" | "datetime";

type Column = {
  name: string;
  type: ColType;
  nullable: boolean;
};

type Table = {
  name: string;
  columns: Column[];
};

const text = (name: string, nullable = false): Column => ({
  name,
  type: "text",
  nullable,
});
const bool = (name: string): Column => ({
  name,
  type: "bool",
  nullable: false,
});
const int = (name: string, nullable = false): Column => ({
  name,
  type: "int",
  nullable,
});
const datetime = (name: string, nullable = false): Column => ({
  name,
  type: "datetime",
  nullable,
});

// Insert order respects foreign keys. cloneSourceId is not a foreign key.
const TABLES: Table[] = [
  {
    name: "User",
    columns: [
      text("id"),
      text("email"),
      text("name", true),
      text("passwordHash", true),
      text("username"),
      text("image", true),
      text("timezone"),
      text("brandColor"),
      text("brandCover", true),
      text("bio", true),
      text("socialLinks"),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "Session",
    columns: [
      text("id"),
      text("sessionToken"),
      text("userId"),
      datetime("expires"),
    ],
  },
  {
    name: "Account",
    columns: [
      text("id"),
      text("userId"),
      text("provider"),
      text("providerAccountId"),
      text("email", true),
      text("displayName", true),
      text("accessToken", true),
      text("refreshToken", true),
      int("expiresAt", true),
      text("appPassword", true),
      text("caldavUrl", true),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "Team",
    columns: [
      text("id"),
      text("name"),
      text("ownerId"),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "TeamMember",
    columns: [
      text("id"),
      text("teamId"),
      text("userId"),
      text("role"),
      datetime("createdAt"),
    ],
  },
  {
    name: "Calendar",
    columns: [
      text("id"),
      text("userId"),
      text("accountId"),
      text("externalId"),
      text("name"),
      text("color"),
      bool("isPrimary"),
      bool("isReadOnly"),
      bool("enabled"),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "SyncConfig",
    columns: [
      text("id"),
      text("userId"),
      text("name"),
      text("direction"),
      bool("enabled"),
      bool("includeTitle"),
      text("customTitle", true),
      text("titleSuffix", true),
      bool("includeDescription"),
      bool("includeLocation"),
      bool("includeAttendees"),
      bool("includeConference"),
      bool("markPrivate"),
      bool("disableReminders"),
      bool("syncFreeEvents"),
      text("cloneColor", true),
      text("excludeColors"),
      text("includeRsvps"),
      datetime("lastSyncedAt", true),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "SyncConfigCalendar",
    columns: [text("id"), text("syncConfigId"), text("calendarId"), text("role")],
  },
  {
    name: "SchedulingLink",
    columns: [
      text("id"),
      text("userId"),
      text("slug"),
      text("title"),
      text("description", true),
      text("durations"),
      text("locationType"),
      text("locationValue", true),
      text("availabilityJson"),
      text("dateOverridesJson"),
      int("bufferBefore"),
      int("bufferAfter"),
      int("minNoticeMinutes"),
      int("maxDaysAhead"),
      int("maxBookingsPerDay", true),
      bool("requireApproval"),
      bool("allowGuests"),
      text("questionsJson"),
      text("brandColor", true),
      text("coverImage", true),
      text("language"),
      text("confirmationMsg", true),
      text("redirectUrl", true),
      text("conflictCalendarIds"),
      text("targetCalendarId", true),
      text("hostUserIds"),
      bool("enabled"),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "Event",
    columns: [
      text("id"),
      text("calendarId"),
      text("externalId", true),
      text("title"),
      text("description", true),
      text("location", true),
      text("conferenceUrl", true),
      datetime("startAt"),
      datetime("endAt"),
      bool("allDay"),
      text("timezone", true),
      text("status"),
      text("visibility"),
      text("showAs"),
      text("color", true),
      text("rsvp", true),
      text("attendeesJson"),
      text("recurrenceRule", true),
      bool("isClone"),
      text("cloneSourceId", true),
      text("syncConfigId", true),
      text("sourceEventKey", true),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "Booking",
    columns: [
      text("id"),
      text("schedulingLinkId"),
      text("hostUserId"),
      text("guestName"),
      text("guestEmail"),
      text("guestNotes", true),
      text("answersJson"),
      text("additionalGuests"),
      datetime("startAt"),
      datetime("endAt"),
      text("timezone"),
      int("duration"),
      text("status"),
      text("eventId", true),
      text("cancelToken"),
      text("rescheduleToken"),
      datetime("createdAt"),
      datetime("updatedAt"),
    ],
  },
  {
    name: "ShareLink",
    columns: [
      text("id"),
      text("userId"),
      text("token"),
      text("name"),
      text("calendarIds"),
      bool("showDetails"),
      bool("enabled"),
      datetime("createdAt"),
    ],
  },
];

class RowError extends Error {
  constructor(table: string, id: string, column: string, message: string) {
    super(`${table}.${column} id=${id}: ${message}`);
    this.name = "RowError";
  }
}

function isNull(value: unknown): boolean {
  return value === null || value === undefined;
}

function toBoolean(value: unknown, nullable: boolean): boolean | null {
  if (isNull(value)) {
    if (nullable) return null;
    throw new Error("unexpected null");
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value !== BigInt(0);
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (value === "1" || lower === "true") return true;
    if (value === "0" || lower === "false") return false;
  }
  throw new Error(`cannot convert ${typeof value} to boolean`);
}

function toInt(value: unknown, nullable: boolean): number | null {
  if (isNull(value)) {
    if (nullable) return null;
    throw new Error("unexpected null");
  }
  const n =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "string"
        ? Number(value)
        : value;
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new Error(`cannot convert ${typeof value} to integer`);
  }
  return n;
}

function toDate(value: unknown, nullable: boolean): Date | null {
  if (isNull(value)) {
    if (nullable) return null;
    throw new Error("unexpected null");
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("invalid date");
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) throw new Error("invalid date");
    return date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(withT) ? withT : `${withT}Z`;
    const date = new Date(withZone);
    if (Number.isNaN(date.getTime())) throw new Error("invalid date");
    return date;
  }
  throw new Error(`cannot convert ${typeof value} to datetime`);
}

function toText(value: unknown, nullable: boolean): string | null {
  if (isNull(value)) {
    if (nullable) return null;
    throw new Error("unexpected null");
  }
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  throw new Error(`cannot convert ${typeof value} to text`);
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/(\.\d{3})\d*Z$/, "$1Z");
}

function timestampParam(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

function normalized(column: Column, value: unknown): string | null {
  if (column.type === "datetime") {
    const date = toDate(value, column.nullable);
    return date ? formatUtc(date) : null;
  }
  if (column.type === "bool") {
    const flag = toBoolean(value, column.nullable);
    if (flag === null) return null;
    return flag ? "true" : "false";
  }
  if (column.type === "int") {
    const n = toInt(value, column.nullable);
    return n === null ? null : String(n);
  }
  return toText(value, column.nullable);
}

function sqlLiteral(column: Column, value: unknown): unknown {
  if (column.type === "datetime") {
    const date = toDate(value, column.nullable);
    return date ? timestampParam(date) : null;
  }
  if (column.type === "bool") return toBoolean(value, column.nullable);
  if (column.type === "int") return toInt(value, column.nullable);
  return toText(value, column.nullable);
}

function placeholder(column: Column, index: number): string {
  if (column.type === "datetime") return `$${index}::timestamp(3)`;
  return `$${index}`;
}

function quote(name: string): string {
  return `"${name}"`;
}

function readSqlite(path: string): Map<string, Record<string, unknown>[]> {
  const db = new DatabaseSync(path);
  try {
    const out = new Map<string, Record<string, unknown>[]>();
    for (const table of TABLES) {
      const cols = table.columns.map((c) => quote(c.name)).join(", ");
      const rows = db
        .prepare(`SELECT ${cols} FROM ${quote(table.name)}`)
        .all() as Record<string, unknown>[];
      out.set(table.name, rows);
    }
    return out;
  } finally {
    db.close();
  }
}

function selectNormalized(table: Table): string {
  const parts = table.columns.map((column) => {
    const q = quote(column.name);
    if (column.type === "datetime") {
      return `CASE WHEN ${q} IS NULL THEN NULL ELSE to_char(${q}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS ${q}`;
    }
    if (column.type === "bool") {
      return `CASE WHEN ${q} IS NULL THEN NULL WHEN ${q} THEN 'true' ELSE 'false' END AS ${q}`;
    }
    return `${q}::text AS ${q}`;
  });
  return `SELECT ${parts.join(", ")} FROM ${quote(table.name)}`;
}

function upsertSql(table: Table): string {
  const cols = table.columns.map((c) => quote(c.name)).join(", ");
  const values = table.columns
    .map((column, i) => placeholder(column, i + 1))
    .join(", ");
  const updates = table.columns
    .filter((c) => c.name !== "id")
    .map((c) => `${quote(c.name)} = EXCLUDED.${quote(c.name)}`)
    .join(", ");
  return `INSERT INTO ${quote(table.name)} (${cols}) VALUES (${values}) ON CONFLICT (${quote("id")}) DO UPDATE SET ${updates}`;
}

type Args = { sqlitePath: string; apply: boolean };

function parseArgs(argv: string[]): Args {
  let sqlitePath: string | undefined;
  let apply = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--sqlite") sqlitePath = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: tsx scripts/migrate-sqlite-to-postgres.ts --sqlite <file.db> [--dry-run | --apply]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!sqlitePath) throw new Error("--sqlite <file> is required");
  if (apply && dryRun) throw new Error("Pass only one of --apply or --dry-run");
  return { sqlitePath, apply };
}

async function destinationCounts(
  client: Client
): Promise<Map<string, number> | null> {
  const counts = new Map<string, number>();
  for (const table of TABLES) {
    try {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM ${quote(table.name)}`
      );
      counts.set(table.name, result.rows[0].count as number);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "42P01") return null;
      throw error;
    }
  }
  return counts;
}

async function verify(
  client: Client,
  source: Map<string, Record<string, unknown>[]>
): Promise<string[]> {
  const mismatches: string[] = [];
  for (const table of TABLES) {
    const sourceRows = source.get(table.name) ?? [];
    const result = await client.query(selectNormalized(table));
    const destRows = result.rows as Record<string, string | null>[];
    if (destRows.length !== sourceRows.length) {
      mismatches.push(
        `${table.name}: destination has ${destRows.length} rows, source has ${sourceRows.length}`
      );
    }
    const byId = new Map(destRows.map((row) => [row.id, row]));
    for (const sourceRow of sourceRows) {
      const id = String(sourceRow.id);
      const dest = byId.get(id);
      if (!dest) {
        mismatches.push(`${table.name}: missing id ${id}`);
        continue;
      }
      for (const column of table.columns) {
        let expected: string | null;
        try {
          expected = normalized(column, sourceRow[column.name]);
        } catch (error) {
          throw new RowError(
            table.name,
            id,
            column.name,
            error instanceof Error ? error.message : "convert failed"
          );
        }
        const actual = dest[column.name];
        if (actual !== expected) {
          mismatches.push(
            `${table.name}.${column.name} id=${id}: destination does not match source`
          );
        }
      }
    }
  }
  return mismatches;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = readSqlite(args.sqlitePath);
  console.log(args.apply ? "Apply mode" : "Dry run (no writes)");
  console.log(`SQLite: ${args.sqlitePath}`);
  for (const table of TABLES) {
    console.log(`  source ${table.name}: ${(source.get(table.name) ?? []).length}`);
  }

  const direct = assertDirectDatabaseUrl();
  const client = new Client({
    connectionString: connectionStringForPg(direct),
  });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET TIME ZONE 'UTC'");
    const before = await destinationCounts(client);
    await client.query("ROLLBACK");
    if (!before) {
      console.log(
        "Destination tables are missing. Apply prisma/migrations/20261023120000_baseline first."
      );
      process.exit(args.apply ? 1 : 0);
    }
    for (const table of TABLES) {
      console.log(`  destination ${table.name}: ${before.get(table.name) ?? 0}`);
    }
    if (!args.apply) {
      console.log("Dry run finished. No rows were written.");
      return;
    }

    await client.query("BEGIN");
    await client.query("SET TIME ZONE 'UTC'");
    for (const table of TABLES) {
      const sql = upsertSql(table);
      for (const row of source.get(table.name) ?? []) {
        const id = String(row.id ?? "");
        const values = table.columns.map((column) => {
          try {
            return sqlLiteral(column, row[column.name]);
          } catch (error) {
            throw new RowError(
              table.name,
              id,
              column.name,
              error instanceof Error ? error.message : "convert failed"
            );
          }
        });
        await client.query(sql, values);
      }
    }
    const mismatches = await verify(client, source);
    if (mismatches.length > 0) {
      await client.query("ROLLBACK");
      console.error("Verification failed. Transaction rolled back.");
      for (const line of mismatches) console.error(`  ${line}`);
      process.exit(2);
    }
    await client.query("COMMIT");
    console.log("Apply finished. Source and destination rows match.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no open transaction
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
