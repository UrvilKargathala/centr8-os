"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function AttendanceSettingsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canEdit = can("attendance", "edit_any");
  const { show: showToast } = useToast();

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [targetHours, setTargetHours] = useState("8.0");
  const [minFullDay, setMinFullDay] = useState("7.0");
  const [minHalfDay, setMinHalfDay] = useState("4.0");
  const [weekendDays, setWeekendDays] = useState<string[]>(["saturday", "sunday"]);
  const [requireLocation, setRequireLocation] = useState(false);
  const [requireNote, setRequireNote] = useState(false);
  const [threshold, setThreshold] = useState("15");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/attendance/settings?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const s = body.data;
        if (!s) return;
        setStartTime(s.workdayStartTime?.slice(0, 5) ?? "09:00");
        setEndTime(s.workdayEndTime?.slice(0, 5) ?? "18:00");
        setTargetHours(String(s.workdayHoursTarget ?? 8.0));
        setMinFullDay(String(s.minHoursForFullDay ?? 7.0));
        setMinHalfDay(String(s.minHoursForHalfDay ?? 4.0));
        setWeekendDays(s.weekendDays ?? ["saturday", "sunday"]);
        setRequireLocation(Boolean(s.requireLocation));
        setRequireNote(Boolean(s.requireNoteOnLateCheckin));
        setThreshold(String(s.lateCheckinThresholdMinutes ?? 15));
      })
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  function toggleWeekendDay(day: string) {
    setWeekendDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/attendance/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: selectedOrgId,
        workday_start_time: startTime,
        workday_end_time: endTime,
        workday_hours_target: Number(targetHours),
        min_hours_for_full_day: Number(minFullDay),
        min_hours_for_half_day: Number(minHalfDay),
        weekend_days: weekendDays,
        require_location: requireLocation,
        require_note_on_late_checkin: requireNote,
        late_checkin_threshold_minutes: Number(threshold),
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    showToast("Saved");
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!canEdit) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Attendance Settings</h1>
        <p className="mt-1 text-body text-neutral-600">Workday hours, weekend days, and check-in policy for this organization.</p>
      </div>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Workday start time">
              <Input type="time" className="w-full" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Workday end time">
              <Input type="time" className="w-full" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Target hours/day">
              <Input type="number" step="0.5" className="w-full" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} />
            </Field>
            <Field label="Min hours — full day">
              <Input type="number" step="0.5" className="w-full" value={minFullDay} onChange={(e) => setMinFullDay(e.target.value)} />
            </Field>
            <Field label="Min hours — half day">
              <Input type="number" step="0.5" className="w-full" value={minHalfDay} onChange={(e) => setMinHalfDay(e.target.value)} />
            </Field>
          </div>

          <Field label="Weekend days">
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = weekendDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleWeekendDay(d)}
                    className={`rounded-full px-3 py-1 text-small capitalize ${
                      on ? "bg-success-100 text-success-600 outline outline-1 outline-success-600" : "bg-neutral-100 text-neutral-600 outline outline-1 outline-neutral-300"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>

          <label className="flex items-center gap-2.5 text-body text-neutral-950">
            <input type="checkbox" checked={requireLocation} onChange={(e) => setRequireLocation(e.target.checked)} className="h-4 w-4 rounded-sm border-neutral-300 text-success-600 focus:outline focus:outline-2 focus:outline-success-600" />
            Require location on check-in
          </label>
          <label className="flex items-center gap-2.5 text-body text-neutral-950">
            <input type="checkbox" checked={requireNote} onChange={(e) => setRequireNote(e.target.checked)} className="h-4 w-4 rounded-sm border-neutral-300 text-success-600 focus:outline focus:outline-2 focus:outline-success-600" />
            Require note on late check-in
          </label>

          <Field label="Late check-in threshold (minutes)">
            <Input type="number" className="w-full max-w-xs" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>

          <div className="flex justify-end border-t border-neutral-200 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
