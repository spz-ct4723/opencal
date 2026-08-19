import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

/** Returns the calendar id if the user owns it, otherwise null. */
async function validateTargetCalendar(userId: string, calendarId?: string | null) {
  if (!calendarId) return null;
  const cal = await prisma.calendar.findFirst({
    where: { id: calendarId, userId },
    select: { id: true },
  });
  return cal?.id ?? null;
}

async function filterOwnedCalendarIds(userId: string, ids?: unknown) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const owned = await prisma.calendar.findMany({
    where: { id: { in: ids as string[] }, userId },
    select: { id: true },
  });
  return owned.map((c) => c.id);
}

/** Co-hosts must share a team with the link owner. */
async function filterTeammateIds(userId: string, ids?: unknown) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);
  if (!teamIds.length) return [];
  const teammates = await prisma.teamMember.findMany({
    where: { teamId: { in: teamIds }, userId: { in: ids as string[] } },
    select: { userId: true },
  });
  return [...new Set(teammates.map((t) => t.userId))].filter((id) => id !== userId);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await prisma.schedulingLink.findMany({
    where: { userId: session.user.id },
    include: {
      targetCalendar: { select: { id: true, name: true, color: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const targetCalendarId = await validateTargetCalendar(
    session.user.id,
    body.targetCalendarId
  );
  if (body.targetCalendarId && !targetCalendarId) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }
  const conflictCalendarIds = await filterOwnedCalendarIds(
    session.user.id,
    body.conflictCalendarIds
  );
  const hostUserIds = await filterTeammateIds(session.user.id, body.hostUserIds);

  const baseSlug = slugify(body.slug || body.title || "meeting") || "meeting";
  let slug = baseSlug;
  let i = 1;
  while (
    await prisma.schedulingLink.findFirst({
      where: { userId: session.user.id, slug },
    })
  ) {
    slug = `${baseSlug}-${i++}`;
  }

  const link = await prisma.schedulingLink.create({
    data: {
      userId: session.user.id,
      slug,
      title: body.title || "Meeting",
      description: body.description ?? null,
      durations: JSON.stringify(body.durations ?? [30]),
      locationType: body.locationType || "google_meet",
      locationValue: body.locationValue ?? null,
      availabilityJson: body.availabilityJson
        ? JSON.stringify(body.availabilityJson)
        : undefined,
      bufferBefore: body.bufferBefore ?? 0,
      bufferAfter: body.bufferAfter ?? 0,
      minNoticeMinutes: body.minNoticeMinutes ?? 60,
      maxDaysAhead: body.maxDaysAhead ?? 60,
      maxBookingsPerDay: body.maxBookingsPerDay ?? null,
      requireApproval: body.requireApproval ?? false,
      allowGuests: body.allowGuests ?? true,
      questionsJson: JSON.stringify(body.questions ?? []),
      brandColor: body.brandColor ?? null,
      language: body.language ?? "en",
      confirmationMsg: body.confirmationMsg ?? null,
      redirectUrl: body.redirectUrl ?? null,
      targetCalendarId,
      hostUserIds: JSON.stringify(hostUserIds),
      conflictCalendarIds: JSON.stringify(conflictCalendarIds),
    },
  });

  return NextResponse.json({ link });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const existing = await prisma.schedulingLink.findFirst({
    where: { id: body.id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await prisma.schedulingLink.update({
    where: { id: body.id },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      enabled: body.enabled ?? undefined,
      durations: body.durations ? JSON.stringify(body.durations) : undefined,
      locationType: body.locationType ?? undefined,
      bufferBefore: body.bufferBefore ?? undefined,
      bufferAfter: body.bufferAfter ?? undefined,
      minNoticeMinutes: body.minNoticeMinutes ?? undefined,
      maxDaysAhead: body.maxDaysAhead ?? undefined,
      requireApproval: body.requireApproval ?? undefined,
      allowGuests: body.allowGuests ?? undefined,
      brandColor: body.brandColor ?? undefined,
      hostUserIds: body.hostUserIds
        ? JSON.stringify(await filterTeammateIds(session.user.id, body.hostUserIds))
        : undefined,
      targetCalendarId:
        body.targetCalendarId !== undefined
          ? await validateTargetCalendar(session.user.id, body.targetCalendarId)
          : undefined,
    },
  });

  return NextResponse.json({ link });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const existing = await prisma.schedulingLink.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.schedulingLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
