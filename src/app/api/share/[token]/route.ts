import { NextRequest, NextResponse } from "next/server";
import ical, { ICalCalendarMethod } from "ical-generator";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { addDays, subDays } from "date-fns";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const share = await prisma.shareLink.findUnique({ where: { token } });
  if (!share || !share.enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const calendarIds = parseJson<string[]>(share.calendarIds, []);
  const events = await prisma.event.findMany({
    where: {
      calendarId: { in: calendarIds },
      // Defense in depth: never expose calendars the link owner doesn't own
      calendar: { userId: share.userId },
      startAt: { lte: addDays(new Date(), 90) },
      endAt: { gte: subDays(new Date(), 7) },
      status: { not: "cancelled" },
      // A busy-only feed shouldn't mark "free" events as Busy
      ...(share.showDetails ? {} : { showAs: { not: "free" } }),
    },
    orderBy: { startAt: "asc" },
  });

  const cal = ical({
    name: share.name || "OpenCal Shared",
    method: ICalCalendarMethod.PUBLISH,
  });

  for (const e of events) {
    cal.createEvent({
      start: e.startAt,
      end: e.endAt,
      allDay: e.allDay,
      summary: share.showDetails ? e.title : "Busy",
      description: share.showDetails ? e.description || undefined : undefined,
      location: share.showDetails ? e.location || undefined : undefined,
      url: share.showDetails ? e.conferenceUrl || undefined : undefined,
    });
  }

  return new NextResponse(cal.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="opencal-${token}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
