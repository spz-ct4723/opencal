import type { Provider } from "@/lib/types";
import type { CalendarProvider, ProviderTokens } from "./types";
import { mockProvider } from "./mock";
import { googleProvider } from "./google";
import { outlookProvider } from "./outlook";
import { icloudProvider } from "./icloud";
import { isOAuthProvider, refreshAccessToken } from "@/lib/oauth";
import { prisma } from "@/lib/db";

const providers: Record<Provider, CalendarProvider> = {
  mock: mockProvider,
  google: googleProvider,
  outlook: outlookProvider,
  icloud: icloudProvider,
};

export function getProvider(name: string): CalendarProvider {
  const p = providers[name as Provider];
  if (!p) throw new Error(`Unknown calendar provider: ${name}`);
  return p;
}

export function tokensFromAccount(account: {
  accessToken?: string | null;
  refreshToken?: string | null;
  appPassword?: string | null;
  caldavUrl?: string | null;
  email?: string | null;
  providerAccountId?: string | null;
}): ProviderTokens {
  return {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    appPassword: account.appPassword,
    caldavUrl: account.caldavUrl,
    email: account.email,
    providerAccountId: account.providerAccountId,
  };
}

/**
 * Like tokensFromAccount, but refreshes expired Google/Microsoft access
 * tokens first (persisting the new token). Use before any remote API call.
 */
export async function getFreshTokens(account: {
  id: string;
  provider: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  appPassword?: string | null;
  caldavUrl?: string | null;
  email?: string | null;
  providerAccountId?: string | null;
}): Promise<ProviderTokens> {
  const providerName = account.provider === "outlook" ? "outlook" : account.provider;
  const needsRefresh =
    isOAuthProvider(providerName) &&
    account.refreshToken &&
    (!account.expiresAt || account.expiresAt * 1000 < Date.now() + 120_000);

  if (needsRefresh && isOAuthProvider(providerName)) {
    try {
      const t = await refreshAccessToken(providerName, account.refreshToken!);
      const expiresAt = t.expires_in
        ? Math.floor(Date.now() / 1000) + t.expires_in
        : null;
      await prisma.account.update({
        where: { id: account.id },
        data: {
          accessToken: t.access_token,
          refreshToken: t.refresh_token ?? account.refreshToken,
          expiresAt,
        },
      });
      account = {
        ...account,
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? account.refreshToken,
        expiresAt,
      };
    } catch (err) {
      console.error(`Token refresh failed for account ${account.id}`, err);
    }
  }

  return tokensFromAccount(account);
}

export type { CalendarProvider, ProviderTokens };
export { mockProvider, googleProvider, outlookProvider, icloudProvider };
