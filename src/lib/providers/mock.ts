import type { CalendarEventInput, ExternalCalendar } from "@/lib/types";
import type { CalendarProvider, ProviderTokens } from "./types";
import {
  addDays,
  addHours,
  addMinutes,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";

const store = new Map<string, CalendarEventInput[]>();

function key(tokens: ProviderTokens, calendarId: string) {
  return `${tokens.providerAccountId ?? "mock"}:${calendarId}`;
}

// Small stable hash so each mock calendar gets different-looking demo data
// instead of identical duplicated events across calendars.
function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seedEvents(calendarId: string): CalendarEventInput[] {
  const today = startOfDay(new Date());
  const offset = hashCode(calendarId) % 3; // 0–2 hour stagger per calendar
  const isPrimary = calendarId.endsWith("-primary");

  if (!isPrimary) {
    // Secondary calendars: a lighter, distinct set
    const secondary: CalendarEventInput[] = [
      {
        externalId: `${calendarId}-review`,
        title: "Project review",
        startAt: setMinutes(setHours(addDays(today, 1), 17 + offset % 2), 0),
        endAt: setMinutes(setHours(addDays(today, 1), 18 + offset % 2), 0),
        showAs: "busy",
        rsvp: "accepted",
        color: "#8E24AA",
      },
      {
        externalId: `${calendarId}-hack`,
        title: "Evening build session",
        startAt: setMinutes(setHours(addDays(today, 3), 19), 0),
        endAt: setMinutes(setHours(addDays(today, 3), 21), 0),
        showAs: "busy",
        rsvp: "accepted",
        color: "#8E24AA",
      },
    ];
    return secondary;
  }

  const base: CalendarEventInput[] = [
    {
      externalId: `${calendarId}-standup`,
      title: "Team Standup",
      description: "Daily sync",
      location: "Zoom",
      conferenceUrl: "https://zoom.us/j/demo",
      startAt: setMinutes(setHours(today, 9 + offset), 0),
      endAt: setMinutes(setHours(today, 9 + offset), 30),
      showAs: "busy",
      rsvp: "accepted",
      color: "#4285F4",
      attendees: [{ email: "alice@example.com", name: "Alice" }],
    },
    {
      externalId: `${calendarId}-deep-work`,
      title: "Deep Work Block",
      description: "Focus time",
      startAt: setMinutes(setHours(today, 10), 0),
      endAt: setMinutes(setHours(today, 12), 0),
      showAs: "busy",
      rsvp: "accepted",
      color: "#0B8043",
    },
    {
      externalId: `${calendarId}-lunch`,
      title: "Lunch",
      startAt: setMinutes(setHours(today, 12), 30),
      endAt: setMinutes(setHours(today, 13), 30),
      showAs: "busy",
      rsvp: "accepted",
      color: "#F4511E",
    },
    {
      externalId: `${calendarId}-1on1`,
      title: "1:1 with Manager",
      conferenceUrl: "https://meet.google.com/demo-abc",
      startAt: setMinutes(setHours(addDays(today, 1), 14 + offset), 0),
      endAt: setMinutes(setHours(addDays(today, 1), 14 + offset), 45),
      showAs: "busy",
      rsvp: "accepted",
      color: "#8E24AA",
      attendees: [{ email: "manager@example.com", name: "Manager" }],
    },
    {
      externalId: `${calendarId}-dentist`,
      title: "Dentist Appointment",
      location: "123 Main St",
      startAt: setMinutes(setHours(addDays(today, 2), 11), 0),
      endAt: setMinutes(setHours(addDays(today, 2), 12), 0),
      showAs: "busy",
      rsvp: "accepted",
      color: "#E67C73",
      visibility: "private",
    },
    {
      externalId: `${calendarId}-allday`,
      title: calendarId.includes("personal") ? "Family Visit" : "Conference Day",
      startAt: startOfDay(addDays(today, 3 + offset)),
      endAt: startOfDay(addDays(today, 4 + offset)),
      allDay: true,
      showAs: "busy",
      rsvp: "accepted",
      color: "#039BE5",
    },
    {
      externalId: `${calendarId}-free`,
      title: "Optional webinar",
      startAt: setMinutes(setHours(addDays(today, 1), 16), 0),
      endAt: setMinutes(setHours(addDays(today, 1), 17), 0),
      showAs: "free",
      rsvp: "tentative",
      color: "#F6BF26",
    },
  ];

  // Spread a few more events across the week
  for (let i = 0; i < 5; i++) {
    const day = addDays(today, i);
    base.push({
      externalId: `${calendarId}-focus-${i}`,
      title: i % 2 === 0 ? "Client call" : "Planning session",
      startAt: addHours(setMinutes(setHours(day, 15), 0), 0),
      endAt: addMinutes(setMinutes(setHours(day, 15), 0), 45),
      showAs: "busy",
      rsvp: "accepted",
      color: "#7986CB",
    });
  }

  return base;
}

export const mockProvider: CalendarProvider = {
  name: "mock",

  async listCalendars(tokens) {
    const account = tokens.providerAccountId ?? "work";
    const calendars: ExternalCalendar[] = [
      {
        externalId: `${account}-primary`,
        name: account.includes("personal") ? "Personal" : "Work",
        color: account.includes("personal") ? "#0B8043" : "#4285F4",
        isPrimary: true,
      },
      {
        externalId: `${account}-side`,
        name: account.includes("personal") ? "Family" : "Side Projects",
        color: "#8E24AA",
        isPrimary: false,
      },
    ];
    return calendars;
  },

  async listEvents(tokens, calendarExternalId, timeMin, timeMax) {
    const k = key(tokens, calendarExternalId);
    if (!store.has(k)) {
      store.set(k, seedEvents(calendarExternalId));
    }
    return (store.get(k) ?? []).filter(
      (e) => e.endAt >= timeMin && e.startAt <= timeMax
    );
  },

  async createEvent(tokens, calendarExternalId, event) {
    const k = key(tokens, calendarExternalId);
    if (!store.has(k)) store.set(k, seedEvents(calendarExternalId));
    const created: CalendarEventInput = {
      ...event,
      externalId: event.externalId || `mock-${Date.now()}`,
    };
    store.get(k)!.push(created);
    return created;
  },

  async updateEvent(tokens, calendarExternalId, externalId, patch) {
    const k = key(tokens, calendarExternalId);
    const events = store.get(k) ?? [];
    const idx = events.findIndex((e) => e.externalId === externalId);
    if (idx < 0) throw new Error("Event not found");
    events[idx] = { ...events[idx], ...patch, externalId };
    return events[idx];
  },

  async deleteEvent(tokens, calendarExternalId, externalId) {
    const k = key(tokens, calendarExternalId);
    const events = store.get(k) ?? [];
    store.set(
      k,
      events.filter((e) => e.externalId !== externalId)
    );
  },
};
