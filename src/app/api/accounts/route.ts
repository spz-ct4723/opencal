import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProvider, tokensFromAccount } from "@/lib/providers";
import { pullCalendarEvents } from "@/lib/sync/engine";
import { isDemoMode } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    include: {
      calendars: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Never return secrets
  const safe = accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    email: a.email,
    displayName: a.displayName,
    caldavUrl: a.caldavUrl,
    calendars: a.calendars,
    createdAt: a.createdAt,
  }));

  return NextResponse.json({
    accounts: safe,
    demoMode: isDemoMode(),
    oauth: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID),
      microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID),
    },
  });
}

/** Connect a mock/demo account or iCloud with app password */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const provider = body.provider as string;

  if (provider === "mock" || (provider === "demo" && isDemoMode())) {
    const label = body.label || `Mock ${Date.now()}`;
    const providerAccountId = `mock-${session.user.id}-${Date.now()}`;
    const account = await prisma.account.create({
      data: {
        userId: session.user.id,
        provider: "mock",
        providerAccountId,
        email: body.email || `${providerAccountId}@mock.local`,
        displayName: label,
      },
    });

    const prov = getProvider("mock");
    const calendars = await prov.listCalendars(tokensFromAccount(account));
    for (const c of calendars) {
      const cal = await prisma.calendar.create({
        data: {
          userId: session.user.id,
          accountId: account.id,
          externalId: c.externalId,
          name: c.name,
          color: c.color || "#4285F4",
          isPrimary: Boolean(c.isPrimary),
        },
      });
      await pullCalendarEvents(cal.id);
    }

    const full = await prisma.account.findUnique({
      where: { id: account.id },
      include: { calendars: true },
    });
    return NextResponse.json({ account: full });
  }

  if (provider === "icloud") {
    if (!body.email || !body.appPassword) {
      return NextResponse.json(
        { error: "email and appPassword required for iCloud" },
        { status: 400 }
      );
    }
    const account = await prisma.account.create({
      data: {
        userId: session.user.id,
        provider: "icloud",
        providerAccountId: body.email,
        email: body.email,
        displayName: body.email,
        appPassword: body.appPassword,
        caldavUrl: body.caldavUrl || null,
      },
    });

    try {
      const prov = getProvider("icloud");
      const calendars = await prov.listCalendars(tokensFromAccount(account));
      for (const c of calendars) {
        const cal = await prisma.calendar.create({
          data: {
            userId: session.user.id,
            accountId: account.id,
            externalId: c.externalId,
            name: c.name,
            color: c.color || "#A2AAAD",
            isPrimary: Boolean(c.isPrimary),
          },
        });
        try {
          await pullCalendarEvents(cal.id);
        } catch (err) {
          console.error("iCloud pull failed", err);
        }
      }
    } catch (err) {
      await prisma.account.delete({ where: { id: account.id } });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "iCloud connection failed" },
        { status: 400 }
      );
    }

    const full = await prisma.account.findUnique({
      where: { id: account.id },
      include: { calendars: true },
    });
    return NextResponse.json({ account: full });
  }

  return NextResponse.json(
    {
      error:
        "For Google/Outlook, configure OAuth env vars and use the OAuth connect flow. In DEMO_MODE use provider=mock.",
    },
    { status: 400 }
  );
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.event.deleteMany({
    where: { calendar: { accountId: id } },
  });
  await prisma.calendar.deleteMany({ where: { accountId: id } });
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
