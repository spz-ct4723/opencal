"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { format } from "date-fns";
import { Plus, Play, Trash2, RefreshCw, Shield } from "lucide-react";

type Cal = {
  id: string;
  name: string;
  color: string;
  account?: { provider: string };
};
type Sync = {
  id: string;
  name: string;
  direction: string;
  enabled: boolean;
  includeTitle: boolean;
  customTitle: string | null;
  titleSuffix: string | null;
  markPrivate: boolean;
  lastSyncedAt: string | null;
  calendars: { role: string; calendar: Cal }[];
};

export default function SyncsPage() {
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [calendars, setCalendars] = useState<Cal[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Personal → Work",
    direction: "one_way",
    sourceCalendarIds: [] as string[],
    targetCalendarIds: [] as string[],
    peerCalendarIds: [] as string[],
    includeTitle: false,
    customTitle: "Busy",
    titleSuffix: "",
    includeDescription: false,
    includeLocation: false,
    includeAttendees: false,
    includeConference: false,
    markPrivate: true,
  });

  async function load() {
    const [s, e] = await Promise.all([
      fetch("/api/syncs").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
    ]);
    setSyncs(s.syncs || []);
    setCalendars(e.calendars || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSync(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/syncs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        direction: form.direction,
        sourceCalendarIds: form.sourceCalendarIds,
        targetCalendarIds: form.targetCalendarIds,
        peerCalendarIds: form.peerCalendarIds,
        privacy: {
          includeTitle: form.includeTitle,
          customTitle: form.customTitle,
          titleSuffix: form.titleSuffix || null,
          includeDescription: form.includeDescription,
          includeLocation: form.includeLocation,
          includeAttendees: form.includeAttendees,
          includeConference: form.includeConference,
          markPrivate: form.markPrivate,
        },
      }),
    });
    setShowCreate(false);
    load();
  }

  async function runSync(id?: string) {
    setRunning(id || "all");
    await fetch("/api/syncs/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    setRunning(null);
    load();
  }

  async function removeSync(id: string) {
    if (!confirm("Delete this sync and all clone events?")) return;
    await fetch(`/api/syncs?id=${id}&deleteClones=true`, { method: "DELETE" });
    load();
  }

  function toggleId(
    field: "sourceCalendarIds" | "targetCalendarIds" | "peerCalendarIds",
    id: string
  ) {
    setForm((f) => {
      const set = new Set(f[field]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, [field]: [...set] };
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendar Sync</h1>
          <p className="mt-1 text-sm text-muted">
            One-way or multi-way real-time sync with privacy controls — avoid
            double-booking without leaking event details.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runSync()} disabled={!!running}>
            <RefreshCw
              className={`h-4 w-4 ${running === "all" ? "animate-spin" : ""}`}
            />
            Sync all
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New sync
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {syncs.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                    {s.direction === "multi_way" ? "Multi-way" : "One-way"}
                  </span>
                  {!s.enabled && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted">
                      Paused
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.calendars.map((m) => (
                    <span
                      key={`${m.role}-${m.calendar.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: m.calendar.color }}
                      />
                      {m.calendar.name}
                      <span className="text-muted">· {m.role}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {s.includeTitle
                      ? `Titles${s.titleSuffix ? s.titleSuffix : ""}`
                      : `Title → “${s.customTitle || "Busy"}”`}
                  </span>
                  {s.markPrivate && <span>Private clones</span>}
                  {s.lastSyncedAt && (
                    <span>
                      Last sync {format(new Date(s.lastSyncedAt), "PPp")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runSync(s.id)}
                  disabled={running === s.id}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSync(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {syncs.length === 0 && (
          <Card className="p-10 text-center text-muted">
            No syncs yet. Create one to block busy time across calendars.
          </Card>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={createSync}
          >
            <h2 className="text-lg font-semibold">Create calendar sync</h2>

            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onChange={(e) =>
                  setForm((f) => ({ ...f, direction: e.target.value }))
                }
              >
                <option value="one_way">One-way (source → target)</option>
                <option value="multi_way">Multi-way (all peers)</option>
              </Select>
            </div>

            {form.direction === "one_way" ? (
              <>
                <div>
                  <Label>Source calendars</Label>
                  <div className="mt-2 space-y-1">
                    {calendars.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.sourceCalendarIds.includes(c.id)}
                          onChange={() =>
                            toggleId("sourceCalendarIds", c.id)
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Target calendars</Label>
                  <div className="mt-2 space-y-1">
                    {calendars.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.targetCalendarIds.includes(c.id)}
                          onChange={() =>
                            toggleId("targetCalendarIds", c.id)
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label>Peer calendars</Label>
                <div className="mt-2 space-y-1">
                  {calendars.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.peerCalendarIds.includes(c.id)}
                        onChange={() => toggleId("peerCalendarIds", c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Privacy
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.includeTitle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, includeTitle: e.target.checked }))
                  }
                />
                Include original event titles
              </label>
              {!form.includeTitle && (
                <div className="space-y-1">
                  <Label>Custom title for clones</Label>
                  <Input
                    value={form.customTitle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customTitle: e.target.value }))
                    }
                    placeholder="Busy"
                  />
                </div>
              )}
              {form.includeTitle && (
                <div className="space-y-1">
                  <Label>Title suffix (e.g. &quot; (Clone)&quot;)</Label>
                  <Input
                    value={form.titleSuffix}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, titleSuffix: e.target.value }))
                    }
                  />
                </div>
              )}
              {(
                [
                  ["includeDescription", "Include description"],
                  ["includeLocation", "Include location"],
                  ["includeAttendees", "Include attendees (in description)"],
                  ["includeConference", "Include conference links"],
                  ["markPrivate", "Mark clones as private"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form[key] as boolean}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create & sync</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
