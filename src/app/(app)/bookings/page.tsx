"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

type Booking = {
  id: string;
  guestName: string;
  guestEmail: string;
  startAt: string;
  endAt: string;
  status: string;
  duration: number;
  guestNotes: string | null;
  schedulingLink: { title: string; slug: string };
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  async function load() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data.bookings || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  const upcoming = bookings.filter(
    (b) => new Date(b.startAt) >= new Date() && b.status !== "cancelled"
  );
  const past = bookings.filter(
    (b) => new Date(b.startAt) < new Date() || b.status === "cancelled"
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-muted">
          Approve, cancel, or review meetings booked through your scheduling
          links.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Upcoming
        </h2>
        {upcoming.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            No upcoming bookings
          </Card>
        )}
        {upcoming.map((b) => (
          <Card key={b.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{b.guestName}</div>
                <div className="text-sm text-muted">{b.guestEmail}</div>
                <div className="mt-2 text-sm">
                  {format(new Date(b.startAt), "PPp")} · {b.duration} min
                </div>
                <div className="mt-1 text-xs text-muted">
                  via {b.schedulingLink.title}
                </div>
                {b.guestNotes && (
                  <p className="mt-2 text-sm text-slate-600">{b.guestNotes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={b.status} />
                <div className="flex gap-2">
                  {b.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setStatus(b.id, "confirmed")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(b.id, "declined")}
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {b.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(b.id, "cancelled")}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Past / cancelled
          </h2>
          {past.map((b) => (
            <Card key={b.id} className="p-4 opacity-70">
              <div className="flex justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{b.guestName}</span>
                  <span className="text-muted">
                    {" "}
                    · {format(new Date(b.startAt), "PP")}
                  </span>
                </div>
                <StatusBadge status={b.status} />
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    cancelled: "bg-slate-100 text-slate-600",
    declined: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] || colors.pending}`}
    >
      {status}
    </span>
  );
}
