import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exchangeCode, fetchProfile, isOAuthProvider } from "@/lib/oauth";
import { getFreshTokens, getProvider } from "@/lib/providers";
import { pullCalendarEvents } from "@/lib/sync/engine";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const errorRedirect = (message: string) =>
    NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
    );

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("opencal_oauth_state")?.value;
  if (!code) {
    return errorRedirect(
      req.nextUrl.searchParams.get("error") ?? "Connection cancelled"
    );
  }
  if (!state || !cookieState || state !== cookieState) {
    return errorRedirect("OAuth state mismatch — please try again");
  }

  try {
    const redirectUri = new URL(
      `/api/oauth/${provider}/callback`,
      req.nextUrl.origin
    ).toString();
    const tokens = await exchangeCode(provider, code, redirectUri);
    const profile = await fetchProfile(provider, tokens.access_token);

    const account = await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.id,
        },
      },
      create: {
        userId: session.user.id,
        provider,
        providerAccountId: profile.id,
        email: profile.email,
        displayName: profile.name ?? profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : null,
      },
      update: {
        accessToken: tokens.access_token,
        // Google omits refresh_token on re-consent — keep the stored one
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : null,
      },
    });

    if (account.userId !== session.user.id) {
      return errorRedirect(
        "This calendar account is already connected to another OpenCal user"
      );
    }

    const prov = getProvider(provider);
    const remoteCalendars = await prov.listCalendars(await getFreshTokens(account));
    for (const c of remoteCalendars) {
      const cal = await prisma.calendar.upsert({
        where: {
          accountId_externalId: {
            accountId: account.id,
            externalId: c.externalId,
          },
        },
        create: {
          userId: session.user.id,
          accountId: account.id,
          externalId: c.externalId,
          name: c.name,
          color: c.color || "#4285F4",
          isPrimary: Boolean(c.isPrimary),
          isReadOnly: Boolean(c.isReadOnly),
        },
        update: {
          name: c.name,
          color: c.color || "#4285F4",
          isReadOnly: Boolean(c.isReadOnly),
        },
      });
      try {
        await pullCalendarEvents(cal.id);
      } catch (err) {
        console.error(`Initial pull failed for calendar ${cal.id}`, err);
      }
    }

    const res = NextResponse.redirect(new URL("/accounts", req.nextUrl.origin));
    res.cookies.delete("opencal_oauth_state");
    return res;
  } catch (err) {
    console.error(`${provider} OAuth callback failed`, err);
    return errorRedirect(
      err instanceof Error ? err.message : "Connection failed"
    );
  }
}
