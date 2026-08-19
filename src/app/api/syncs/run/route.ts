import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAllSyncsForUser, runSyncConfig } from "@/lib/sync/engine";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.id) {
    const sync = await prisma.syncConfig.findFirst({
      where: { id: body.id, userId: session.user.id },
    });
    if (!sync) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const result = await runSyncConfig(sync.id);
    return NextResponse.json({ result });
  }

  const results = await runAllSyncsForUser(session.user.id);
  return NextResponse.json({ results });
}
