import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFreshTokens, getProvider } from "@/lib/providers";
import { getSlotsForLink } from "@/lib/scheduling/availability";
import { parseJson } from "@/lib/utils";
import { addMinutes, startOfDay } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { hostUserId: session.user.id },
    include: {
      schedulingLink: { select: { title: true, slug: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ bookings });
}

type LinkWithTarget = {
  id: string;
  title: string;
  locationType: string;
  locationValue: string | null;
  targetCalendar: {
    id: string;
    externalId: string;
    account: {
      id: string;
      provider: string;
      accessToken: string | null;
      refreshToken: string | null;
      expiresAt: number | null;
      appPassword: string | null;
      caldavUrl: string | null;
      email: string | null;
      providerAccountId: string;
    };
  } | null;
};

/** Write a confirmed booking into the link's target calendar. */
async function createBookingEvent(
  link: LinkWithTarget,
  booking: {
    guestName: string;
    guestEmail: string;
    guestNotes?: string | null;
    answersJson?: string;
    startAt: Date;
    endAt: Date;
  }
): Promise<string | null> {
  const cal = link.targetCalendar;
  if (!cal) return null;

  const title = `${link.title} with ${booking.guestName}`;
  const answers = parseJson<Record<string, string>>(booking.answersJson ?? "{}", {});
  const description = [
    booking.guestNotes,
    Object.keys(answers).length ? `Answers: ${JSON.stringify(answers)}` : null,
    `Booked via OpenCal · ${booking.guestEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const provider = getProvider(cal.account.provider);
    const remote = await provider.createEvent(
      await getFreshTokens(cal.account),
      cal.externalId,
      {
        externalId: `booking-${Date.now()}`,
        title,
        description,
        startAt: booking.startAt,
        endAt: booking.endAt,
        conferenceUrl: link.locationType === "custom" ? link.locationValue : null,
        showAs: "busy",
      }
    );
    const event = await prisma.event.create({
      data: {
        calendarId: cal.id,
        externalId: remote.externalId,
        title,
        description,
        startAt: booking.startAt,
        endAt: booking.endAt,
        conferenceUrl: remote.conferenceUrl,
        showAs: "busy",
        sourceEventKey: `${cal.account.provider}:${cal.externalId}:${remote.externalId}`,
      },
    });
    return event.id;
  } catch (err) {
    console.error("Failed to write booking to calendar", err);
    const event = await prisma.event.create({
      data: {
        calendarId: cal.id,
        externalId: `local-booking-${Date.now()}`,
        title,
        description,
        startAt: booking.startAt,
        endAt: booking.endAt,
        showAs: "busy",
      },
    });
    return event.id;
  }
}

/** Public booking creation */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    username,
    slug,
    guestName,
    guestEmail,
    guestNotes,
    startAt,
    duration,
    answers,
    additionalGuests,
    timezone,
  } = body;

  if (!username || !slug || !guestName || !guestEmail || !startAt || !duration) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  const link = await prisma.schedulingLink.findFirst({
    where: { userId: user.id, slug, enabled: true },
    include: { targetCalendar: { include: { account: true } } },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const durations = parseJson<number[]>(link.durations, [30]);
  if (!durations.includes(Number(duration))) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  const end = addMinutes(start, Number(duration));

  // Verify slot still available — anchor the window on the requested day so
  // bookings further out than the default window verify correctly.
  const { slots } = await getSlotsForLink(
    link.id,
    Number(duration),
    startOfDay(start)
  );
  const ok = slots.some(
    (s) => Math.abs(s.start.getTime() - start.getTime()) < 60_000
  );
  if (!ok) {
    return NextResponse.json(
      { error: "That time is no longer available" },
      { status: 409 }
    );
  }

  // Best-effort double-booking guard for concurrent requests
  const clash = await prisma.booking.findFirst({
    where: {
      hostUserId: user.id,
      status: { in: ["pending", "confirmed"] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
  });
  if (clash) {
    return NextResponse.json(
      { error: "That time is no longer available" },
      { status: 409 }
    );
  }

  const status = link.requireApproval ? "pending" : "confirmed";

  let eventId: string | null = null;
  if (status === "confirmed") {
    eventId = await createBookingEvent(link, {
      guestName,
      guestEmail,
      guestNotes,
      answersJson: JSON.stringify(answers ?? {}),
      startAt: start,
      endAt: end,
    });
  }

  const booking = await prisma.booking.create({
    data: {
      schedulingLinkId: link.id,
      hostUserId: user.id,
      guestName,
      guestEmail,
      guestNotes: guestNotes ?? null,
      answersJson: JSON.stringify(answers ?? {}),
      additionalGuests: JSON.stringify(additionalGuests ?? []),
      startAt: start,
      endAt: end,
      timezone: timezone || user.timezone,
      duration: Number(duration),
      status,
      eventId,
    },
  });

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      cancelToken: booking.cancelToken,
      confirmationMsg: link.confirmationMsg,
      redirectUrl: link.redirectUrl,
    },
  });
}

const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "declined"];

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!BOOKING_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const booking = await prisma.booking.findFirst({
    where: { id: body.id, hostUserId: session.user.id },
    include: {
      schedulingLink: {
        include: { targetCalendar: { include: { account: true } } },
      },
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let eventId = booking.eventId;

  // Approving a pending booking writes it to the target calendar
  if (body.status === "confirmed" && booking.status === "pending" && !eventId) {
    eventId = await createBookingEvent(booking.schedulingLink, booking);
  }

  // Cancelling/declining removes the linked calendar event
  if (
    (body.status === "cancelled" || body.status === "declined") &&
    booking.eventId
  ) {
    const event = await prisma.event.findUnique({
      where: { id: booking.eventId },
      include: { calendar: { include: { account: true } } },
    });
    if (event) {
      if (event.externalId) {
        try {
          const provider = getProvider(event.calendar.account.provider);
          await provider.deleteEvent(
            await getFreshTokens(event.calendar.account),
            event.calendar.externalId,
            event.externalId
          );
        } catch (err) {
          console.error("Failed to delete booking event remotely", err);
        }
      }
      await prisma.event.delete({ where: { id: event.id } });
    }
    eventId = null;
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: body.status, eventId },
  });
  return NextResponse.json({ booking: updated });
}
