import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSyncConfig } from "@/lib/sync/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby's function ceiling. A large sync can still be killed; see docs/VERCEL.md.
export const maxDuration = 60;

/**
 * Background sync. Vercel Cron calls GET and sends
 * `Authorization: Bearer $CRON_SECRET` when that env var is set.
 * An external scheduler (the Mac mini) can POST the same header as often
 * as the plan's function duration allows. Hobby Cron itself is once a day.
 */
async function handle(req: NextRequest) {
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

export function GET(req: NextRequest) {
  return handle(req);
}

export function POST(req: NextRequest) {
  return handle(req);
}
