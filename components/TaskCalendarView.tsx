"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cardAccentClass, taskPriorityColor } from "@/components/ui/Badge";
import type { Task } from "@/components/TaskCard";
import { mockZoom } from "@/lib/mock/communication";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local-date formatting, not `.toISOString()` — that converts to UTC first,
// which shifts the date by a day in any timezone behind UTC (a local
// midnight `new Date(y, m, d)` becomes the previous day once converted).
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type MeetingPill = { id: string; title: string; iso: string; time: string; kind: "upcoming" | "past" };

// Month grid plotting tasks on due-date + meetings on start-date. Meetings
// come from the Communication mock (mockZoom.upcoming/past) and render as
// ai-purple pills so they read as a different class from task pills.
export function TaskCalendarView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (taskId: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showMeetings, setShowMeetings] = useState(true);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const list = tasksByDate.get(t.dueDate) ?? [];
    list.push(t);
    tasksByDate.set(t.dueDate, list);
  }

  const meetingsByDate = new Map<string, MeetingPill[]>();
  if (showMeetings) {
    const allMeetings: MeetingPill[] = [
      ...mockZoom.upcoming.map((m) => {
        const d = new Date(m.start_time);
        return {
          id: m.id,
          title: m.title,
          iso: toIsoDate(d),
          time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          kind: "upcoming" as const,
        };
      }),
      ...mockZoom.past.map((m) => {
        const d = new Date(m.start_time);
        return {
          id: m.id,
          title: m.title,
          iso: toIsoDate(d),
          time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          kind: "past" as const,
        };
      }),
    ];
    for (const m of allMeetings) {
      const list = meetingsByDate.get(m.iso) ?? [];
      list.push(m);
      meetingsByDate.set(m.iso, list);
    }
  }

  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const todayIso = toIsoDate(new Date());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h3 font-semibold text-neutral-950">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-caption text-neutral-600">
            <input type="checkbox" checked={showMeetings} onChange={(e) => setShowMeetings(e.target.checked)} />
            Show meetings
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}>← Prev</Button>
            <Button variant="secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}>Next →</Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-caption text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-neutral-400" />
          Task due
        </span>
        {showMeetings && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-ai-600" />
              Upcoming meeting
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-neutral-300" />
              Past meeting
            </span>
          </>
        )}
      </div>

      <div className="glass-table grid grid-cols-7 gap-px bg-neutral-300">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="bg-neutral-100 px-2 py-1.5 text-center text-caption font-medium uppercase tracking-wide text-neutral-500">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-24 bg-neutral-50" />;
          const iso = toIsoDate(date);
          const dayTasks = tasksByDate.get(iso) ?? [];
          const dayMeetings = meetingsByDate.get(iso) ?? [];
          const isToday = iso === todayIso;
          return (
            <div key={i} className="min-h-24 space-y-1 bg-neutral-50 p-1.5">
              <span className={`text-caption ${isToday ? "font-semibold text-primary-700" : "text-neutral-500"}`}>{date.getDate()}</span>
              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTaskClick(t.id)}
                  className={`block w-full truncate rounded-sm bg-neutral-100 px-1.5 py-1 text-left text-caption text-neutral-800 hover:bg-neutral-200 ${cardAccentClass(taskPriorityColor(t.priority))}`}
                  title={t.title}
                >
                  {t.title}
                </button>
              ))}
              {dayMeetings.map((m) => (
                <a
                  key={m.id}
                  href="/communication/video"
                  className={`flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-1 text-caption ${
                    m.kind === "upcoming"
                      ? "bg-ai-100 text-ai-600 hover:bg-ai-100/70"
                      : "bg-neutral-100 text-neutral-500 opacity-70 hover:bg-neutral-200 hover:opacity-100"
                  }`}
                  title={`${m.time} · ${m.title}`}
                >
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
                  </svg>
                  <span className="truncate">
                    <span className="font-medium">{m.time}</span> {m.title}
                  </span>
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
