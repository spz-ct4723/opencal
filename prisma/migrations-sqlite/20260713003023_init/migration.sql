-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "username" TEXT NOT NULL,
    "image" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "brandColor" TEXT NOT NULL DEFAULT '#4F46E5',
    "brandCover" TEXT,
    "bio" TEXT,
    "socialLinks" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "appPassword" TEXT,
    "caldavUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4285F4',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Calendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Calendar_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "conferenceUrl" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "visibility" TEXT NOT NULL DEFAULT 'default',
    "showAs" TEXT NOT NULL DEFAULT 'busy',
    "color" TEXT,
    "rsvp" TEXT,
    "attendeesJson" TEXT NOT NULL DEFAULT '[]',
    "recurrenceRule" TEXT,
    "isClone" BOOLEAN NOT NULL DEFAULT false,
    "cloneSourceId" TEXT,
    "syncConfigId" TEXT,
    "sourceEventKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_syncConfigId_fkey" FOREIGN KEY ("syncConfigId") REFERENCES "SyncConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'one_way',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "includeTitle" BOOLEAN NOT NULL DEFAULT true,
    "customTitle" TEXT,
    "titleSuffix" TEXT,
    "includeDescription" BOOLEAN NOT NULL DEFAULT false,
    "includeLocation" BOOLEAN NOT NULL DEFAULT false,
    "includeAttendees" BOOLEAN NOT NULL DEFAULT false,
    "includeConference" BOOLEAN NOT NULL DEFAULT false,
    "markPrivate" BOOLEAN NOT NULL DEFAULT true,
    "disableReminders" BOOLEAN NOT NULL DEFAULT true,
    "syncFreeEvents" BOOLEAN NOT NULL DEFAULT false,
    "cloneColor" TEXT,
    "excludeColors" TEXT NOT NULL DEFAULT '[]',
    "includeRsvps" TEXT NOT NULL DEFAULT '["accepted","tentative","needsAction"]',
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncConfigCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncConfigId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "SyncConfigCalendar_syncConfigId_fkey" FOREIGN KEY ("syncConfigId") REFERENCES "SyncConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncConfigCalendar_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchedulingLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durations" TEXT NOT NULL DEFAULT '[30]',
    "locationType" TEXT NOT NULL DEFAULT 'google_meet',
    "locationValue" TEXT,
    "availabilityJson" TEXT NOT NULL DEFAULT '{"mon":[{"start":"09:00","end":"17:00"}],"tue":[{"start":"09:00","end":"17:00"}],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"09:00","end":"17:00"}],"fri":[{"start":"09:00","end":"17:00"}],"sat":[],"sun":[]}',
    "dateOverridesJson" TEXT NOT NULL DEFAULT '[]',
    "bufferBefore" INTEGER NOT NULL DEFAULT 0,
    "bufferAfter" INTEGER NOT NULL DEFAULT 0,
    "minNoticeMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 60,
    "maxBookingsPerDay" INTEGER,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "allowGuests" BOOLEAN NOT NULL DEFAULT true,
    "questionsJson" TEXT NOT NULL DEFAULT '[]',
    "brandColor" TEXT,
    "coverImage" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "confirmationMsg" TEXT,
    "redirectUrl" TEXT,
    "conflictCalendarIds" TEXT NOT NULL DEFAULT '[]',
    "targetCalendarId" TEXT,
    "hostUserIds" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchedulingLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchedulingLink_targetCalendarId_fkey" FOREIGN KEY ("targetCalendarId") REFERENCES "Calendar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedulingLinkId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestNotes" TEXT,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "additionalGuests" TEXT NOT NULL DEFAULT '[]',
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "eventId" TEXT,
    "cancelToken" TEXT NOT NULL,
    "rescheduleToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_schedulingLinkId_fkey" FOREIGN KEY ("schedulingLinkId") REFERENCES "SchedulingLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendarIds" TEXT NOT NULL DEFAULT '[]',
    "showDetails" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "Calendar_userId_idx" ON "Calendar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_accountId_externalId_key" ON "Calendar"("accountId", "externalId");

-- CreateIndex
CREATE INDEX "Event_calendarId_startAt_endAt_idx" ON "Event"("calendarId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Event_isClone_syncConfigId_idx" ON "Event"("isClone", "syncConfigId");

-- CreateIndex
CREATE INDEX "Event_sourceEventKey_idx" ON "Event"("sourceEventKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_calendarId_externalId_key" ON "Event"("calendarId", "externalId");

-- CreateIndex
CREATE INDEX "SyncConfig_userId_idx" ON "SyncConfig"("userId");

-- CreateIndex
CREATE INDEX "SyncConfigCalendar_calendarId_idx" ON "SyncConfigCalendar"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncConfigCalendar_syncConfigId_calendarId_role_key" ON "SyncConfigCalendar"("syncConfigId", "calendarId", "role");

-- CreateIndex
CREATE INDEX "SchedulingLink_slug_idx" ON "SchedulingLink"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingLink_userId_slug_key" ON "SchedulingLink"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_cancelToken_key" ON "Booking"("cancelToken");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_rescheduleToken_key" ON "Booking"("rescheduleToken");

-- CreateIndex
CREATE INDEX "Booking_hostUserId_startAt_idx" ON "Booking"("hostUserId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_schedulingLinkId_idx" ON "Booking"("schedulingLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_token_idx" ON "ShareLink"("token");
