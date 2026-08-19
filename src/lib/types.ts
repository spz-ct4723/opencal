export type Provider = "google" | "outlook" | "icloud" | "mock";

export type CalendarEventInput = {
  externalId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  conferenceUrl?: string | null;
  startAt: Date;
  endAt: Date;
  allDay?: boolean;
  timezone?: string | null;
  status?: string;
  visibility?: string;
  showAs?: string;
  color?: string | null;
  rsvp?: string | null;
  attendees?: { email: string; name?: string; response?: string }[];
  recurrenceRule?: string | null;
};

export type ExternalCalendar = {
  externalId: string;
  name: string;
  color?: string;
  isPrimary?: boolean;
  isReadOnly?: boolean;
};

export type SyncPrivacyOptions = {
  includeTitle: boolean;
  customTitle: string | null;
  titleSuffix: string | null;
  includeDescription: boolean;
  includeLocation: boolean;
  includeAttendees: boolean;
  includeConference: boolean;
  markPrivate: boolean;
  disableReminders: boolean;
  syncFreeEvents: boolean;
  cloneColor: string | null;
  excludeColors: string[];
  includeRsvps: string[];
};

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type TimeSlot = { start: string; end: string };

export type WeeklyAvailability = Record<DayKey, TimeSlot[]>;

export type CustomQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "phone" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
};
