/**
 * iCloud Calendar via CalDAV.
 * Users authenticate with Apple ID email + app-specific password.
 * Full CalDAV sync is implemented for list/create/update/delete of events.
 * Note: Apple does not offer real-time webhooks; poll every ~5–10 minutes.
 */
import type { CalendarEventInput, ExternalCalendar } from "@/lib/types";
import type { CalendarProvider, ProviderTokens } from "./types";

const DEFAULT_CALDAV = "https://caldav.icloud.com";

function authHeader(tokens: ProviderTokens) {
  if (!tokens.email || !tokens.appPassword) {
    throw new Error(
      "iCloud requires email + app-specific password. Create one at appleid.apple.com → Sign-In and Security → App-Specific Passwords."
    );
  }
  const raw = Buffer.from(`${tokens.email}:${tokens.appPassword}`).toString("base64");
  return `Basic ${raw}`;
}

async function caldav(
  tokens: ProviderTokens,
  path: string,
  method: string,
  body?: string,
  headers?: Record<string, string>
) {
  const base = tokens.caldavUrl || DEFAULT_CALDAV;
  const url = path.startsWith("http")
    ? path
    : path.startsWith("/")
      ? new URL(path, base).toString()
      : `${base}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(tokens),
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "1",
      ...headers,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`iCloud CalDAV error ${res.status}: ${text.slice(0, 300)}`);
  }
  return text;
}

function parseIcsDate(value: string, isDate?: boolean): Date {
  if (isDate || /^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    return new Date(Date.UTC(y, m, d));
  }
  // 20260712T150000Z or 20260712T150000
  const cleaned = value.replace(/[-:]/g, "");
  const y = Number(cleaned.slice(0, 4));
  const mo = Number(cleaned.slice(4, 6)) - 1;
  const d = Number(cleaned.slice(6, 8));
  const h = Number(cleaned.slice(9, 11) || 0);
  const mi = Number(cleaned.slice(11, 13) || 0);
  const s = Number(cleaned.slice(13, 15) || 0);
  if (value.endsWith("Z") || cleaned.includes("Z")) {
    return new Date(Date.UTC(y, mo, d, h, mi, s));
  }
  return new Date(y, mo, d, h, mi, s);
}

function parseVEvent(ics: string, href: string): CalendarEventInput | null {
  const get = (key: string) => {
    const re = new RegExp(`^${key}[^:]*:(.+)$`, "mi");
    const m = ics.match(re);
    return m?.[1]?.trim().replace(/\\n/g, "\n").replace(/\\,/g, ",");
  };
  const uid = get("UID");
  if (!uid) return null;
  const dtstartLine = ics.match(/^DTSTART([^:]*):(.+)$/mi);
  const dtendLine = ics.match(/^DTEND([^:]*):(.+)$/mi);
  if (!dtstartLine || !dtendLine) return null;
  const allDay = /VALUE=DATE/i.test(dtstartLine[1] || "");
  return {
    externalId: href || uid,
    title: get("SUMMARY") || "(No title)",
    description: get("DESCRIPTION") ?? null,
    location: get("LOCATION") ?? null,
    conferenceUrl: get("URL") ?? null,
    startAt: parseIcsDate(dtstartLine[2], allDay),
    endAt: parseIcsDate(dtendLine[2], allDay),
    allDay,
    status: (get("STATUS") || "confirmed").toLowerCase(),
    showAs: /TRANSP:TRANSPARENT/i.test(ics) ? "free" : "busy",
    visibility: /CLASS:PRIVATE/i.test(ics) ? "private" : "default",
    attendees: [],
  };
}

function toIcs(event: CalendarEventInput): string {
  const fmt = (d: Date, allDay?: boolean) => {
    if (allDay) {
      return d.toISOString().slice(0, 10).replace(/-/g, "");
    }
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const uid = event.externalId || `${Date.now()}@opencal`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenCal//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    event.allDay
      ? `DTSTART;VALUE=DATE:${fmt(event.startAt, true)}`
      : `DTSTART:${fmt(event.startAt)}`,
    event.allDay
      ? `DTEND;VALUE=DATE:${fmt(event.endAt, true)}`
      : `DTEND:${fmt(event.endAt)}`,
    `SUMMARY:${(event.title || "").replace(/\n/g, "\\n")}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`);
  }
  if (event.location) lines.push(`LOCATION:${event.location}`);
  if (event.visibility === "private") lines.push("CLASS:PRIVATE");
  if (event.showAs === "free") lines.push("TRANSP:TRANSPARENT");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export const icloudProvider: CalendarProvider = {
  name: "icloud",

  async listCalendars(tokens) {
    const home = tokens.caldavUrl || DEFAULT_CALDAV;
    const propfind = (url: string, body: string, depth: string) =>
      caldav(tokens, url, "PROPFIND", body, { Depth: depth });
    const hrefOf = (xml: string, prop: string) =>
      xml.match(
        new RegExp(
          `<(?:[a-z0-9]+:)?${prop}[^>]*>\\s*<(?:[a-z0-9]+:)?href[^>]*>([^<]+)<`,
          "i"
        )
      )?.[1];

    const listAt = async (collectionUrl: string): Promise<ExternalCalendar[]> => {
      const xml = await propfind(
        collectionUrl,
        `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`,
        "1"
      );
      const responses = xml.split(/<(?:[a-z0-9]+:)?response[^>]*>/i).slice(1);
      const calendars: ExternalCalendar[] = [];
      for (const r of responses) {
        const href = r.match(/<(?:[a-z0-9]+:)?href[^>]*>([^<]+)<\/(?:[a-z0-9]+:)?href>/i)?.[1];
        const isCalendar = /<(?:[a-z0-9]+:)?calendar(?:\s[^>]*)?\/>/i.test(r);
        if (!href || !isCalendar) continue;
        const name =
          r.match(/<(?:[a-z0-9]+:)?displayname[^>]*>([^<]*)<\/(?:[a-z0-9]+:)?displayname>/i)?.[1] ||
          decodeURIComponent(href.replace(/\/$/, "").split("/").pop() || "Calendar");
        calendars.push({
          externalId: href,
          name,
          color: "#A2AAAD",
          isPrimary: calendars.length === 0,
        });
      }
      return calendars;
    };

    // RFC 6764 discovery: well-known → principal → calendar-home-set → calendars
    try {
      const principalXml = await propfind(
        "/.well-known/caldav",
        `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
        "0"
      );
      const principal = hrefOf(principalXml, "current-user-principal");
      if (principal) {
        const homeXml = await propfind(
          principal,
          `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
          "0"
        );
        const calendarHome = hrefOf(homeXml, "calendar-home-set");
        if (calendarHome) {
          const found = await listAt(calendarHome);
          if (found.length) return found;
        }
      }
    } catch {
      // fall through to direct listing of the configured home
    }

    try {
      const found = await listAt(home);
      if (found.length) return found;
    } catch {
      // fall through to stub calendar for configured home
    }
    return [
      {
        externalId: `${home}/calendars/home/`,
        name: "iCloud Calendar",
        color: "#A2AAAD",
        isPrimary: true,
      },
    ];
  },

  async listEvents(tokens, calendarExternalId, timeMin, timeMax) {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${timeMin.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}"
                      end="${timeMax.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
    const xml = await caldav(tokens, calendarExternalId, "REPORT", body, {
      Depth: "1",
    });
    const chunks = xml.split(/<(?:[a-z0-9]+:)?response[^>]*>/i).slice(1);
    const events: CalendarEventInput[] = [];
    for (const chunk of chunks) {
      const href = chunk.match(/<(?:[a-z0-9]+:)?href[^>]*>([^<]+)<\/(?:[a-z0-9]+:)?href>/i)?.[1] ?? "";
      const icsMatch = chunk.match(
        /<(?:[a-z0-9]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?calendar-data>/i
      );
      if (!icsMatch) {
        // Some servers (e.g. Zoho) omit calendar-data in query responses;
        // fetch the event resource directly instead.
        if (href && /\.ics$/i.test(href)) {
          try {
            const ics = await caldav(tokens, href, "GET");
            const ev = parseVEvent(ics, href);
            if (ev) events.push(ev);
          } catch {
            // skip unreadable event
          }
        }
        continue;
      }
      const ics = icsMatch[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      const ev = parseVEvent(ics, href);
      if (ev) events.push(ev);
    }
    return events;
  },

  async createEvent(tokens, calendarExternalId, event) {
    const uid = event.externalId || `${Date.now()}@opencal.local`;
    const href = calendarExternalId.endsWith("/")
      ? `${calendarExternalId}${uid}.ics`
      : `${calendarExternalId}/${uid}.ics`;
    const ics = toIcs({ ...event, externalId: uid });
    await caldav(tokens, href, "PUT", ics, {
      "Content-Type": "text/calendar; charset=utf-8",
      "If-None-Match": "*",
    });
    return { ...event, externalId: href };
  },

  async updateEvent(tokens, calendarExternalId, externalId, event) {
    const href = externalId.startsWith("http") || externalId.includes("/")
      ? externalId
      : `${calendarExternalId}${externalId}.ics`;
    const full: CalendarEventInput = {
      externalId,
      title: event.title ?? "Busy",
      description: event.description,
      location: event.location,
      startAt: event.startAt ?? new Date(),
      endAt: event.endAt ?? new Date(),
      allDay: event.allDay,
      showAs: event.showAs,
      visibility: event.visibility,
    };
    await caldav(tokens, href, "PUT", toIcs(full), {
      "Content-Type": "text/calendar; charset=utf-8",
    });
    return full;
  },

  async deleteEvent(tokens, _calendarExternalId, externalId) {
    await caldav(tokens, externalId, "DELETE");
  },
};
