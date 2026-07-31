"use client";

// Shared month heatmap — used by both /hr/attendance (My Attendance view)
// and the Employee Detail Attendance tab. Color coding, per Batch 2 spec:
// success = full day, warning = half day/late, danger = absent, info = on
// leave, neutral = weekend, empty = future/pre-employment.
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

export type AttendanceRecord = {
  id: string;
  workDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalMinutes: number | null;
  status: string;
  location: string | null;
  checkInNote: string | null;
  checkOutNote: string | null;
};

export type AttendanceSettings = {
  workdayStartTime: string;
  minHoursForFullDay: number;
  weekendDays: string[];
  lateCheckinThresholdMinutes: number;
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function isLate(record: AttendanceRecord, settings: AttendanceSettings): boolean {
  if (!record.checkInTime) return false;
  const [h, m] = settings.workdayStartTime.split(":").map(Number);
  const threshold = new Date(`${record.workDate}T00:00:00`);
  threshold.setHours(h, m + settings.lateCheckinThresholdMinutes, 0, 0);
  return new Date(record.checkInTime) > threshold;
}

function cellColor(
  dateIso: string,
  record: AttendanceRecord | undefined,
  settings: AttendanceSettings,
  employmentStartDate: string | null,
): { color: string; empty: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  if (dateIso > today) return { color: "", empty: true };
  if (employmentStartDate && dateIso < employmentStartDate) return { color: "", empty: true };

  const dayName = DAY_NAMES[new Date(`${dateIso}T00:00:00`).getDay()];
  const isWeekend = settings.weekendDays.includes(dayName);

  if (record) {
    if (record.status === "on_leave") return { color: "bg-info-600", empty: false };
    if (record.status === "holiday") return { color: "bg-info-600", empty: false };
    if (record.status === "weekend") return { color: "bg-neutral-300", empty: false };
    const hours = (record.totalMinutes ?? 0) / 60;
    if (record.status === "checked_out" && hours >= settings.minHoursForFullDay && !isLate(record, settings)) {
      return { color: "bg-success-600", empty: false };
    }
    if (record.status === "checked_in" || record.status === "checked_out" || record.status === "half_day") {
      return { color: "bg-warning-600", empty: false };
    }
  }
  if (isWeekend) return { color: "bg-neutral-300", empty: false };
  return { color: "bg-danger-600", empty: false }; // weekday, no record = absent
}

export function AttendanceCalendar({
  month,
  onMonthChange,
  records,
  settings,
  employmentStartDate,
}: {
  month: Date; // any date within the target month
  onMonthChange: (m: Date) => void;
  records: AttendanceRecord[];
  settings: AttendanceSettings;
  employmentStartDate?: string | null;
}) {
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const byDate = new Map(records.map((r) => [r.workDate, r]));
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1);
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: (string | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  })];

  const dateList = cells.filter(Boolean) as string[];

  function focusOffset(dateIso: string, offset: number) {
    const idx = dateList.indexOf(dateIso);
    const next = dateList[idx + offset];
    if (next) cellRefs.current[next]?.focus();
  }

  function openDay(dateIso: string) {
    setSelectedDate(dateIso);
    setSelected(byDate.get(dateIso) ?? null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, mon - 1, 1))}
          className="rounded-sm px-2 py-1 text-small text-neutral-600 hover:bg-neutral-100"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-body-medium font-semibold text-neutral-950">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, mon + 1, 1))}
          className="rounded-sm px-2 py-1 text-small text-neutral-600 hover:bg-neutral-100"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-caption text-neutral-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateIso, i) => {
          if (!dateIso) return <div key={`blank-${i}`} />;
          const record = byDate.get(dateIso);
          const { color, empty } = cellColor(dateIso, record, settings, employmentStartDate ?? null);
          const dayNum = Number(dateIso.slice(-2));
          const title = record
            ? `${dateIso} — ${record.status.replace(/_/g, " ")}${record.checkInTime ? `, in ${new Date(record.checkInTime).toLocaleTimeString()}` : ""}${record.checkOutTime ? `, out ${new Date(record.checkOutTime).toLocaleTimeString()}` : ""}${record.totalMinutes != null ? `, ${(record.totalMinutes / 60).toFixed(1)}h` : ""}`
            : dateIso;
          return (
            <button
              key={dateIso}
              ref={(el) => {
                cellRefs.current[dateIso] = el;
              }}
              type="button"
              title={title}
              disabled={empty}
              onClick={() => openDay(dateIso)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); focusOffset(dateIso, 1); }
                if (e.key === "ArrowLeft") { e.preventDefault(); focusOffset(dateIso, -1); }
                if (e.key === "ArrowDown") { e.preventDefault(); focusOffset(dateIso, 7); }
                if (e.key === "ArrowUp") { e.preventDefault(); focusOffset(dateIso, -7); }
              }}
              className={`flex aspect-square flex-col items-center justify-center rounded-sm text-caption transition-opacity ${
                empty ? "cursor-default text-neutral-300" : "cursor-pointer text-neutral-50 hover:opacity-80 focus:outline focus:outline-2 focus:outline-primary-600"
              } ${!empty ? color : "border border-dashed border-neutral-200"}`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-caption text-neutral-600">
        <LegendDot color="bg-success-600" label="Full day" />
        <LegendDot color="bg-warning-600" label="Half day / late" />
        <LegendDot color="bg-danger-600" label="Absent" />
        <LegendDot color="bg-info-600" label="Leave / holiday" />
        <LegendDot color="bg-neutral-300" label="Weekend" />
      </div>

      {selectedDate && (
        <Modal onClose={() => setSelectedDate(null)} maxWidth="max-w-sm">
          <div className="space-y-3">
            <h3 className="text-h3 font-semibold text-neutral-950">{selectedDate}</h3>
            {selected ? (
              <dl className="space-y-1.5 text-body text-neutral-800">
                <div className="flex justify-between">
                  <dt>Status</dt>
                  <dd><Badge>{selected.status.replace(/_/g, " ")}</Badge></dd>
                </div>
                <div className="flex justify-between">
                  <dt>Check-in</dt>
                  <dd>{selected.checkInTime ? new Date(selected.checkInTime).toLocaleTimeString() : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Check-out</dt>
                  <dd>{selected.checkOutTime ? new Date(selected.checkOutTime).toLocaleTimeString() : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Total hours</dt>
                  <dd>{selected.totalMinutes != null ? (selected.totalMinutes / 60).toFixed(1) : "—"}</dd>
                </div>
                {selected.location && (
                  <div className="flex justify-between">
                    <dt>Location</dt>
                    <dd>{selected.location.replace(/_/g, " ")}</dd>
                  </div>
                )}
                {(selected.checkInNote || selected.checkOutNote) && (
                  <div>
                    <dt className="text-neutral-600">Notes</dt>
                    <dd>{[selected.checkInNote, selected.checkOutNote].filter(Boolean).join(" · ")}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-body text-neutral-600">No record for this day.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
