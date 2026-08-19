import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSyncConfig } from "@/lib/sync/engine";

/**
 * Background sync endpoint. Call with Authorization: Bearer $CRON_SECRET
 * e.g. every 2–5 minutes via system cron or a worker.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await prisma.syncConfig.findMany({
    where: { enabled: true },
    select: { id: true },
  });

  const results = [];
  for (const c of configs) {
    try {
      const r = await runSyncConfig(c.id);
      results.push({ id: c.id, ok: true, ...r });
    } catch (err) {
      results.push({
        id: c.id,
        ok: false,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
