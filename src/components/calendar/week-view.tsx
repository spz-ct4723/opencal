"use client";

import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
  differenceInMinutes,
  setHours,
  startOfDay,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";

export type CalEvent = {
  id: string;
  title: string;
  startAt: string | Date;
  endAt: string | Date;
  allDay?: boolean;
  isClone?: boolean;
  conferenceUrl?: string | null;
  color?: string | null;
  calendar?: { id: string; name: string; color: string };
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 56;

export function WeekView({
  weekStart,
  events,
  onEventClick,
  onSlotClick,
}: {
  weekStart?: Date;
  events: CalEvent[];
  onEventClick?: (e: CalEvent) => void;
  onSlotClick?: (date: Date) => void;
}) {
  const start = startOfWeek(weekStart ?? new Date(), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border">
        <div className="border-r border-border" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "border-r border-border px-2 py-3 text-center last:border-r-0",
              isToday(d) && "bg-accent/50"
            )}
          >
            <div className="text-xs font-medium uppercase text-muted">
              {format(d, "EEE")}
            </div>
            <div
              className={cn(
                "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                isToday(d) && "bg-primary text-white"
              )}
            >
              {format(d, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      {allDay.length > 0 && (
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-slate-50/50">
          <div className="flex items-center justify-center border-r border-border px-1 text-[10px] text-muted">
            all-day
          </div>
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="min-h-[36px] space-y-0.5 border-r border-border p-1 last:border-r-0"
            >
              {allDay
                .filter((e) => isSameDay(new Date(e.startAt), d))
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick?.(e)}
                    className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white cursor-pointer"
                    style={{
                      backgroundColor:
                        e.color || e.calendar?.color || "#4F46E5",
                    }}
                  >
                    {e.isClone ? "⟳ " : ""}
                    {e.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="grid grid-cols-[64px_repeat(7,1fr)] relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
        >
          {/* Hour labels + lines */}
          <div className="relative border-r border-border">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {h === 0
                  ? ""
                  : format(setHours(startOfDay(new Date()), h), "h a")}
              </div>
            ))}
          </div>

          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="relative border-r border-border last:border-r-0"
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="cal-hour-line absolute w-full cursor-pointer hover:bg-accent/30"
                  style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  onClick={() =>
                    onSlotClick?.(setHours(startOfDay(d), h))
                  }
                />
              ))}

              {timed
                .filter((e) => isSameDay(new Date(e.startAt), d))
                .map((e) => {
                  const start = new Date(e.startAt);
                  const end = new Date(e.endAt);
                  const top =
                    (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
                  const mins = Math.max(differenceInMinutes(end, start), 20);
                  const height = (mins / 60) * HOUR_HEIGHT;
                  const color = e.color || e.calendar?.color || "#4F46E5";
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick?.(e);
                      }}
                      className={cn(
                        "absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left shadow-sm cursor-pointer transition hover:brightness-95",
                        e.isClone && "opacity-80"
                      )}
                      style={{
                        top,
                        height: Math.max(height - 2, 18),
                        backgroundColor: `${color}22`,
                        borderLeftColor: color,
                      }}
                    >
                      <div
                        className="truncate text-[11px] font-semibold"
                        style={{ color }}
                      >
                        {e.isClone ? "⟳ " : ""}
                        {e.title}
                      </div>
                      {height > 32 && (
                        <div className="truncate text-[10px] text-muted">
                          {format(start, "h:mm a")}
                          {e.conferenceUrl ? " · Join" : ""}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
