import type { CalendarEventInput, ExternalCalendar } from "@/lib/types";
import type { CalendarProvider, ProviderTokens } from "./types";

const BASE = "https://www.googleapis.com/calendar/v3";

async function gfetch(tokens: ProviderTokens, path: string, init?: RequestInit) {
  if (!tokens.accessToken) {
    throw new Error("Google access token missing. Connect Google in Accounts.");
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function mapEvent(e: Record<string, unknown>): CalendarEventInput {
  const start = e.start as { dateTime?: string; date?: string; timeZone?: string };
  const end = e.end as { dateTime?: string; date?: string };
  const allDay = Boolean(start?.date && !start?.dateTime);
  const attendees = ((e.attendees as Array<Record<string, string>>) ?? []).map(
    (a) => ({
      email: a.email,
      name: a.displayName,
      response: a.responseStatus,
    })
  );
  const conf =
    (
      e.conferenceData as {
        entryPoints?: { entryPointType: string; uri: string }[];
      }
    )?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
    (e.hangoutLink as string | undefined) ??
    null;

  return {
    externalId: e.id as string,
    title: (e.summary as string) || "(No title)",
    description: (e.description as string) ?? null,
    location: (e.location as string) ?? null,
    conferenceUrl: conf,
    startAt: new Date(start.dateTime ?? start.date!),
    endAt: new Date(end.dateTime ?? end.date!),
    allDay,
    timezone: start.timeZone ?? null,
    status: (e.status as string) ?? "confirmed",
    visibility: (e.visibility as string) ?? "default",
    showAs: e.transparency === "transparent" ? "free" : "busy",
    color: (e.colorId as string) ?? null,
    rsvp: attendees.find((a) => a.response)?.response ?? null,
    attendees,
    recurrenceRule: Array.isArray(e.recurrence)
      ? (e.recurrence as string[]).join("\n")
      : null,
  };
}

export const googleProvider: CalendarProvider = {
  name: "google",

  async listCalendars(tokens) {
    const data = await gfetch(tokens, "/users/me/calendarList");
    return ((data.items as Array<Record<string, unknown>>) ?? []).map(
      (c): ExternalCalendar => ({
        externalId: c.id as string,
        name: (c.summary as string) || "Calendar",
        color: (c.backgroundColor as string) || "#4285F4",
        isPrimary: Boolean(c.primary),
        isReadOnly: c.accessRole === "reader" || c.accessRole === "freeBusyReader",
      })
    );
  },

  async listEvents(tokens, calendarExternalId, timeMin, timeMax) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });
    const data = await gfetch(
      tokens,
      `/calendars/${encodeURIComponent(calendarExternalId)}/events?${params}`
    );
    return ((data.items as Array<Record<string, unknown>>) ?? []).map(mapEvent);
  },

  async createEvent(tokens, calendarExternalId, event) {
    const body = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: event.allDay
        ? { date: event.startAt.toISOString().slice(0, 10) }
        : { dateTime: event.startAt.toISOString() },
      end: event.allDay
        ? { date: event.endAt.toISOString().slice(0, 10) }
        : { dateTime: event.endAt.toISOString() },
      transparency: event.showAs === "free" ? "transparent" : "opaque",
      visibility: event.visibility === "private" ? "private" : "default",
    };
    const data = await gfetch(
      tokens,
      `/calendars/${encodeURIComponent(calendarExternalId)}/events`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return mapEvent(data);
  },

  async updateEvent(tokens, calendarExternalId, externalId, event) {
    const body: Record<string, unknown> = {};
    if (event.title !== undefined) body.summary = event.title;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;
    if (event.startAt) {
      body.start = event.allDay
        ? { date: event.startAt.toISOString().slice(0, 10) }
        : { dateTime: event.startAt.toISOString() };
    }
    if (event.endAt) {
      body.end = event.allDay
        ? { date: event.endAt.toISOString().slice(0, 10) }
        : { dateTime: event.endAt.toISOString() };
    }
    const data = await gfetch(
      tokens,
      `/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalId)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    return mapEvent(data);
  },

  async deleteEvent(tokens, calendarExternalId, externalId) {
    await gfetch(
      tokens,
      `/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalId)}`,
      { method: "DELETE" }
    );
  },
};
