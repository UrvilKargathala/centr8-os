"use client";

// HR admin backfill/correction — attendance:edit_any only. Pre-fillable
// for editing an existing row (PATCH /api/attendance/[id]) or blank for a
// brand-new manual entry (POST /api/attendance/manual).
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";

type ExistingRecord = {
  id: string;
  workDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  manualEntryReason: string | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManualEntryModal({
  orgId,
  employeeId,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  employeeId: string;
  existing?: ExistingRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [workDate, setWorkDate] = useState(existing?.workDate ?? new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState(toLocalInput(existing?.checkInTime ?? null));
  const [checkOut, setCheckOut] = useState(toLocalInput(existing?.checkOutTime ?? null));
  const [status, setStatus] = useState(existing?.status ?? "checked_out");
  const [reason, setReason] = useState(existing?.manualEntryReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required for a manual entry");
      return;
    }
    setSaving(true);
    setError(null);

    const res = existing
      ? await fetch(`/api/attendance/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_in_time: checkIn ? new Date(checkIn).toISOString() : null,
            check_out_time: checkOut ? new Date(checkOut).toISOString() : null,
            status,
            reason,
          }),
        })
      : await fetch("/api/attendance/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            work_date: workDate,
            check_in_time: checkIn ? new Date(checkIn).toISOString() : null,
            check_out_time: checkOut ? new Date(checkOut).toISOString() : null,
            status,
            reason,
          }),
        });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">{existing ? "Edit attendance record" : "Manual entry"}</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}

        <Field label="Date">
          <Input type="date" className="w-full" value={workDate} onChange={(e) => setWorkDate(e.target.value)} disabled={!!existing} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in">
            <Input type="datetime-local" className="w-full" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Check-out">
            <Input type="datetime-local" className="w-full" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Status">
          <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["checked_in", "checked_out", "half_day", "absent", "on_leave", "holiday"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason (required — kept as the audit trail)">
          <Textarea className="w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check in, backfilling from badge log" />
        </Field>

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !reason.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
