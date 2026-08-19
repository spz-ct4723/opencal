// OAuth2 helpers for Google Calendar and Microsoft Graph.
// Used by /api/oauth/[provider]/start + /callback and for token refresh.

export type OAuthProviderName = "google" | "outlook";

type OAuthProviderConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  extraAuthParams?: Record<string, string>;
};

export const OAUTH_PROVIDERS: Record<OAuthProviderName, OAuthProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email https://www.googleapis.com/auth/calendar",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  outlook: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: "offline_access openid email User.Read Calendars.ReadWrite",
    clientId: () => process.env.MICROSOFT_CLIENT_ID,
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
  },
};

export function isOAuthProvider(name: string): name is OAuthProviderName {
  return name === "google" || name === "outlook";
}

export function oauthConfigured(name: OAuthProviderName) {
  const cfg = OAUTH_PROVIDERS[name];
  return Boolean(cfg.clientId() && cfg.clientSecret());
}

export function buildAuthUrl(
  name: OAuthProviderName,
  redirectUri: string,
  state: string
) {
  const cfg = OAUTH_PROVIDERS[name];
  const params = new URLSearchParams({
    client_id: cfg.clientId() ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scopes,
    state,
    ...cfg.extraAuthParams,
  });
  return `${cfg.authUrl}?${params}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

async function tokenRequest(
  name: OAuthProviderName,
  body: Record<string, string>
): Promise<TokenResponse> {
  const cfg = OAUTH_PROVIDERS[name];
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId() ?? "",
      client_secret: cfg.clientSecret() ?? "",
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${name} token endpoint error ${res.status}: ${text}`);
  }
  return res.json();
}

export function exchangeCode(
  name: OAuthProviderName,
  code: string,
  redirectUri: string
) {
  return tokenRequest(name, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(name: OAuthProviderName, refreshToken: string) {
  return tokenRequest(name, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Fetch the account email/identity after connecting. */
export async function fetchProfile(
  name: OAuthProviderName,
  accessToken: string
): Promise<{ id: string; email: string | null; name: string | null }> {
  if (name === "google") {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google userinfo error ${res.status}`);
    const p = await res.json();
    return { id: p.id, email: p.email ?? null, name: p.name ?? null };
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Microsoft profile error ${res.status}`);
  const p = await res.json();
  return {
    id: p.id,
    email: p.mail ?? p.userPrincipalName ?? null,
    name: p.displayName ?? null,
  };
}
