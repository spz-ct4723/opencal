"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";

type Slot = { start: string; end: string; label: string };
type Question = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export default function PublicBookingPage() {
  const params = useParams();
  const username = params.username as string;
  const slug = params.slug as string;

  const [link, setLink] = useState<{
    title: string;
    description: string | null;
    brandColor: string;
    allowGuests: boolean;
    requireApproval: boolean;
    locationType: string;
    questions: Question[];
    host: {
      name: string | null;
      username: string;
      bio: string | null;
      socialLinks: Record<string, string>;
    };
  } | null>(null);
  const [durations, setDurations] = useState<number[]>([30]);
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    status: string;
    startAt: string;
    confirmationMsg?: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestNotes: "",
    answers: {} as Record<string, string>,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(
        `/api/bookings/slots?username=${username}&slug=${slug}&duration=${duration}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Not found");
        setLoading(false);
        return;
      }
      setLink(data.link);
      setDurations(data.durations || [30]);
      setSlots(data.slots || []);
      // Server falls back to the link's first duration when ours isn't
      // offered — adopt it so the booking POST sends a valid duration.
      if (data.duration && data.duration !== duration) {
        setDuration(data.duration);
      }
      setLoading(false);
    }
    load();
  }, [username, slug, duration]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const day = format(parseISO(s.start), "yyyy-MM-dd");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return [...map.entries()];
  }, [slots]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        slug,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestNotes: form.guestNotes,
        startAt: selected.start,
        duration,
        answers: form.answers,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Booking failed");
      return;
    }
    if (data.booking.redirectUrl) {
      window.location.href = data.booking.redirectUrl;
      return;
    }
    setDone({
      status: data.booking.status,
      startAt: data.booking.startAt,
      confirmationMsg: data.booking.confirmationMsg,
    });
  }

  const color = link?.brandColor || "#4F46E5";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading availability…
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex min-h-screen items-center justify-center text-danger">
        {error || "Link not found"}
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ backgroundColor: color }}
          >
            ✓
          </div>
          <h1 className="text-xl font-semibold">
            {done.status === "pending" ? "Request sent" : "You're booked!"}
          </h1>
          <p className="mt-2 text-muted">
            {format(new Date(done.startAt), "PPPP · p")}
          </p>
          {done.confirmationMsg && (
            <p className="mt-4 text-sm">{done.confirmationMsg}</p>
          )}
          {done.status === "pending" && (
            <p className="mt-2 text-sm text-amber-700">
              The host will confirm your booking.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className="h-32 w-full"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}99)`,
        }}
      />
      <div className="mx-auto -mt-16 grid max-w-5xl gap-6 px-4 pb-16 md:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-border bg-white p-6 shadow-sm h-fit">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {(link.host.name || link.host.username)[0]?.toUpperCase()}
          </div>
          <div className="text-sm text-muted">{link.host.name}</div>
          <h1 className="text-xl font-semibold">{link.title}</h1>
          {link.description && (
            <p className="mt-2 text-sm text-slate-600">{link.description}</p>
          )}
          <div className="mt-4 space-y-1 text-sm text-muted">
            <div>{duration} minutes</div>
            <div className="capitalize">
              {link.locationType.replace("_", " ")}
            </div>
            {link.requireApproval && <div>Requires approval</div>}
          </div>
          {link.host.bio && (
            <p className="mt-4 border-t border-border pt-4 text-sm text-slate-600">
              {link.host.bio}
            </p>
          )}
          {Object.keys(link.host.socialLinks || {}).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(link.host.socialLinks).map(([k, v]) => (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-700 hover:bg-slate-200"
                >
                  {k}
                </a>
              ))}
            </div>
          )}
        </aside>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          {durations.length > 1 && (
            <div className="mb-4">
              <Label>Duration</Label>
              <div className="mt-2 flex gap-2">
                {durations.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDuration(d);
                      setSelected(null);
                    }}
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer"
                    style={
                      duration === d
                        ? {
                            borderColor: color,
                            backgroundColor: `${color}15`,
                            color,
                          }
                        : undefined
                    }
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
          )}

          {!selected ? (
            <div className="space-y-6">
              <h2 className="font-semibold">Select a time</h2>
              {byDay.length === 0 && (
                <p className="text-sm text-muted">
                  No open slots in the next few weeks.
                </p>
              )}
              {byDay.map(([day, daySlots]) => (
                <div key={day}>
                  <div className="mb-2 text-sm font-medium">
                    {format(parseISO(day), "EEEE, MMMM d")}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {daySlots.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => setSelected(s)}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-current cursor-pointer transition"
                        style={{ color }}
                      >
                        {format(parseISO(s.start), "h:mm a")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={book} className="space-y-4">
              <button
                type="button"
                className="text-sm text-muted hover:text-foreground cursor-pointer"
                onClick={() => setSelected(null)}
              >
                ← Back
              </button>
              <h2 className="text-lg font-semibold">
                {format(parseISO(selected.start), "PPPP · p")}
              </h2>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  required
                  value={form.guestName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, guestName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={form.guestEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, guestEmail: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  value={form.guestNotes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, guestNotes: e.target.value }))
                  }
                />
              </div>
              {link.questions.map((q) => (
                <div key={q.id} className="space-y-1">
                  <Label>
                    {q.label}
                    {q.required ? " *" : ""}
                  </Label>
                  {q.type === "textarea" ? (
                    <Textarea
                      required={q.required}
                      value={form.answers[q.id] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          answers: { ...f.answers, [q.id]: e.target.value },
                        }))
                      }
                    />
                  ) : q.type === "select" ? (
                    <Select
                      required={q.required}
                      value={form.answers[q.id] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          answers: { ...f.answers, [q.id]: e.target.value },
                        }))
                      }
                    >
                      <option value="">Select…</option>
                      {(q.options || []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      required={q.required}
                      value={form.answers[q.id] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          answers: { ...f.answers, [q.id]: e.target.value },
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                style={{ backgroundColor: color }}
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </form>
          )}
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted">
        Powered by{" "}
        <Link href="/" className="font-medium text-primary">
          OpenCal
        </Link>{" "}
        — open source
      </p>
    </div>
  );
}
