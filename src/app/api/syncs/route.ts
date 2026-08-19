import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteSyncClones, runSyncConfig } from "@/lib/sync/engine";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const syncs = await prisma.syncConfig.findMany({
    where: { userId: session.user.id },
    include: {
      calendars: {
        include: {
          calendar: {
            select: { id: true, name: true, color: true, account: { select: { provider: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ syncs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    direction = "one_way",
    sourceCalendarIds = [],
    targetCalendarIds = [],
    peerCalendarIds = [],
    privacy = {},
  } = body;

  if (direction !== "one_way" && direction !== "multi_way") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  // All referenced calendars must belong to the requesting user
  const allIds: string[] = [
    ...new Set<string>([
      ...sourceCalendarIds,
      ...targetCalendarIds,
      ...peerCalendarIds,
    ]),
  ];
  if (allIds.length) {
    const ownedCount = await prisma.calendar.count({
      where: { id: { in: allIds }, userId: session.user.id },
    });
    if (ownedCount !== allIds.length) {
      return NextResponse.json(
        { error: "One or more calendars not found" },
        { status: 404 }
      );
    }
  }

  const sync = await prisma.syncConfig.create({
    data: {
      userId: session.user.id,
      name: name || "New sync",
      direction,
      includeTitle: privacy.includeTitle ?? false,
      customTitle: privacy.customTitle ?? "Busy",
      titleSuffix: privacy.titleSuffix ?? null,
      includeDescription: privacy.includeDescription ?? false,
      includeLocation: privacy.includeLocation ?? false,
      includeAttendees: privacy.includeAttendees ?? false,
      includeConference: privacy.includeConference ?? false,
      markPrivate: privacy.markPrivate ?? true,
      disableReminders: privacy.disableReminders ?? true,
      syncFreeEvents: privacy.syncFreeEvents ?? false,
      cloneColor: privacy.cloneColor ?? "#9E9E9E",
      excludeColors: JSON.stringify(privacy.excludeColors ?? []),
      includeRsvps: JSON.stringify(
        privacy.includeRsvps ?? ["accepted", "tentative", "needsAction"]
      ),
    },
  });

  const memberships: { syncConfigId: string; calendarId: string; role: string }[] =
    [];

  if (direction === "multi_way") {
    for (const id of peerCalendarIds) {
      memberships.push({ syncConfigId: sync.id, calendarId: id, role: "peer" });
    }
  } else {
    for (const id of sourceCalendarIds) {
      memberships.push({ syncConfigId: sync.id, calendarId: id, role: "source" });
    }
    for (const id of targetCalendarIds) {
      memberships.push({ syncConfigId: sync.id, calendarId: id, role: "target" });
    }
  }

  if (memberships.length) {
    await prisma.syncConfigCalendar.createMany({ data: memberships });
  }

  // Run initial sync
  const result = await runSyncConfig(sync.id);

  const full = await prisma.syncConfig.findUnique({
    where: { id: sync.id },
    include: {
      calendars: { include: { calendar: true } },
    },
  });

  return NextResponse.json({ sync: full, result });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const existing = await prisma.syncConfig.findFirst({
    where: { id: body.id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sync = await prisma.syncConfig.update({
    where: { id: body.id },
    data: {
      name: body.name ?? undefined,
      enabled: body.enabled ?? undefined,
      includeTitle: body.includeTitle ?? undefined,
      customTitle: body.customTitle ?? undefined,
      titleSuffix: body.titleSuffix ?? undefined,
      includeDescription: body.includeDescription ?? undefined,
      includeLocation: body.includeLocation ?? undefined,
      includeAttendees: body.includeAttendees ?? undefined,
      includeConference: body.includeConference ?? undefined,
      markPrivate: body.markPrivate ?? undefined,
      disableReminders: body.disableReminders ?? undefined,
      syncFreeEvents: body.syncFreeEvents ?? undefined,
      cloneColor: body.cloneColor ?? undefined,
    },
  });

  return NextResponse.json({ sync });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const deleteClones = searchParams.get("deleteClones") !== "false";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.syncConfig.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (deleteClones) {
    await deleteSyncClones(id);
  }
  await prisma.syncConfigCalendar.deleteMany({ where: { syncConfigId: id } });
  await prisma.syncConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
