"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

type Account = {
  id: string;
  provider: string;
  email: string | null;
  displayName: string | null;
  caldavUrl?: string | null;
  calendars: { id: string; name: string; color: string; isPrimary: boolean }[];
};

/** Label CalDAV accounts by the server they actually talk to. */
function accountLabel(a: Account, fallback: string): string {
  if (a.provider !== "icloud" || !a.caldavUrl) return fallback;
  try {
    const host = new URL(a.caldavUrl).hostname;
    if (/zoho/i.test(host)) return "Zoho Calendar (CalDAV)";
    if (/fastmail/i.test(host)) return "Fastmail (CalDAV)";
    return `CalDAV (${host})`;
  } catch {
    return fallback;
  }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [demoMode, setDemoMode] = useState(true);
  const [oauth, setOauth] = useState({ google: false, microsoft: false });
  const [showIcloud, setShowIcloud] = useState(false);
  const [showSetup, setShowSetup] = useState<"google" | "outlook" | null>(null);
  const [icloud, setIcloud] = useState({ email: "", appPassword: "" });
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data.accounts || []);
    setDemoMode(data.demoMode);
    setOauth(data.oauth || { google: false, microsoft: false });
  }

  useEffect(() => {
    load();
    // Surface OAuth callback errors (?error=...)
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setError(err);
  }, []);

  async function addMock() {
    setError("");
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "mock",
        label: `Mock account ${accounts.length + 1}`,
      }),
    });
    load();
  }

  async function connectIcloud(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "icloud", ...icloud }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    setShowIcloud(false);
    setIcloud({ email: "", appPassword: "" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Disconnect this account and remove its calendars?")) return;
    await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    load();
  }

  const providerLabel: Record<string, string> = {
    mock: "Mock (demo)",
    google: "Google Calendar",
    outlook: "Microsoft Outlook",
    icloud: "iCloud Calendar",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Connected accounts</h1>
        <p className="mt-1 text-sm text-muted">
          Connect Google, Outlook, and iCloud. In demo mode, mock providers
          simulate full calendar APIs without OAuth.
        </p>
      </div>

      {demoMode && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <strong>Demo mode is on.</strong> OAuth credentials are optional.
          Use mock accounts to try sync, scheduling, and the unified calendar
          end-to-end. Set <code className="rounded bg-white px-1">DEMO_MODE=false</code>{" "}
          and add Google/Microsoft client IDs for production.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {demoMode && (
          <Button onClick={addMock}>
            <Plus className="h-4 w-4" />
            Add mock account
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            if (oauth.google) {
              window.location.href = "/api/oauth/google/start";
            } else {
              setShowSetup("google");
            }
          }}
        >
          Google Calendar
          {!oauth.google && " (setup needed)"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (oauth.microsoft) {
              window.location.href = "/api/oauth/outlook/start";
            } else {
              setShowSetup("outlook");
            }
          }}
        >
          Outlook
          {!oauth.microsoft && " (setup needed)"}
        </Button>
        <Button variant="outline" onClick={() => setShowIcloud(true)}>
          iCloud (app password)
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {accounts.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {a.displayName || a.email || a.provider}
                </div>
                <div className="text-sm text-muted">
                  {accountLabel(a, providerLabel[a.provider] || a.provider)}
                  {a.email ? ` · ${a.email}` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.calendars.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                      {c.isPrimary && (
                        <span className="text-muted">· primary</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          </Card>
        ))}
        {accounts.length === 0 && (
          <Card className="p-10 text-center text-muted">
            No accounts connected yet.
          </Card>
        )}
      </div>

      {showSetup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSetup(null)}
        >
          <div
            className="w-full max-w-lg space-y-3 rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {showSetup === "google" ? "Set up Google Calendar" : "Set up Outlook"}
            </h2>
            <p className="text-sm text-muted">
              This deployment doesn&apos;t have{" "}
              {showSetup === "google" ? "Google" : "Microsoft"} OAuth credentials
              yet. The server admin needs to create an OAuth app and set two
              environment variables, then restart/redeploy:
            </p>
            {showSetup === "google" ? (
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                <li>
                  In Google Cloud Console, create a project and enable the{" "}
                  <strong>Google Calendar API</strong>.
                </li>
                <li>
                  Configure the OAuth consent screen (scope{" "}
                  <code className="rounded bg-slate-100 px-1">
                    …/auth/calendar
                  </code>
                  ).
                </li>
                <li>
                  Create an <strong>OAuth client ID</strong> (Web application)
                  with this authorized redirect URI:
                </li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                <li>
                  In Microsoft Entra (Azure), register an app supporting
                  personal + organizational accounts.
                </li>
                <li>
                  Add delegated Graph permissions:{" "}
                  <code className="rounded bg-slate-100 px-1">
                    Calendars.ReadWrite, offline_access, User.Read
                  </code>
                  .
                </li>
                <li>
                  Create a client secret and add this Web redirect URI:
                </li>
              </ol>
            )}
            <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs">
              {typeof window !== "undefined" ? window.location.origin : ""}
              /api/oauth/{showSetup === "google" ? "google" : "outlook"}/callback
            </code>
            <p className="text-sm text-muted">
              Then set{" "}
              <code className="rounded bg-slate-100 px-1">
                {showSetup === "google" ? "GOOGLE" : "MICROSOFT"}_CLIENT_ID
              </code>{" "}
              and{" "}
              <code className="rounded bg-slate-100 px-1">
                {showSetup === "google" ? "GOOGLE" : "MICROSOFT"}_CLIENT_SECRET
              </code>{" "}
              in the environment.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowSetup(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showIcloud && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowIcloud(false)}
        >
          <form
            className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={connectIcloud}
          >
            <h2 className="text-lg font-semibold">Connect iCloud</h2>
            <p className="text-sm text-muted">
              Create an app-specific password at appleid.apple.com → Sign-In and
              Security → App-Specific Passwords. OpenCal uses CalDAV and never
              stores your Apple ID password.
            </p>
            <div className="space-y-1">
              <Label>Apple ID email</Label>
              <Input
                type="email"
                value={icloud.email}
                onChange={(e) =>
                  setIcloud((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label>App-specific password</Label>
              <Input
                type="password"
                value={icloud.appPassword}
                onChange={(e) =>
                  setIcloud((f) => ({ ...f, appPassword: e.target.value }))
                }
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIcloud(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Connect</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
