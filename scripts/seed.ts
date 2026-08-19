import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import path from "path";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";

function makeAdapter() {
  if (rawUrl.startsWith("postgres")) {
    return new PrismaPg({ connectionString: rawUrl });
  }
  let dbFile = rawUrl.replace(/^file:/, "");
  if (!path.isAbsolute(dbFile)) {
    dbFile = path.join(process.cwd(), dbFile);
  }
  return new PrismaBetterSqlite3({ url: dbFile });
}

const prisma = new PrismaClient({ adapter: makeAdapter() });

async function main() {
  console.log("Seeding OpenCal demo data...");

  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.syncConfigCalendar.deleteMany();
  await prisma.syncConfig.deleteMany();
  await prisma.schedulingLink.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.calendar.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash("demo1234", 10);

  const demo = await prisma.user.create({
    data: {
      email: "demo@opencal.dev",
      name: "Demo User",
      username: "demo",
      passwordHash,
      timezone: "America/New_York",
      brandColor: "#4F46E5",
      bio: "Open-source calendar sync & scheduling — try booking with me!",
      socialLinks: JSON.stringify({
        twitter: "https://x.com",
        linkedin: "https://linkedin.com",
        website: "https://github.com",
      }),
    },
  });

  const teammate = await prisma.user.create({
    data: {
      email: "alex@opencal.dev",
      name: "Alex Rivera",
      username: "alex",
      passwordHash,
      timezone: "America/New_York",
      brandColor: "#0D9488",
    },
  });

  const workAccount = await prisma.account.create({
    data: {
      userId: demo.id,
      provider: "mock",
      providerAccountId: "demo-work",
      email: "demo@work.example",
      displayName: "Work (Google mock)",
    },
  });

  const personalAccount = await prisma.account.create({
    data: {
      userId: demo.id,
      provider: "mock",
      providerAccountId: "demo-personal",
      email: "demo@personal.example",
      displayName: "Personal (Outlook mock)",
    },
  });

  const workCal = await prisma.calendar.create({
    data: {
      userId: demo.id,
      accountId: workAccount.id,
      externalId: "demo-work-primary",
      name: "Work",
      color: "#4285F4",
      isPrimary: true,
    },
  });

  const personalCal = await prisma.calendar.create({
    data: {
      userId: demo.id,
      accountId: personalAccount.id,
      externalId: "demo-personal-primary",
      name: "Personal",
      color: "#0B8043",
      isPrimary: true,
    },
  });

  const sideCal = await prisma.calendar.create({
    data: {
      userId: demo.id,
      accountId: workAccount.id,
      externalId: "demo-work-side",
      name: "Side Projects",
      color: "#8E24AA",
    },
  });

  // Teammate calendar
  const alexAccount = await prisma.account.create({
    data: {
      userId: teammate.id,
      provider: "mock",
      providerAccountId: "alex-work",
      email: "alex@work.example",
      displayName: "Alex Work",
    },
  });
  const alexCal = await prisma.calendar.create({
    data: {
      userId: teammate.id,
      accountId: alexAccount.id,
      externalId: "alex-work-primary",
      name: "Alex Work",
      color: "#F4511E",
      isPrimary: true,
    },
  });

  const today = startOfDay(new Date());
  const events = [
    {
      calendarId: workCal.id,
      externalId: "w1",
      title: "Product Standup",
      startAt: setMinutes(setHours(today, 9), 0),
      endAt: setMinutes(setHours(today, 9), 30),
      conferenceUrl: "https://meet.google.com/demo",
      color: "#4285F4",
    },
    {
      calendarId: workCal.id,
      externalId: "w2",
      title: "Design Review",
      startAt: setMinutes(setHours(today, 11), 0),
      endAt: setMinutes(setHours(today, 12), 0),
      color: "#4285F4",
    },
    {
      calendarId: workCal.id,
      externalId: "w3",
      title: "Customer Demo",
      startAt: setMinutes(setHours(addDays(today, 1), 14), 0),
      endAt: setMinutes(setHours(addDays(today, 1), 15), 0),
      conferenceUrl: "https://zoom.us/j/demo",
      color: "#4285F4",
    },
    {
      calendarId: personalCal.id,
      externalId: "p1",
      title: "Gym",
      startAt: setMinutes(setHours(today, 7), 0),
      endAt: setMinutes(setHours(today, 8), 0),
      color: "#0B8043",
    },
    {
      calendarId: personalCal.id,
      externalId: "p2",
      title: "Dentist",
      startAt: setMinutes(setHours(addDays(today, 2), 10), 0),
      endAt: setMinutes(setHours(addDays(today, 2), 11), 0),
      location: "Downtown Dental",
      color: "#E67C73",
      visibility: "private",
    },
    {
      calendarId: personalCal.id,
      externalId: "p3",
      title: "Dinner with friends",
      startAt: setMinutes(setHours(addDays(today, 3), 19), 0),
      endAt: setMinutes(setHours(addDays(today, 3), 21), 0),
      color: "#0B8043",
    },
    {
      calendarId: sideCal.id,
      externalId: "s1",
      title: "Open source hacking",
      startAt: setMinutes(setHours(addDays(today, 1), 18), 0),
      endAt: setMinutes(setHours(addDays(today, 1), 20), 0),
      color: "#8E24AA",
    },
    {
      calendarId: alexCal.id,
      externalId: "a1",
      title: "Alex — Client call",
      startAt: setMinutes(setHours(today, 13), 0),
      endAt: setMinutes(setHours(today, 14), 0),
      color: "#F4511E",
    },
  ];

  // sourceEventKey format must match the sync engine: provider:calendarExternalId:eventExternalId
  const calExternalIds: Record<string, string> = {
    [workCal.id]: workCal.externalId,
    [personalCal.id]: personalCal.externalId,
    [sideCal.id]: sideCal.externalId,
    [alexCal.id]: alexCal.externalId,
  };

  for (const e of events) {
    await prisma.event.create({
      data: {
        ...e,
        showAs: "busy",
        status: "confirmed",
        rsvp: "accepted",
        sourceEventKey: `mock:${calExternalIds[e.calendarId]}:${e.externalId}`,
      },
    });
  }

  // Privacy-focused one-way: Personal → Work as "Busy"
  const sync = await prisma.syncConfig.create({
    data: {
      userId: demo.id,
      name: "Personal → Work (privacy)",
      direction: "one_way",
      includeTitle: false,
      customTitle: "Busy",
      includeDescription: false,
      includeLocation: false,
      includeAttendees: false,
      includeConference: false,
      markPrivate: true,
      disableReminders: true,
      titleSuffix: null,
      cloneColor: "#9E9E9E",
    },
  });

  await prisma.syncConfigCalendar.createMany({
    data: [
      { syncConfigId: sync.id, calendarId: personalCal.id, role: "source" },
      { syncConfigId: sync.id, calendarId: workCal.id, role: "target" },
    ],
  });

  // Create clones for personal events on work calendar
  const personalEvents = await prisma.event.findMany({
    where: { calendarId: personalCal.id },
  });
  for (const pe of personalEvents) {
    await prisma.event.create({
      data: {
        calendarId: workCal.id,
        externalId: `clone-${pe.id}`,
        title: "Busy",
        startAt: pe.startAt,
        endAt: pe.endAt,
        allDay: pe.allDay,
        isClone: true,
        cloneSourceId: pe.id,
        syncConfigId: sync.id,
        sourceEventKey: pe.sourceEventKey,
        visibility: "private",
        showAs: "busy",
        color: "#9E9E9E",
      },
    });
  }

  await prisma.syncConfig.update({
    where: { id: sync.id },
    data: { lastSyncedAt: new Date() },
  });

  // Multi-way sync config (enabled but clones already partially seeded)
  const multi = await prisma.syncConfig.create({
    data: {
      userId: demo.id,
      name: "Work ↔ Side Projects",
      direction: "multi_way",
      includeTitle: true,
      titleSuffix: " (synced)",
      includeDescription: false,
      markPrivate: true,
      enabled: true,
    },
  });
  await prisma.syncConfigCalendar.createMany({
    data: [
      { syncConfigId: multi.id, calendarId: workCal.id, role: "peer" },
      { syncConfigId: multi.id, calendarId: sideCal.id, role: "peer" },
    ],
  });

  // Scheduling links
  await prisma.schedulingLink.create({
    data: {
      userId: demo.id,
      slug: "30min",
      title: "30-Minute Meeting",
      description: "A quick chat — pick a time that works for you.",
      durations: JSON.stringify([30]),
      locationType: "google_meet",
      targetCalendarId: workCal.id,
      bufferBefore: 10,
      bufferAfter: 5,
      minNoticeMinutes: 120,
      brandColor: "#4F46E5",
      allowGuests: true,
      questionsJson: JSON.stringify([
        {
          id: "q1",
          label: "What would you like to discuss?",
          type: "textarea",
          required: true,
        },
        {
          id: "q2",
          label: "How did you hear about us?",
          type: "select",
          options: ["Twitter", "Friend", "Search", "Other"],
        },
      ]),
    },
  });

  await prisma.schedulingLink.create({
    data: {
      userId: demo.id,
      slug: "intro",
      title: "Intro Call",
      description: "Choose 15 or 30 minutes.",
      durations: JSON.stringify([15, 30]),
      locationType: "zoom",
      targetCalendarId: workCal.id,
      brandColor: "#0D9488",
    },
  });

  await prisma.schedulingLink.create({
    data: {
      userId: demo.id,
      slug: "team-demo",
      title: "Team Product Demo",
      description: "Meet with Demo User and Alex.",
      durations: JSON.stringify([45]),
      locationType: "google_meet",
      hostUserIds: JSON.stringify([teammate.id]),
      targetCalendarId: workCal.id,
      brandColor: "#7C3AED",
    },
  });

  // Sample booking
  await prisma.booking.create({
    data: {
      schedulingLinkId: (await prisma.schedulingLink.findFirstOrThrow({
        where: { slug: "30min" },
      })).id,
      hostUserId: demo.id,
      guestName: "Jordan Lee",
      guestEmail: "jordan@example.com",
      startAt: setMinutes(setHours(addDays(today, 4), 10), 0),
      endAt: setMinutes(setHours(addDays(today, 4), 10), 30),
      timezone: "America/New_York",
      duration: 30,
      status: "confirmed",
      guestNotes: "Looking forward to it!",
    },
  });

  // Team
  const team = await prisma.team.create({
    data: {
      name: "OpenCal Demo Team",
      ownerId: demo.id,
    },
  });
  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: demo.id, role: "owner" },
      { teamId: team.id, userId: teammate.id, role: "member" },
    ],
  });

  // Share link
  await prisma.shareLink.create({
    data: {
      userId: demo.id,
      name: "Public busy feed",
      calendarIds: JSON.stringify([workCal.id, personalCal.id]),
      showDetails: false,
      token: "demo-share-token",
    },
  });

  console.log("Seed complete!");
  console.log("  Login: demo@opencal.dev / demo1234");
  console.log("  Booking: /book/demo/30min");
  console.log("  Teammate: alex@opencal.dev / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
