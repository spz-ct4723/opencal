import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const links = await prisma.shareLink.findMany({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  // Only the user's own calendars may be shared
  const requested: string[] = Array.isArray(body.calendarIds)
    ? body.calendarIds
    : [];
  const owned = requested.length
    ? await prisma.calendar.findMany({
        where: { userId: session.user.id, id: { in: requested } },
        select: { id: true },
      })
    : [];
  const link = await prisma.shareLink.create({
    data: {
      userId: session.user.id,
      name: body.name || "Shared calendar",
      calendarIds: JSON.stringify(owned.map((c) => c.id)),
      showDetails: Boolean(body.showDetails),
    },
  });
  return NextResponse.json({ link });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.shareLink.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
