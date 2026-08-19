import type { CalendarEventInput, ExternalCalendar, Provider } from "@/lib/types";

export interface CalendarProvider {
  readonly name: Provider;

  listCalendars(tokens: ProviderTokens): Promise<ExternalCalendar[]>;

  listEvents(
    tokens: ProviderTokens,
    calendarExternalId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEventInput[]>;

  createEvent(
    tokens: ProviderTokens,
    calendarExternalId: string,
    event: CalendarEventInput
  ): Promise<CalendarEventInput>;

  updateEvent(
    tokens: ProviderTokens,
    calendarExternalId: string,
    externalId: string,
    event: Partial<CalendarEventInput>
  ): Promise<CalendarEventInput>;

  deleteEvent(
    tokens: ProviderTokens,
    calendarExternalId: string,
    externalId: string
  ): Promise<void>;
}

export type ProviderTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
  appPassword?: string | null;
  caldavUrl?: string | null;
  email?: string | null;
  providerAccountId?: string | null;
};
