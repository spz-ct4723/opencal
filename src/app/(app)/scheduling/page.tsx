"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";

type Link = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durations: string;
  enabled: boolean;
  brandColor: string | null;
  locationType: string;
  requireApproval: boolean;
  hostUserIds: string;
  _count?: { bookings: number };
};

export default function SchedulingPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [username, setUsername] = useState("demo");
  const [showCreate, setShowCreate] = useState(false);
  const [calendars, setCalendars] = useState<{ id: string; name: string }[]>(
    []
  );
  const [form, setForm] = useState({
    title: "30-Minute Meeting",
    slug: "30min",
    description: "",
    duration: 30,
    locationType: "google_meet",
    targetCalendarId: "",
    requireApproval: false,
    bufferBefore: 0,
    bufferAfter: 0,
  });

  async function load() {
    const [l, e, me] = await Promise.all([
      fetch("/api/scheduling").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
    ]);
    setLinks(l.links || []);
    setCalendars(e.calendars || []);
    if (me?.user?.username) setUsername(me.user.username);
    if (e.calendars?.[0] && !form.targetCalendarId) {
      setForm((f) => ({ ...f, targetCalendarId: e.calendars[0].id }));
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/scheduling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        slug: form.slug,
        description: form.description,
        durations: [form.duration],
        locationType: form.locationType,
        targetCalendarId: form.targetCalendarId || null,
        requireApproval: form.requireApproval,
        bufferBefore: form.bufferBefore,
        bufferAfter: form.bufferAfter,
      }),
    });
    setShowCreate(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this scheduling link?")) return;
    await fetch(`/api/scheduling?id=${id}`, { method: "DELETE" });
    load();
  }

  function copyUrl(slug: string) {
    const url = `${window.location.origin}/book/${username}/${slug}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Scheduling Links</h1>
          <p className="mt-1 text-sm text-muted">
            Individual and collective booking pages that respect availability
            across every connected calendar.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New link
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {links.map((link) => {
          const durations = JSON.parse(link.durations || "[30]") as number[];
          const hosts = JSON.parse(link.hostUserIds || "[]") as string[];
          const url = `/book/${username}/${link.slug}`;
          return (
            <Card key={link.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: link.brandColor || "#4F46E5",
                      }}
                    />
                    <h3 className="font-semibold">{link.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted line-clamp-2">
                    {link.description || "No description"}
                  </p>
                </div>
                {!link.enabled && (
                  <span className="text-xs text-muted">Disabled</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {durations.join(" / ")} min
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {link.locationType.replace("_", " ")}
                </span>
                {hosts.length > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                    Collective
                  </span>
                )}
                {link.requireApproval && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                    Approval
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {link._count?.bookings ?? 0} bookings
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyUrl(link.slug)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <a href={url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(link.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
              <code className="mt-3 block truncate rounded bg-slate-50 px-2 py-1 text-xs text-muted">
                {url}
              </code>
            </Card>
          );
        })}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={create}
          >
            <h2 className="text-lg font-semibold">New scheduling link</h2>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Duration (min)</Label>
                <Select
                  value={String(form.duration)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      duration: Number(e.target.value),
                    }))
                  }
                >
                  {[15, 30, 45, 60].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Select
                  value={form.locationType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, locationType: e.target.value }))
                  }
                >
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="phone">Phone</option>
                  <option value="in_person">In person</option>
                  <option value="custom">Custom</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Target calendar</Label>
              <Select
                value={form.targetCalendarId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetCalendarId: e.target.value,
                  }))
                }
              >
                <option value="">—</option>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.requireApproval}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    requireApproval: e.target.checked,
                  }))
                }
              />
              Require booking approval
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
