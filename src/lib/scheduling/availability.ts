import {
  addDays,
  addMinutes,
  format,
  isBefore,
  isAfter,
  setHours,
  setMinutes,
  startOfDay,
  getDay,
} from "date-fns";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import type { DayKey, TimeSlot, WeeklyAvailability } from "@/lib/types";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type Slot = { start: Date; end: Date };

function parseHm(base: Date, hm: string): Date {
  const [h, m] = hm.split(":").map(Number);
  return setMinutes(setHours(startOfDay(base), h), m);
}

export function getBusyIntervals(
  events: { startAt: Date; endAt: Date; showAs: string; status: string }[],
  bufferBefore: number,
  bufferAfter: number
): Slot[] {
  return events
    .filter((e) => e.status !== "cancelled" && e.showAs !== "free")
    .map((e) => ({
      start: addMinutes(e.startAt, -bufferBefore),
      end: addMinutes(e.endAt, bufferAfter),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function overlaps(a: Slot, b: Slot) {
  return a.start < b.end && b.start < a.end;
}

export function computeAvailableSlots(params: {
  from: Date;
  days: number;
  durationMinutes: number;
  availability: WeeklyAvailability;
  busy: Slot[];
  minNoticeMinutes: number;
  maxDaysAhead: number;
  dateOverrides?: { date: string; slots?: TimeSlot[]; blocked?: boolean }[];
  maxBookingsPerDay?: number | null;
  bookingsPerDay?: Record<string, number>;
}): Slot[] {
  const {
    from,
    days,
    durationMinutes,
    availability,
    busy,
    minNoticeMinutes,
    maxDaysAhead,
    dateOverrides = [],
    maxBookingsPerDay,
    bookingsPerDay = {},
  } = params;

  const now = new Date();
  const earliest = addMinutes(now, minNoticeMinutes);
  const latest = addDays(startOfDay(now), maxDaysAhead);
  const slots: Slot[] = [];
  const overrideMap = new Map(dateOverrides.map((o) => [o.date, o]));

  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(from), i);
    if (isAfter(day, latest)) break;
    const dateStr = format(day, "yyyy-MM-dd");
    const override = overrideMap.get(dateStr);

    if (maxBookingsPerDay != null && (bookingsPerDay[dateStr] ?? 0) >= maxBookingsPerDay) {
      continue;
    }

    let windows: TimeSlot[] = [];
    if (override?.blocked) {
      continue;
    } else if (override?.slots) {
      windows = override.slots;
    } else {
      const key = DAY_KEYS[getDay(day)];
      windows = availability[key] ?? [];
    }

    for (const win of windows) {
      let cursor = parseHm(day, win.start);
      const winEnd = parseHm(day, win.end);
      while (addMinutes(cursor, durationMinutes) <= winEnd) {
        const slot: Slot = {
          start: cursor,
          end: addMinutes(cursor, durationMinutes),
        };
        if (!isBefore(slot.start, earliest) && !isAfter(slot.end, latest)) {
          const conflict = busy.some((b) => overlaps(slot, b));
          if (!conflict) slots.push(slot);
        }
        cursor = addMinutes(cursor, 15); // grid step
      }
    }
  }

  return slots;
}

export async function getSlotsForLink(
  linkId: string,
  durationMinutes: number,
  fromDate?: Date
) {
  const link = await prisma.schedulingLink.findUniqueOrThrow({
    where: { id: linkId },
    include: { user: true },
  });

  const hostIds = parseJson<string[]>(link.hostUserIds, []);
  const allHostIds = [link.userId, ...hostIds.filter((id) => id !== link.userId)];

  const conflictIds = parseJson<string[]>(link.conflictCalendarIds, []);
  const calendars = await prisma.calendar.findMany({
    where: {
      userId: { in: allHostIds },
      enabled: true,
      ...(conflictIds.length ? { id: { in: conflictIds } } : {}),
    },
  });

  const from = fromDate ?? startOfDay(new Date());
  const to = addDays(from, Math.min(link.maxDaysAhead, 28));

  const events = await prisma.event.findMany({
    where: {
      calendarId: { in: calendars.map((c) => c.id) },
      startAt: { lte: to },
      endAt: { gte: from },
      status: { not: "cancelled" },
    },
  });

  // Also treat pending/confirmed bookings as busy
  const bookings = await prisma.booking.findMany({
    where: {
      hostUserId: { in: allHostIds },
      status: { in: ["pending", "confirmed"] },
      startAt: { lte: to },
      endAt: { gte: from },
    },
  });

  const busy = getBusyIntervals(
    [
      ...events.map((e) => ({
        startAt: e.startAt,
        endAt: e.endAt,
        showAs: e.showAs,
        status: e.status,
      })),
      ...bookings.map((b) => ({
        startAt: b.startAt,
        endAt: b.endAt,
        showAs: "busy",
        status: "confirmed",
      })),
    ],
    link.bufferBefore,
    link.bufferAfter
  );

  const bookingsPerDay: Record<string, number> = {};
  for (const b of bookings) {
    const k = format(b.startAt, "yyyy-MM-dd");
    bookingsPerDay[k] = (bookingsPerDay[k] ?? 0) + 1;
  }

  const availability = parseJson<WeeklyAvailability>(link.availabilityJson, {
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [{ start: "09:00", end: "17:00" }],
    wed: [{ start: "09:00", end: "17:00" }],
    thu: [{ start: "09:00", end: "17:00" }],
    fri: [{ start: "09:00", end: "17:00" }],
    sat: [],
    sun: [],
  });

  const dateOverrides = parseJson<
    { date: string; slots?: TimeSlot[]; blocked?: boolean }[]
  >(link.dateOverridesJson, []);

  const slots = computeAvailableSlots({
    from,
    days: Math.min(link.maxDaysAhead, 28),
    durationMinutes,
    availability,
    busy,
    minNoticeMinutes: link.minNoticeMinutes,
    maxDaysAhead: link.maxDaysAhead,
    dateOverrides,
    maxBookingsPerDay: link.maxBookingsPerDay,
    bookingsPerDay,
  });

  return { link, slots };
}

export function formatSlotLabel(slot: Slot) {
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    label: `${format(slot.start, "EEE MMM d")} · ${format(slot.start, "h:mm a")} – ${format(slot.end, "h:mm a")}`,
  };
}
