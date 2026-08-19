import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/utils";
import { addDays, subDays } from "date-fns";

/**
 * Lightweight MCP-compatible calendar tools endpoint.
 * POST { method, params } with session cookie or Authorization: Bearer demo
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;

  const authHeader = req.headers.get("authorization");
  if (!userId && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // The shared "demo" bearer token only works in demo mode — it must
    // never grant access on a production deployment.
    if (token === "demo" && isDemoMode()) {
      const demo = await prisma.user.findUnique({
        where: { email: "demo@opencal.dev" },
      });
      userId = demo?.id;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const method = body.method as string;
  const params = body.params ?? {};

  try {
    if (method === "tools/list") {
      return NextResponse.json({
        tools: [
          { name: "list_calendars", description: "List connected calendars" },
          {
            name: "list_events",
            description: "List events across calendars for a date range",
          },
          {
            name: "get_availability",
            description: "Get busy intervals across all calendars",
          },
          { name: "create_event", description: "Create a calendar event" },
          { name: "update_event", description: "Update an event by id" },
          { name: "delete_event", description: "Delete an event by id" },
        ],
      });
    }

    const name = method === "tools/call" ? params.name : method;
    const args = method === "tools/call" ? params.arguments ?? {} : params;

    if (name === "list_calendars") {
      const calendars = await prisma.calendar.findMany({
        where: { userId, enabled: true },
        include: { account: { select: { provider: true, email: true } } },
      });
      return NextResponse.json({ calendars });
    }

    if (name === "list_events") {
      const start = args.start ? new Date(args.start) : subDays(new Date(), 1);
      const end = args.end ? new Date(args.end) : addDays(new Date(), 14);
      const events = await prisma.event.findMany({
        where: {
          calendar: { userId },
          startAt: { lte: end },
          endAt: { gte: start },
          ...(args.hideClones ? { isClone: false } : {}),
        },
        include: {
          calendar: { select: { name: true, color: true } },
        },
        orderBy: { startAt: "asc" },
        take: 200,
      });
      return NextResponse.json({ events });
    }

    if (name === "get_availability") {
      const start = args.start ? new Date(args.start) : new Date();
      const end = args.end ? new Date(args.end) : addDays(new Date(), 7);
      const events = await prisma.event.findMany({
        where: {
          calendar: { userId },
          startAt: { lte: end },
          endAt: { gte: start },
          showAs: { not: "free" },
          status: { not: "cancelled" },
        },
        select: { startAt: true, endAt: true, title: true, isClone: true },
        orderBy: { startAt: "asc" },
      });
      return NextResponse.json({
        busy: events.map((e) => ({
          start: e.startAt,
          end: e.endAt,
          label: e.isClone ? "Busy" : e.title,
        })),
      });
    }

    if (name === "create_event") {
      const calendar = await prisma.calendar.findFirst({
        where: { id: args.calendarId, userId },
      });
      if (!calendar) {
        return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
      }
      const event = await prisma.event.create({
        data: {
          calendarId: calendar.id,
          externalId: `mcp-${Date.now()}`,
          title: args.title || "Untitled",
          description: args.description,
          location: args.location,
          startAt: new Date(args.startAt),
          endAt: new Date(args.endAt),
          allDay: Boolean(args.allDay),
          showAs: "busy",
        },
      });
      return NextResponse.json({ event });
    }

    if (name === "update_event") {
      const event = await prisma.event.findFirst({
        where: { id: args.id, calendar: { userId } },
      });
      if (!event) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: {
          title: args.title ?? undefined,
          description: args.description ?? undefined,
          startAt: args.startAt ? new Date(args.startAt) : undefined,
          endAt: args.endAt ? new Date(args.endAt) : undefined,
        },
      });
      return NextResponse.json({ event: updated });
    }

    if (name === "delete_event") {
      const event = await prisma.event.findFirst({
        where: { id: args.id, calendar: { userId } },
      });
      if (!event) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await prisma.event.delete({ where: { id: event.id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "MCP error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "opencal-mcp",
    version: "1.0.0",
    description:
      "OpenCal Calendar MCP — list calendars, check availability, manage events",
    endpoint: "/api/mcp",
    auth: "Session cookie or Authorization: Bearer demo",
  });
}
