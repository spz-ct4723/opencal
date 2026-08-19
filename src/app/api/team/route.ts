import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  username: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Anonymized busy times for teammates
  const teammateIds = new Set<string>();
  for (const m of memberships) {
    for (const member of m.team.members) {
      if (member.userId !== session.user.id) teammateIds.add(member.userId);
    }
  }

  const busy = await prisma.event.findMany({
    where: {
      calendar: { userId: { in: [...teammateIds] }, enabled: true },
      showAs: "busy",
      status: { not: "cancelled" },
      // overlap with [now - 1d, now + 14d]
      startAt: { lte: new Date(Date.now() + 14 * 86400000) },
      endAt: { gte: new Date(Date.now() - 86400000) },
    },
    select: {
      startAt: true,
      endAt: true,
      calendar: { select: { userId: true } },
    },
  });

  const teammateBusy = busy.map((b) => ({
    userId: b.calendar.userId,
    startAt: b.startAt,
    endAt: b.endAt,
    title: "Busy",
  }));

  return NextResponse.json({
    teams: memberships.map((m) => m.team),
    teammateBusy,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();

  if (body.action === "create") {
    const team = await prisma.team.create({
      data: {
        name: body.name || "My Team",
        ownerId: session.user.id,
        members: {
          create: { userId: session.user.id, role: "owner" },
        },
      },
      include: { members: true },
    });
    return NextResponse.json({ team });
  }

  if (body.action === "invite") {
    const team = await prisma.team.findFirst({
      where: {
        id: body.teamId,
        members: { some: { userId: session.user.id, role: { in: ["owner", "admin"] } } },
      },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    // Only filter on the identifiers actually provided — an undefined value
    // inside OR is ignored by Prisma and would match every user.
    const identifiers = [
      body.email ? { email: body.email as string } : null,
      body.username ? { username: body.username as string } : null,
    ].filter(Boolean) as { email?: string; username?: string }[];
    if (identifiers.length === 0) {
      return NextResponse.json(
        { error: "email or username required" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findFirst({ where: { OR: identifiers } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      create: { teamId: team.id, userId: user.id, role: "member" },
      update: {},
    });
    return NextResponse.json({ ok: true, userId: user.id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
