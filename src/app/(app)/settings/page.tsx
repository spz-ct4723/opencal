"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Copy, Plus, Trash2 } from "lucide-react";

type ShareLink = {
  id: string;
  token: string;
  name: string;
  showDetails: boolean;
  calendarIds: string;
};

export default function SettingsPage() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [calendars, setCalendars] = useState<{ id: string; name: string }[]>(
    []
  );
  const [name, setName] = useState("Public busy feed");
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  async function load() {
    const [s, e] = await Promise.all([
      fetch("/api/share").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
    ]);
    setShares(s.links || []);
    setCalendars(e.calendars || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createShare(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        showDetails,
        calendarIds: selected.length
          ? selected
          : calendars.map((c) => c.id),
      }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/share?id=${id}`, { method: "DELETE" });
    load();
  }

  function copyFeed(token: string) {
    const url = `${window.location.origin}/api/share/${token}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Calendar sharing, MCP access, and self-host notes.
        </p>
      </div>

      <Card id="share">
        <CardHeader
          title="Calendar sharing"
          description="Publish an ICS feed (busy-only or full details) for Google, Outlook, or Apple Calendar."
        />
        <div className="space-y-4 p-5">
          <form onSubmit={createShare} className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
              />
              Show event details (off = busy blocks only)
            </label>
            <div>
              <Label>Calendars</Label>
              <div className="mt-2 space-y-1">
                {calendars.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() =>
                        setSelected((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((x) => x !== c.id)
                            : [...prev, c.id]
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Create share link
            </Button>
          </form>

          <div className="space-y-2 border-t border-border pt-4">
            {shares.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{s.name}</div>
                  <code className="block truncate text-xs text-muted">
                    /api/share/{s.token}
                  </code>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyFeed(s.token)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="MCP server (AI assistants)"
          description="Give Claude, ChatGPT, or any MCP client structured calendar access."
        />
        <div className="space-y-3 p-5 text-sm">
          <p className="text-muted">
            POST JSON to <code className="rounded bg-slate-100 px-1">/api/mcp</code>{" "}
            with session auth or{" "}
            <code className="rounded bg-slate-100 px-1">
              Authorization: Bearer demo
            </code>
            .
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`curl -X POST http://localhost:3000/api/mcp \\
  -H "Authorization: Bearer demo" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"list_events","params":{}}'`}
          </pre>
          <p className="text-muted">
            Tools: list_calendars, list_events, get_availability, create_event,
            update_event, delete_event.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Background sync" description="Keep calendars fresh." />
        <div className="p-5 text-sm text-muted space-y-2">
          <p>
            Call{" "}
            <code className="rounded bg-slate-100 px-1">POST /api/cron/sync</code>{" "}
            with{" "}
            <code className="rounded bg-slate-100 px-1">
              Authorization: Bearer $CRON_SECRET
            </code>{" "}
            every few minutes. Google/Outlook support near real-time via
            frequent polling; iCloud is typically ~5–10 minutes due to Apple
            CalDAV limits.
          </p>
        </div>
      </Card>
    </div>
  );
}
