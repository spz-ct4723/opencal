import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFreshTokens, getProvider } from "@/lib/providers";
import { addDays, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start")
    ? new Date(searchParams.get("start")!)
    : subDays(new Date(), 7);
  const end = searchParams.get("end")
    ? new Date(searchParams.get("end")!)
    : addDays(new Date(), 35);
  const hideClones = searchParams.get("hideClones") === "true";
  const calendarIds = searchParams.get("calendars")?.split(",").filter(Boolean);

  const calendars = await prisma.calendar.findMany({
    where: {
      userId: session.user.id,
      enabled: true,
      ...(calendarIds?.length ? { id: { in: calendarIds } } : {}),
    },
  });

  const events = await prisma.event.findMany({
    where: {
      calendarId: { in: calendars.map((c) => c.id) },
      startAt: { lte: end },
      endAt: { gte: start },
      ...(hideClones ? { isClone: false } : {}),
    },
    include: {
      calendar: { select: { id: true, name: true, color: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ events, calendars });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const calendar = await prisma.calendar.findFirst({
    where: { id: body.calendarId, userId: session.user.id },
    include: { account: true },
  });
  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const input = {
    externalId: `local-${Date.now()}`,
    title: body.title || "Untitled",
    description: body.description ?? null,
    location: body.location ?? null,
    conferenceUrl: body.conferenceUrl ?? null,
    startAt: new Date(body.startAt),
    endAt: new Date(body.endAt),
    allDay: Boolean(body.allDay),
    showAs: body.showAs || "busy",
    visibility: body.visibility || "default",
  };

  try {
    const provider = getProvider(calendar.account.provider);
    const remote = await provider.createEvent(
      await getFreshTokens(calendar.account),
      calendar.externalId,
      input
    );
    input.externalId = remote.externalId;
  } catch (err) {
    console.error("Provider create failed, storing locally", err);
  }

  const event = await prisma.event.create({
    data: {
      calendarId: calendar.id,
      externalId: input.externalId,
      title: input.title,
      description: input.description,
      location: input.location,
      conferenceUrl: input.conferenceUrl,
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: input.allDay,
      showAs: input.showAs,
      visibility: input.visibility,
      sourceEventKey: `${calendar.account.provider}:${calendar.externalId}:${input.externalId}`,
    },
  });

  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const event = await prisma.event.findFirst({
    where: { id: body.id, calendar: { userId: session.user.id } },
    include: { calendar: { include: { account: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = {
    title: body.title ?? event.title,
    description: body.description !== undefined ? body.description : event.description,
    location: body.location !== undefined ? body.location : event.location,
    startAt: body.startAt ? new Date(body.startAt) : event.startAt,
    endAt: body.endAt ? new Date(body.endAt) : event.endAt,
    allDay: body.allDay !== undefined ? Boolean(body.allDay) : event.allDay,
    conferenceUrl:
      body.conferenceUrl !== undefined ? body.conferenceUrl : event.conferenceUrl,
  };

  if (event.externalId) {
    try {
      const provider = getProvider(event.calendar.account.provider);
      await provider.updateEvent(
        await getFreshTokens(event.calendar.account),
        event.calendar.externalId,
        event.externalId,
        data
      );
    } catch (err) {
      console.error("Provider update failed", err);
    }
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data,
  });
  return NextResponse.json({ event: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const event = await prisma.event.findFirst({
    where: { id, calendar: { userId: session.user.id } },
    include: { calendar: { include: { account: true } } },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (event.externalId) {
    try {
      const provider = getProvider(event.calendar.account.provider);
      await provider.deleteEvent(
        await getFreshTokens(event.calendar.account),
        event.calendar.externalId,
        event.externalId
      );
    } catch (err) {
      console.error("Provider delete failed", err);
    }
  }

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
