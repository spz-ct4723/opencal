"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addWeeks,
  format,
  startOfWeek,
  subWeeks,
  addHours,
} from "date-fns";
import { WeekView, type CalEvent } from "@/components/calendar/week-view";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

type Calendar = {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
};

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [hideClones, setHideClones] = useState(true);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [creating, setCreating] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    calendarId: "",
    conferenceUrl: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const start = weekStart.toISOString();
    const end = addWeeks(weekStart, 1).toISOString();
    const res = await fetch(
      `/api/events?start=${start}&end=${end}&hideClones=${hideClones}`
    );
    const data = await res.json();
    setEvents(data.events || []);
    setCalendars(data.calendars || []);
    if (enabledIds.size === 0 && data.calendars?.length) {
      setEnabledIds(new Set(data.calendars.map((c: Calendar) => c.id)));
    }
    if (!form.calendarId && data.calendars?.[0]) {
      setForm((f) => ({ ...f, calendarId: data.calendars[0].id }));
    }
    setLoading(false);
  }, [weekStart, hideClones]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const visibleEvents = events.filter(
    (e) => !e.calendar || enabledIds.has(e.calendar.id)
  );

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!creating || !form.calendarId) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarId: form.calendarId,
        title: form.title || "Untitled",
        description: form.description,
        conferenceUrl: form.conferenceUrl || null,
        startAt: creating.toISOString(),
        endAt: addHours(creating, 1).toISOString(),
      }),
    });
    setCreating(null);
    setForm((f) => ({ ...f, title: "", description: "", conferenceUrl: "" }));
    load();
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  function toggleCal(id: string) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted">
            All your calendars in one place
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideClones((v) => !v)}
          >
            {hideClones ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {hideClones ? "Clones hidden" : "Showing clones"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))
              }
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="min-w-[140px] text-sm font-medium">
            {format(weekStart, "MMM d")} –{" "}
            {format(addWeeks(weekStart, 1), "MMM d, yyyy")}
          </span>
          <Button
            size="sm"
            onClick={() => setCreating(new Date())}
          >
            <Plus className="h-4 w-4" />
            Event
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar sidebar */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Calendars
          </div>
          <div className="space-y-1">
            {calendars.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={enabledIds.has(c.id)}
                  onChange={() => toggleCal(c.id)}
                  className="accent-primary"
                />
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate text-sm">{c.name}</span>
              </label>
            ))}
            {calendars.length === 0 && (
              <p className="text-xs text-muted">
                Connect accounts to see calendars.
              </p>
            )}
          </div>
          <p className="mt-6 text-xs text-muted leading-relaxed">
            ⟳ marks sync clones. Use “Clones hidden” to see only original
            events without duplicate busy blocks.
          </p>
        </aside>

        <div className="flex-1 p-4">
          <WeekView
            weekStart={weekStart}
            events={visibleEvents}
            onEventClick={setSelected}
            onSlotClick={(d) => {
              setCreating(d);
              setSelected(null);
            }}
          />
        </div>
      </div>

      {/* Event detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    selected.color || selected.calendar?.color || "#4F46E5",
                }}
              />
              <h3 className="text-lg font-semibold">{selected.title}</h3>
            </div>
            {selected.isClone && (
              <span className="mb-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-muted">
                Sync clone
              </span>
            )}
            <p className="text-sm text-muted">
              {format(new Date(selected.startAt), "PPpp")} –{" "}
              {format(new Date(selected.endAt), "p")}
            </p>
            {selected.calendar && (
              <p className="mt-1 text-sm">
                Calendar: {selected.calendar.name}
              </p>
            )}
            {selected.conferenceUrl && (
              <a
                href={selected.conferenceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
              >
                Join meeting →
              </a>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              {!selected.isClone && (
                <Button
                  variant="danger"
                  onClick={() => deleteEvent(selected.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCreating(null)}
        >
          <form
            className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={createEvent}
          >
            <h3 className="text-lg font-semibold">New event</h3>
            <p className="text-sm text-muted">
              {format(creating, "PPpp")} (1 hour)
            </p>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Meeting title"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Calendar</Label>
              <Select
                value={form.calendarId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, calendarId: e.target.value }))
                }
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
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
            <div className="space-y-1">
              <Label>Conference URL</Label>
              <Input
                value={form.conferenceUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, conferenceUrl: e.target.value }))
                }
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(null)}
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
