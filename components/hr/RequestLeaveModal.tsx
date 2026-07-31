"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";

type LeaveType = { id: string; name: string; color: string; isPaid: boolean; isActive: boolean; maxConsecutiveDays: number | null };
type Balance = { allottedDays: number; carriedForwardDays: number; usedDays: number; pendingDays: number } | null;
type BalanceEntry = { leave_type: LeaveType; balance: Balance };

function remaining(b: Balance): number {
  if (!b) return 0;
  return b.allottedDays + b.carriedForwardDays - b.usedDays - b.pendingDays;
}

function countWeekdaysClient(start: string, end: string): number {
  if (!start || !end) return 0;
  let count = 0;
  for (let d = new Date(`${start}T00:00:00`); d <= new Date(`${end}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++; // client-side estimate only — server recomputes with the real weekend_days config
  }
  return count;
}

export function RequestLeaveModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [singleDate, setSingleDate] = useState("");
  const [halfDayPeriod, setHalfDayPeriod] = useState<"morning" | "afternoon">("morning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState(0);
  const coverageAI = useAiCall<{ coverage_status: "good" | "risky"; overlapping_leave_count: number; reasoning: string }>("Monitor", "check_leave_coverage");

  useEffect(() => {
    Promise.all([
      fetch(`/api/leave/types?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/leave/my-balance?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
    ]).then(([typesBody, balanceBody, employeesBody]) => {
      const activeTypes = (typesBody.data ?? []).filter((t: LeaveType) => t.isActive);
      setTypes(activeTypes);
      setBalances(balanceBody.data ?? []);
      setTeamSize((employeesBody.data ?? []).length);
      if (activeTypes[0]) setLeaveTypeId(activeTypes[0].id);
    });
  }, [orgId]);

  const selectedType = types.find((t) => t.id === leaveTypeId);
  const selectedBalanceEntry = balances.find((b) => b.leave_type.id === leaveTypeId);
  const effectiveStart = isHalfDay ? singleDate : startDate;
  const effectiveEnd = isHalfDay ? singleDate : endDate;
  const requestedDays = isHalfDay ? (singleDate ? 0.5 : 0) : countWeekdaysClient(startDate, endDate);
  const remainingForType = remaining(selectedBalanceEntry?.balance ?? null);
  const exceedsBalance = Boolean(selectedType?.isPaid) && requestedDays > remainingForType;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !effectiveStart || !effectiveEnd) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/leave/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        leave_type_id: leaveTypeId,
        start_date: effectiveStart,
        end_date: effectiveEnd,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : undefined,
        reason: reason || undefined,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to submit request");
      return;
    }
    onCreated();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h2 font-semibold text-neutral-950">Request Leave</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

        <Field label="Leave type">
          <Select className="w-full" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-center gap-2.5 text-body text-neutral-950">
          <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} className="h-4 w-4 rounded-sm border-neutral-300 text-success-600 focus:outline focus:outline-2 focus:outline-success-600" />
          Half day
        </label>

        {isHalfDay ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <Input type="date" className="w-full" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
            </Field>
            <Field label="Period">
              <Select className="w-full" value={halfDayPeriod} onChange={(e) => setHalfDayPeriod(e.target.value as "morning" | "afternoon")}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
              </Select>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <Input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" className="w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Reason (optional)">
          <Textarea className="w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>

        {leaveTypeId && effectiveStart && (
          <div className={`rounded-md border-l-4 px-3 py-2 text-small ${exceedsBalance ? "border-danger-600 bg-danger-100 text-danger-600" : "border-info-600 bg-info-100 text-info-600"}`}>
            {selectedType?.isPaid ? (
              <>
                You have {remainingForType} day(s) remaining for {selectedType?.name} this year — this request uses {requestedDays} day(s).
                {exceedsBalance && " This exceeds your remaining balance."}
              </>
            ) : (
              <>{selectedType?.name} has no balance ceiling — this request uses {requestedDays} day(s).</>
            )}
          </div>
        )}

        <div>
          <AiButton
            label="AI: Check team coverage"
            loading={coverageAI.loading}
            onClick={async () => {
              // Real overlap count when the requester can see team-wide
              // leave (view_all); otherwise 0 known overlaps rather than a
              // fabricated number — the AI mock's job is to interpret the
              // count, not invent it.
              let overlapping = 0;
              if (effectiveStart && effectiveEnd) {
                try {
                  const res = await fetch(`/api/leave/team-calendar?org_id=${orgId}&start_date=${effectiveStart}&end_date=${effectiveEnd}`);
                  if (res.ok) overlapping = ((await res.json()).data ?? []).length;
                } catch {
                  // fall through with overlapping = 0
                }
              }
              coverageAI.run({ overlapping_leave_count: overlapping, team_size: teamSize });
            }}
          />
          {coverageAI.result && (
            <AiSuggestionCard onAccept={() => coverageAI.setResult(null)} onReject={() => coverageAI.setResult(null)}>
              <p className={`text-body ${coverageAI.result.coverage_status === "risky" ? "text-warning-600" : "text-neutral-800"}`}>{coverageAI.result.reasoning}</p>
            </AiSuggestionCard>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !leaveTypeId || !effectiveStart || !effectiveEnd || exceedsBalance}>
            {saving ? "Submitting…" : "Submit Request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
