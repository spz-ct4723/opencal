import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { buildAuthUrl, isOAuthProvider, oauthConfigured } from "@/lib/oauth";

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
  if (!oauthConfigured(provider)) {
    return NextResponse.json(
      { error: `Set ${provider === "google" ? "GOOGLE" : "MICROSOFT"}_CLIENT_ID / _SECRET in .env` },
      { status: 400 }
    );
  }

  const state = randomUUID();
  const redirectUri = new URL(`/api/oauth/${provider}/callback`, req.nextUrl.origin).toString();
  const res = NextResponse.redirect(buildAuthUrl(provider, redirectUri, state));
  res.cookies.set("opencal_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
