import { prisma } from "@/lib/db";
import { getFreshTokens, getProvider } from "@/lib/providers";
import type { CalendarEventInput, SyncPrivacyOptions } from "@/lib/types";
import { parseJson } from "@/lib/utils";
import { addDays, subDays } from "date-fns";

function sourceKey(provider: string, calendarExternalId: string, externalId: string) {
  return `${provider}:${calendarExternalId}:${externalId}`;
}

function shouldSyncEvent(
  event: CalendarEventInput,
  opts: SyncPrivacyOptions
): boolean {
  if (!opts.syncFreeEvents && event.showAs === "free") return false;
  if (event.color && opts.excludeColors.includes(event.color)) return false;
  if (event.rsvp && opts.includeRsvps.length) {
    const normalized = event.rsvp.toLowerCase();
    const map: Record<string, string> = {
      accepted: "accepted",
      going: "accepted",
      tentative: "tentative",
      maybe: "tentative",
      declined: "declined",
      no: "declined",
      needsaction: "needsAction",
      unanswered: "needsAction",
      none: "needsAction",
      notresponded: "needsAction",
    };
    const r = map[normalized] ?? normalized;
    if (!opts.includeRsvps.map((x) => x.toLowerCase()).includes(r.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function transformClone(
  event: CalendarEventInput,
  opts: SyncPrivacyOptions
): CalendarEventInput {
  let title = event.title;
  if (!opts.includeTitle) {
    title = opts.customTitle || "Busy";
  } else if (opts.titleSuffix) {
    title = `${event.title}${opts.titleSuffix}`;
  }

  let description: string | null = null;
  if (opts.includeDescription) description = event.description ?? null;
  if (opts.includeAttendees && event.attendees?.length) {
    const list = event.attendees
      .map((a) => a.name || a.email)
      .join(", ");
    description = [description, `Attendees: ${list}`].filter(Boolean).join("\n");
  }

  return {
    externalId: "", // assigned on create
    title,
    description,
    location: opts.includeLocation ? event.location ?? null : null,
    conferenceUrl: opts.includeConference ? event.conferenceUrl ?? null : null,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    timezone: event.timezone,
    status: "confirmed",
    visibility: opts.markPrivate ? "private" : event.visibility ?? "default",
    showAs: "busy",
    color: opts.cloneColor ?? event.color,
    attendees: [],
  };
}

type SyncConfigFull = Awaited<ReturnType<typeof loadSyncConfig>>;

async function loadSyncConfig(syncConfigId: string) {
  return prisma.syncConfig.findUniqueOrThrow({
    where: { id: syncConfigId },
    include: {
      calendars: {
        include: {
          calendar: {
            include: { account: true },
          },
        },
      },
    },
  });
}

function optsFromConfig(config: {
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
  excludeColors: string;
  includeRsvps: string;
}): SyncPrivacyOptions {
  return {
    includeTitle: config.includeTitle,
    customTitle: config.customTitle,
    titleSuffix: config.titleSuffix,
    includeDescription: config.includeDescription,
    includeLocation: config.includeLocation,
    includeAttendees: config.includeAttendees,
    includeConference: config.includeConference,
    markPrivate: config.markPrivate,
    disableReminders: config.disableReminders,
    syncFreeEvents: config.syncFreeEvents,
    cloneColor: config.cloneColor,
    excludeColors: parseJson<string[]>(config.excludeColors, []),
    includeRsvps: parseJson<string[]>(config.includeRsvps, [
      "accepted",
      "tentative",
      "needsAction",
    ]),
  };
}

/**
 * Pull remote events into local DB for a calendar (cache for calendar view + sync).
 */
export async function pullCalendarEvents(calendarId: string) {
  const calendar = await prisma.calendar.findUniqueOrThrow({
    where: { id: calendarId },
    include: { account: true },
  });
  const provider = getProvider(calendar.account.provider);
  const tokens = await getFreshTokens(calendar.account);
  const timeMin = subDays(new Date(), 7);
  const timeMax = addDays(new Date(), 90);
  const remote = await provider.listEvents(
    tokens,
    calendar.externalId,
    timeMin,
    timeMax
  );

  const seen = new Set<string>();
  for (const ev of remote) {
    seen.add(ev.externalId);
    await prisma.event.upsert({
      where: {
        calendarId_externalId: {
          calendarId: calendar.id,
          externalId: ev.externalId,
        },
      },
      create: {
        calendarId: calendar.id,
        externalId: ev.externalId,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        conferenceUrl: ev.conferenceUrl,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: ev.allDay ?? false,
        timezone: ev.timezone,
        status: ev.status ?? "confirmed",
        visibility: ev.visibility ?? "default",
        showAs: ev.showAs ?? "busy",
        color: ev.color,
        rsvp: ev.rsvp,
        attendeesJson: JSON.stringify(ev.attendees ?? []),
        recurrenceRule: ev.recurrenceRule,
        isClone: false,
        sourceEventKey: sourceKey(
          calendar.account.provider,
          calendar.externalId,
          ev.externalId
        ),
      },
      update: {
        title: ev.title,
        description: ev.description,
        location: ev.location,
        conferenceUrl: ev.conferenceUrl,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: ev.allDay ?? false,
        status: ev.status ?? "confirmed",
        visibility: ev.visibility ?? "default",
        showAs: ev.showAs ?? "busy",
        color: ev.color,
        rsvp: ev.rsvp,
        attendeesJson: JSON.stringify(ev.attendees ?? []),
      },
    });
  }

  // Remove local non-clone events that disappeared remotely (within window)
  const local = await prisma.event.findMany({
    where: {
      calendarId: calendar.id,
      isClone: false,
      startAt: { lte: timeMax },
      endAt: { gte: timeMin },
      externalId: { not: null },
    },
  });
  for (const l of local) {
    if (l.externalId && !seen.has(l.externalId)) {
      await prisma.event.delete({ where: { id: l.id } });
    }
  }

  return remote.length;
}

/**
 * Run a single sync config: clone source events into targets (or peers multi-way).
 * Never clones events that are themselves clones (loop protection).
 */
export async function runSyncConfig(syncConfigId: string) {
  const config = await loadSyncConfig(syncConfigId);
  if (!config.enabled) return { created: 0, updated: 0, deleted: 0 };

  const opts = optsFromConfig(config);
  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Refresh sources first
  for (const m of config.calendars) {
    if (m.role === "target") continue;
    try {
      await pullCalendarEvents(m.calendarId);
    } catch (err) {
      console.error(`Pull failed for calendar ${m.calendarId}`, err);
    }
  }

  const memberships = config.calendars;
  const pairs: { sourceId: string; targetId: string }[] = [];

  if (config.direction === "multi_way") {
    const peers = memberships.filter((m) => m.role === "peer" || m.role === "source");
    for (const a of peers) {
      for (const b of peers) {
        if (a.calendarId !== b.calendarId) {
          pairs.push({ sourceId: a.calendarId, targetId: b.calendarId });
        }
      }
    }
  } else {
    const sources = memberships.filter((m) => m.role === "source");
    const targets = memberships.filter((m) => m.role === "target");
    for (const s of sources) {
      for (const t of targets) {
        pairs.push({ sourceId: s.calendarId, targetId: t.calendarId });
      }
    }
  }

  // Aggregate active source keys per target across ALL pairs before deleting
  // orphans — a target can receive clones from several sources, and deleting
  // per-pair would wrongly remove the other sources' clones on every run.
  const activeKeysByTarget = new Map<string, Set<string>>();
  const targetIds =
    config.direction === "multi_way"
      ? memberships
          .filter((m) => m.role === "peer" || m.role === "source")
          .map((m) => m.calendarId)
      : memberships.filter((m) => m.role === "target").map((m) => m.calendarId);
  for (const id of targetIds) activeKeysByTarget.set(id, new Set());

  for (const pair of pairs) {
    const result = await syncPair(config, pair.sourceId, pair.targetId, opts);
    created += result.created;
    updated += result.updated;
    const keys = activeKeysByTarget.get(pair.targetId);
    for (const k of result.activeSourceKeys) keys?.add(k);
  }

  for (const [targetId, keys] of activeKeysByTarget) {
    deleted += await deleteOrphanClones(config.id, targetId, keys);
  }

  await prisma.syncConfig.update({
    where: { id: config.id },
    data: { lastSyncedAt: new Date() },
  });

  return { created, updated, deleted };
}

async function syncPair(
  config: SyncConfigFull,
  sourceCalendarId: string,
  targetCalendarId: string,
  opts: SyncPrivacyOptions
) {
  let created = 0;
  let updated = 0;

  const sourceCal = await prisma.calendar.findUniqueOrThrow({
    where: { id: sourceCalendarId },
    include: { account: true },
  });
  const targetCal = await prisma.calendar.findUniqueOrThrow({
    where: { id: targetCalendarId },
    include: { account: true },
  });

  const sourceEvents = await prisma.event.findMany({
    where: {
      calendarId: sourceCalendarId,
      isClone: false,
      status: { not: "cancelled" },
      startAt: { lte: addDays(new Date(), 90) },
      endAt: { gte: subDays(new Date(), 7) },
    },
  });

  const activeSourceKeys = new Set<string>();
  const targetProvider = getProvider(targetCal.account.provider);
  const targetTokens = await getFreshTokens(targetCal.account);

  for (const src of sourceEvents) {
    const input: CalendarEventInput = {
      externalId: src.externalId ?? src.id,
      title: src.title,
      description: src.description,
      location: src.location,
      conferenceUrl: src.conferenceUrl,
      startAt: src.startAt,
      endAt: src.endAt,
      allDay: src.allDay,
      timezone: src.timezone,
      status: src.status,
      visibility: src.visibility,
      showAs: src.showAs,
      color: src.color,
      rsvp: src.rsvp,
      attendees: parseJson(src.attendeesJson, []),
    };

    if (!shouldSyncEvent(input, opts)) continue;

    const sk =
      src.sourceEventKey ||
      sourceKey(
        sourceCal.account.provider,
        sourceCal.externalId,
        src.externalId ?? src.id
      );
    activeSourceKeys.add(sk);

    // Skip if target already has this as an original (multi-way loop guard)
    const existingOriginal = await prisma.event.findFirst({
      where: {
        calendarId: targetCalendarId,
        isClone: false,
        sourceEventKey: sk,
      },
    });
    if (existingOriginal) continue;

    const clonePayload = transformClone(input, opts);
    const existingClone = await prisma.event.findFirst({
      where: {
        calendarId: targetCalendarId,
        isClone: true,
        syncConfigId: config.id,
        sourceEventKey: sk,
      },
    });

    if (existingClone) {
      const changed =
        existingClone.title !== clonePayload.title ||
        existingClone.startAt.getTime() !== clonePayload.startAt.getTime() ||
        existingClone.endAt.getTime() !== clonePayload.endAt.getTime() ||
        existingClone.description !== clonePayload.description ||
        existingClone.location !== clonePayload.location;

      if (changed) {
        if (existingClone.externalId) {
          try {
            await targetProvider.updateEvent(
              targetTokens,
              targetCal.externalId,
              existingClone.externalId,
              clonePayload
            );
          } catch (err) {
            console.error("Remote clone update failed", err);
          }
        }
        await prisma.event.update({
          where: { id: existingClone.id },
          data: {
            title: clonePayload.title,
            description: clonePayload.description,
            location: clonePayload.location,
            conferenceUrl: clonePayload.conferenceUrl,
            startAt: clonePayload.startAt,
            endAt: clonePayload.endAt,
            allDay: clonePayload.allDay ?? false,
            visibility: clonePayload.visibility,
            color: clonePayload.color,
          },
        });
        updated++;
      }
    } else {
      let externalId: string | null = null;
      try {
        const remote = await targetProvider.createEvent(
          targetTokens,
          targetCal.externalId,
          {
            ...clonePayload,
            externalId: `opencal-clone-${config.id}-${src.id}`,
          }
        );
        externalId = remote.externalId;
      } catch (err) {
        console.error("Remote clone create failed (local only)", err);
        externalId = `local-clone-${src.id}-${Date.now()}`;
      }

      await prisma.event.create({
        data: {
          calendarId: targetCalendarId,
          externalId,
          title: clonePayload.title,
          description: clonePayload.description,
          location: clonePayload.location,
          conferenceUrl: clonePayload.conferenceUrl,
          startAt: clonePayload.startAt,
          endAt: clonePayload.endAt,
          allDay: clonePayload.allDay ?? false,
          visibility: clonePayload.visibility ?? "private",
          showAs: "busy",
          color: clonePayload.color,
          isClone: true,
          cloneSourceId: src.id,
          syncConfigId: config.id,
          sourceEventKey: sk,
        },
      });
      created++;
    }
  }

  return { created, updated, activeSourceKeys };
}

/**
 * Delete clones on a target whose source event no longer exists in ANY
 * source feeding that target. Runs once per target after all pairs synced.
 */
async function deleteOrphanClones(
  syncConfigId: string,
  targetCalendarId: string,
  activeSourceKeys: Set<string>
) {
  let deleted = 0;
  const targetCal = await prisma.calendar.findUniqueOrThrow({
    where: { id: targetCalendarId },
    include: { account: true },
  });

  const orphanClones = await prisma.event.findMany({
    where: {
      calendarId: targetCalendarId,
      isClone: true,
      syncConfigId,
    },
  });

  const targetProvider = getProvider(targetCal.account.provider);
  const targetTokens = await getFreshTokens(targetCal.account);

  for (const clone of orphanClones) {
    if (clone.sourceEventKey && activeSourceKeys.has(clone.sourceEventKey)) continue;
    if (clone.externalId) {
      try {
        await targetProvider.deleteEvent(
          targetTokens,
          targetCal.externalId,
          clone.externalId
        );
      } catch (err) {
        console.error("Remote clone delete failed", err);
      }
    }
    await prisma.event.delete({ where: { id: clone.id } });
    deleted++;
  }

  return deleted;
}

export async function runAllSyncsForUser(userId: string) {
  const configs = await prisma.syncConfig.findMany({
    where: { userId, enabled: true },
  });
  const results = [];
  for (const c of configs) {
    results.push({ id: c.id, ...(await runSyncConfig(c.id)) });
  }
  return results;
}

export async function deleteSyncClones(syncConfigId: string) {
  const clones = await prisma.event.findMany({
    where: { syncConfigId, isClone: true },
    include: { calendar: { include: { account: true } } },
  });
  for (const clone of clones) {
    if (clone.externalId) {
      try {
        const provider = getProvider(clone.calendar.account.provider);
        await provider.deleteEvent(
          await getFreshTokens(clone.calendar.account),
          clone.calendar.externalId,
          clone.externalId
        );
      } catch {
        /* best effort */
      }
    }
  }
  await prisma.event.deleteMany({ where: { syncConfigId, isClone: true } });
}
