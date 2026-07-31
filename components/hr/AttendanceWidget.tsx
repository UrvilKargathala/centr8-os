"use client";

// HR Batch 2, Part 3 — small persistent check-in/out widget in the top
// bar. Reads GET /api/attendance/today on mount + window focus (no
// polling, per spec). Only rendered for a caller with attendance:record_own.
import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Select, Field, Textarea } from "@/components/ui/Input";

type AttendanceRecord = {
  id: string;
  workDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalMinutes: number | null;
  status: string;
};

function fmtDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export function AttendanceWidget() {
  const { selectedOrgId, can } = useOrg();
  const [record, setRecord] = useState<AttendanceRecord | null | undefined>(undefined); // undefined = loading
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canRecordOwn = can("attendance", "record_own");

  function load() {
    if (!selectedOrgId) return;
    fetch(`/api/attendance/today?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setRecord(body.data ?? null))
      .catch(() => setRecord(null));
  }

  useEffect(load, [selectedOrgId]);
  useEffect(() => {
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  // Live timer — only actually ticking matters in State B; setInterval
  // is cheap enough to just always run while checked in, cleared on unmount.
  useEffect(() => {
    if (!record?.checkInTime || record.checkOutTime) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [record?.checkInTime, record?.checkOutTime]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!canRecordOwn || !selectedOrgId || record === undefined) return null;

  const state: "A" | "B" | "C" | "D" =
    record && ["on_leave", "holiday", "weekend"].includes(record.status)
      ? "D"
      : record?.checkInTime && !record.checkOutTime
      ? "B"
      : record?.checkOutTime
      ? "C"
      : "A";

  const dotColor = { A: "bg-success-600", B: "bg-warning-600 animate-pulse", C: "bg-neutral-400", D: "bg-info-600" }[state];
  const label =
    state === "A"
      ? "Check in"
      : state === "B"
      ? fmtDuration(now - new Date(record!.checkInTime!).getTime())
      : state === "C"
      ? `Done today — ${record?.totalMinutes != null ? fmtDuration(record.totalMinutes * 60000) : "—"}`
      : record?.status === "weekend"
      ? "Weekend"
      : record?.status === "holiday"
      ? "Holiday"
      : "On leave";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={state === "D"}
        className={`flex h-9 items-center gap-2 rounded-full border px-3 text-small font-medium transition-colors ${
          state === "C" || state === "D"
            ? "border-neutral-300 bg-neutral-100 text-neutral-600"
            : "border-success-600 bg-neutral-50 text-neutral-950 hover:bg-success-100"
        } ${state === "D" ? "cursor-default" : ""}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
        <span className="whitespace-nowrap">{label}</span>
      </button>

      {open && state !== "D" && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-neutral-300 bg-neutral-50 p-4 shadow-lg">
          {state === "A" && <CheckInForm orgId={selectedOrgId} onDone={() => { setOpen(false); load(); }} />}
          {state === "B" && <CheckOutForm orgId={selectedOrgId} record={record!} onDone={() => { setOpen(false); load(); }} />}
          {state === "C" && <TodaySummary record={record!} />}
        </div>
      )}
    </div>
  );
}

function CheckInForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/attendance/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, note: note || undefined, location: location || undefined }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to check in");
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-3">
      <p className="text-body-medium font-semibold text-neutral-950">Check in</p>
      {error && <p className="rounded-md bg-danger-100 p-2 text-caption text-danger-600">{error}</p>}
      <Field label="Location">
        <Select className="w-full" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">Not specified</option>
          <option value="office">Office</option>
          <option value="remote">Remote</option>
          <option value="client_site">Client Site</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Note (optional)">
        <Textarea className="w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button className="w-full" onClick={submit} disabled={saving}>
        {saving ? "Checking in…" : "Check In"}
      </Button>
    </div>
  );
}

function CheckOutForm({ orgId, record, onDone }: { orgId: string; record: AttendanceRecord; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/attendance/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, note: note || undefined }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to check out");
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-3">
      <p className="text-body-medium font-semibold text-neutral-950">Checked in</p>
      <p className="text-caption text-neutral-600">
        Since {new Date(record.checkInTime!).toLocaleTimeString()} · {fmtDuration(now - new Date(record.checkInTime!).getTime())} so far
      </p>
      {error && <p className="rounded-md bg-danger-100 p-2 text-caption text-danger-600">{error}</p>}
      <Field label="Note (optional)">
        <Textarea className="w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button className="w-full" variant="secondary" onClick={submit} disabled={saving}>
        {saving ? "Checking out…" : "Check Out"}
      </Button>
    </div>
  );
}

function TodaySummary({ record }: { record: AttendanceRecord }) {
  return (
    <div className="space-y-2">
      <p className="text-body-medium font-semibold text-neutral-950">Today&apos;s summary</p>
      <dl className="space-y-1 text-caption text-neutral-700">
        <div className="flex justify-between">
          <dt>Check-in</dt>
          <dd>{new Date(record.checkInTime!).toLocaleTimeString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Check-out</dt>
          <dd>{new Date(record.checkOutTime!).toLocaleTimeString()}</dd>
        </div>
        <div className="flex justify-between font-medium text-neutral-950">
          <dt>Total</dt>
          <dd>{record.totalMinutes != null ? fmtDuration(record.totalMinutes * 60000) : "—"}</dd>
        </div>
      </dl>
      <a href="/hr/attendance" className="block text-small font-medium text-primary-700 hover:underline">
        View history →
      </a>
      {/* TODO: allow_multiple_checkins org setting would let a checked-out
          employee check in again today (e.g. clock back in after lunch) —
          skipped for this batch, single check-in/out pair per day only. */}
    </div>
  );
}
