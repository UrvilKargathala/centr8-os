"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { PageSkeleton } from "@/components/ui/skeleton";

type KeyResultStatus = "on_track" | "at_risk" | "off_track" | "completed";
type KeyResult = { title: string; status: KeyResultStatus };
type Okr = {
  id: string;
  employeeId: string | null;
  teamName: string | null;
  objective: string;
  keyResults: KeyResult[];
  period: string;
  status: "active" | "completed" | "archived";
};
type Employee = { id: string; fullName: string };

const KR_STATUS_COLOR: Record<KeyResultStatus, "success" | "warning" | "danger" | "info"> = {
  on_track: "info",
  at_risk: "warning",
  off_track: "danger",
  completed: "success",
};
const OKR_STATUS_COLOR: Record<string, "success" | "info" | "neutral"> = {
  active: "info",
  completed: "success",
  archived: "neutral",
};

function progressPct(keyResults: KeyResult[]) {
  if (keyResults.length === 0) return 0;
  return Math.round((keyResults.filter((k) => k.status === "completed").length / keyResults.length) * 100);
}

export default function OkrsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canViewTeam = can("okr", "view_team") || can("okr", "view_all");
  const [tab, setTab] = useState<"my" | "team">("my");
  const [showNew, setShowNew] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">OKRs</h1>
          <p className="mt-1 text-body text-neutral-600">Objectives and key results, tracked by cycle</p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ New OKR</Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        <button onClick={() => setTab("my")} className={`shrink-0 px-4 py-2 text-body-medium font-medium ${tab === "my" ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"}`}>
          My OKRs
        </button>
        {canViewTeam && (
          <button onClick={() => setTab("team")} className={`shrink-0 px-4 py-2 text-body-medium font-medium ${tab === "team" ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"}`}>
            Team OKRs
          </button>
        )}
      </div>

      <OkrList orgId={selectedOrgId} scope={tab} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />

      {showNew && (
        <NewOkrModal
          orgId={selectedOrgId}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function OkrList({ orgId, scope, refreshKey, onChanged }: { orgId: string; scope: "my" | "team"; refreshKey: number; onChanged: () => void }) {
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [ownEmployeeId, setOwnEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()).then((b) => setEmployees(b.data ?? []));
    fetch(`/api/employees?org_id=${orgId}&mine=true`)
      .then((r) => r.json())
      .then((b) => setOwnEmployeeId(b.data?.[0]?.id ?? null));
  }, [orgId]);

  function load() {
    setLoading(true);
    // scope="my" filters to the caller's own employeeId; scope="team" omits
    // employee_id entirely and lets the GET route's view_all/view_team
    // tiering decide the broader set (app/api/okrs/route.ts).
    const params = new URLSearchParams({ org_id: orgId });
    if (scope === "my" && ownEmployeeId) params.set("employee_id", ownEmployeeId);
    fetch(`/api/okrs?${params}`)
      .then((r) => r.json())
      .then((b) => setOkrs(b.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId, scope, refreshKey, ownEmployeeId]);

  if (loading) return <PageSkeleton variant="table" />;
  if (okrs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No OKRs yet</EmptyTitle>
          <EmptyDescription>Set an objective and a few key results to track progress.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {okrs.map((o) => (
        <OkrCard key={o.id} okr={o} employeeName={employees.find((e) => e.id === o.employeeId)?.fullName} onChanged={onChanged} />
      ))}
    </div>
  );
}

function OkrCard({ okr, employeeName, onChanged }: { okr: Okr; employeeName?: string; onChanged: () => void }) {
  const [keyResults, setKeyResults] = useState(okr.keyResults);
  const pct = progressPct(keyResults);

  async function updateKr(index: number, status: KeyResultStatus) {
    const next = keyResults.map((k, i) => (i === index ? { ...k, status } : k));
    setKeyResults(next);
    await fetch(`/api/okrs/${okr.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_results: next }) });
    onChanged();
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-body-medium font-semibold text-neutral-950">{okr.objective}</p>
          <p className="text-caption text-neutral-500">{employeeName ?? okr.teamName ?? "—"} · {okr.period}</p>
        </div>
        <Badge color={OKR_STATUS_COLOR[okr.status] ?? "neutral"}>{okr.status}</Badge>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-success-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-caption text-neutral-500">{pct}% complete</p>
      <div className="space-y-1.5">
        {keyResults.map((kr, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-sm bg-neutral-100 px-2 py-1.5">
            <span className="text-body text-neutral-800">{kr.title}</span>
            <Select className="w-36" value={kr.status} onChange={(e) => updateKr(i, e.target.value as KeyResultStatus)}>
              <option value="on_track">On track</option>
              <option value="at_risk">At risk</option>
              <option value="off_track">Off track</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keyResults.map((kr, i) => (
          <Badge key={i} color={KR_STATUS_COLOR[kr.status]}>{kr.status.replace(/_/g, " ")}</Badge>
        ))}
      </div>
    </Card>
  );
}

function NewOkrModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [objective, setObjective] = useState("");
  const [period, setPeriod] = useState("");
  const [keyResults, setKeyResults] = useState<KeyResult[]>([{ title: "", status: "on_track" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestAI = useAiCall<{ key_results: string[]; reasoning: string }>("Planner", "suggest_key_results");

  function addKr() {
    setKeyResults([...keyResults, { title: "", status: "on_track" }]);
  }
  function updateKrTitle(i: number, title: string) {
    setKeyResults(keyResults.map((k, idx) => (idx === i ? { ...k, title } : k)));
  }
  function removeKr(i: number) {
    setKeyResults(keyResults.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim() || !period.trim()) return;
    setSaving(true);
    setError(null);
    const mine = await fetch(`/api/employees?org_id=${orgId}&mine=true`).then((r) => r.json());
    const ownEmployeeId: string | undefined = mine.data?.[0]?.id;
    const res = await fetch("/api/okrs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        objective,
        period,
        key_results: keyResults.filter((k) => k.title.trim()),
        employee_id: ownEmployeeId,
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
        <h3 className="text-h3 font-semibold text-neutral-950">New OKR</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Objective">
          <Input className="w-full" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. Grow revenue this quarter" autoFocus />
        </Field>
        <Field label="Period">
          <Input className="w-full" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. Q1 2027" />
        </Field>
        <AiButton label="Suggest key results" loading={suggestAI.loading} onClick={() => suggestAI.run({ objective })} />
        {suggestAI.result && (
          <AiSuggestionCard
            reasoning={suggestAI.result.reasoning}
            onAccept={() => {
              setKeyResults(suggestAI.result!.key_results.map((title) => ({ title, status: "on_track" as KeyResultStatus })));
              suggestAI.setResult(null);
            }}
            onReject={() => suggestAI.setResult(null)}
          >
            <ul className="list-disc pl-4 text-body text-neutral-700">
              {suggestAI.result.key_results.map((kr, i) => (
                <li key={i}>{kr}</li>
              ))}
            </ul>
          </AiSuggestionCard>
        )}
        <div className="space-y-2">
          <p className="text-body-medium font-medium text-neutral-800">Key results</p>
          {keyResults.map((kr, i) => (
            <div key={i} className="flex gap-2">
              <Input className="w-full" value={kr.title} onChange={(e) => updateKrTitle(i, e.target.value)} placeholder="Key result" />
              <Button type="button" variant="secondary" onClick={() => removeKr(i)}>×</Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addKr}>+ Add key result</Button>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !objective.trim() || !period.trim()}>{saving ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
