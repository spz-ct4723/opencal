import type { CalendarEventInput, ExternalCalendar } from "@/lib/types";
import type { CalendarProvider, ProviderTokens } from "./types";

const BASE = "https://graph.microsoft.com/v1.0";

async function mfetch(tokens: ProviderTokens, path: string, init?: RequestInit) {
  if (!tokens.accessToken) {
    throw new Error("Microsoft access token missing. Connect Outlook in Accounts.");
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft Graph error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function mapEvent(e: Record<string, unknown>): CalendarEventInput {
  const start = e.start as { dateTime: string; timeZone?: string };
  const end = e.end as { dateTime: string };
  const attendees = (
    (e.attendees as Array<{ emailAddress: { address: string; name?: string }; status?: { response?: string } }>) ??
    []
  ).map((a) => ({
    email: a.emailAddress.address,
    name: a.emailAddress.name,
    response: a.status?.response,
  }));
  const online = e.onlineMeeting as { joinUrl?: string } | null;

  return {
    externalId: e.id as string,
    title: (e.subject as string) || "(No title)",
    description: (e.bodyPreview as string) ?? null,
    location: ((e.location as { displayName?: string })?.displayName) ?? null,
    conferenceUrl: online?.joinUrl ?? null,
    startAt: new Date(start.dateTime.endsWith("Z") ? start.dateTime : `${start.dateTime}Z`),
    endAt: new Date(end.dateTime.endsWith("Z") ? end.dateTime : `${end.dateTime}Z`),
    allDay: Boolean(e.isAllDay),
    timezone: start.timeZone ?? null,
    status: e.isCancelled ? "cancelled" : "confirmed",
    visibility: e.sensitivity === "private" ? "private" : "default",
    showAs: (e.showAs as string) === "free" ? "free" : "busy",
    color: null,
    rsvp: (e.responseStatus as { response?: string })?.response ?? null,
    attendees,
    recurrenceRule: null,
  };
}

export const outlookProvider: CalendarProvider = {
  name: "outlook",

  async listCalendars(tokens) {
    const data = await mfetch(tokens, "/me/calendars");
    return ((data.value as Array<Record<string, unknown>>) ?? []).map(
      (c): ExternalCalendar => ({
        externalId: c.id as string,
        name: (c.name as string) || "Calendar",
        color: (c.hexColor as string) || "#0078D4",
        isPrimary: Boolean(c.isDefaultCalendar),
        isReadOnly: Boolean(c.canEdit) === false,
      })
    );
  },

  async listEvents(tokens, calendarExternalId, timeMin, timeMax) {
    const params = new URLSearchParams({
      startDateTime: timeMin.toISOString(),
      endDateTime: timeMax.toISOString(),
      $orderby: "start/dateTime",
      $top: "1000",
    });
    const data = await mfetch(
      tokens,
      `/me/calendars/${encodeURIComponent(calendarExternalId)}/calendarView?${params}`
    );
    return ((data.value as Array<Record<string, unknown>>) ?? []).map(mapEvent);
  },

  async createEvent(tokens, calendarExternalId, event) {
    const body = {
      subject: event.title,
      body: {
        contentType: "text",
        content: event.description ?? "",
      },
      start: {
        dateTime: event.startAt.toISOString().replace("Z", ""),
        timeZone: "UTC",
      },
      end: {
        dateTime: event.endAt.toISOString().replace("Z", ""),
        timeZone: "UTC",
      },
      isAllDay: event.allDay ?? false,
      location: event.location ? { displayName: event.location } : undefined,
      showAs: event.showAs === "free" ? "free" : "busy",
      sensitivity: event.visibility === "private" ? "private" : "normal",
    };
    const data = await mfetch(
      tokens,
      `/me/calendars/${encodeURIComponent(calendarExternalId)}/events`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return mapEvent(data);
  },

  async updateEvent(tokens, calendarExternalId, externalId, event) {
    const body: Record<string, unknown> = {};
    if (event.title !== undefined) body.subject = event.title;
    if (event.description !== undefined) {
      body.body = { contentType: "text", content: event.description };
    }
    if (event.startAt) {
      body.start = {
        dateTime: event.startAt.toISOString().replace("Z", ""),
        timeZone: "UTC",
      };
    }
    if (event.endAt) {
      body.end = {
        dateTime: event.endAt.toISOString().replace("Z", ""),
        timeZone: "UTC",
      };
    }
    const data = await mfetch(
      tokens,
      `/me/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalId)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    return mapEvent(data);
  },

  async deleteEvent(tokens, calendarExternalId, externalId) {
    await mfetch(
      tokens,
      `/me/calendars/${encodeURIComponent(calendarExternalId)}/events/${encodeURIComponent(externalId)}`,
      { method: "DELETE" }
    );
  },
};
