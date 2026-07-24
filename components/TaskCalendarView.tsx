"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cardAccentClass, taskPriorityColor } from "@/components/ui/Badge";
import type { Task } from "@/components/TaskCard";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local-date formatting, not `.toISOString()` — that converts to UTC first,
// which shifts the date by a day in any timezone behind UTC (a local
// midnight `new Date(y, m, d)` becomes the previous day once converted).
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Month grid plotting tasks on their dueDate — only tasks with a due date
// set show up here (most won't, since due dates are optional and new on
// this table). Not a full scheduling calendar, just a due-date-by-day view.
export function TaskCalendarView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (taskId: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const list = byDate.get(t.dueDate) ?? [];
    list.push(t);
    byDate.set(t.dueDate, list);
  }

  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const todayIso = toIsoDate(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-h3 font-semibold text-neutral-950">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ← Prev
          </Button>
          <Button variant="secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            Next →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-300 bg-neutral-300">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="bg-neutral-100 px-2 py-1.5 text-center text-caption font-medium uppercase tracking-wide text-neutral-500">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-24 bg-neutral-50" />;
          const iso = toIsoDate(date);
          const dayTasks = byDate.get(iso) ?? [];
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
