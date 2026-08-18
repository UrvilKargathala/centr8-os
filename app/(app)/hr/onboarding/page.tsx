"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/ui/Pagination";

type Step = {
  step_id: string;
  title: string;
  description: string;
  category: string;
  owner_role: string;
  days_after_start: number;
  status?: string;
};
type Workflow = { id: string; employeeId: string; steps: Step[]; status: string };
type Template = { id: string; orgId: string | null; name: string; structure: { description?: string; steps?: Step[] } };
type Employee = { id: string; fullName: string };

const TABS = ["Active Onboarding", "Templates"] as const;
type Tab = (typeof TABS)[number];

export default function OnboardingManagementPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [tab, setTab] = useState<Tab>("Active Onboarding");

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Onboarding</h1>

      <div className="flex gap-1 border-b border-neutral-300">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Active Onboarding" && <ActiveOnboardingTab orgId={selectedOrgId} />}
      {tab === "Templates" && <TemplatesTab orgId={selectedOrgId} canConfigure={can("onboarding", "configure")} />}
    </div>
  );
}

function ActiveOnboardingTab({ orgId }: { orgId: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/onboarding/workflows?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([wfBody, empBody]) => {
        if (wfBody.error) throw new Error(wfBody.error);
        setWorkflows((wfBody.data ?? []).filter((w: Workflow) => w.status !== "complete"));
        setEmployees(empBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load onboarding workflows"))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return <SectionSkeleton variant="list" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  if (workflows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </EmptyMedia>
          <EmptyTitle>No active onboarding</EmptyTitle>
          <EmptyDescription>Assign a template to a new employee from their profile to start one.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? "Unknown";
  const { page, setPage, pageSize, total, paged: pagedWorkflows } = usePagination(workflows, 10);

  return (
    <Card padding="sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedWorkflows.map((w) => {
            const done = w.steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
            const pct = w.steps.length ? Math.round((done / w.steps.length) * 100) : 0;
            return (
              <TableRow key={w.id}>
                <TableCell>
                  <a href={`/hr/employees/${w.employeeId}`} className="font-medium text-neutral-950 hover:underline">
                    {employeeName(w.employeeId)}
                  </a>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-32 bar-track overflow-hidden rounded-full bg-neutral-200">
                      <div className="h-full rounded-full bg-success-600" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-caption text-neutral-600">
                      {done}/{w.steps.length}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge color={w.status === "in_progress" ? "info" : "neutral"}>{w.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell>
                  <a href={`/hr/employees/${w.employeeId}?tab=Onboarding`} className="text-small font-medium text-primary-700 hover:underline">
                    View
                  </a>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </Card>
  );
}

function TemplatesTab({ orgId, canConfigure }: { orgId: string; canConfigure: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/onboarding/templates?org_id=${orgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load templates");
        setTemplates(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load templates"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId]);

  if (loading) return <SectionSkeleton variant="list" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-4">
      {canConfigure && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>+ New Template</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-h3 font-semibold text-neutral-950">{t.name}</h3>
              {!t.orgId && <Badge color="neutral">Built-in</Badge>}
            </div>
            <p className="text-small text-neutral-600">{t.structure.description ?? ""}</p>
            <p className="text-caption text-neutral-500">{(t.structure.steps ?? []).length} steps</p>
            {canConfigure && t.orgId && (
              <Button variant="secondary" onClick={() => setEditing(t)}>
                Edit
              </Button>
            )}
          </Card>
        ))}
      </div>

      {editing && (
        <TemplateEditorModal
          orgId={orgId}
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TemplateEditorModal({
  orgId,
  template,
  onClose,
  onSaved,
}: {
  orgId: string;
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.structure.description ?? "");
  const [role, setRole] = useState("");
  const [steps, setSteps] = useState<Step[]>(template?.structure.steps ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateAI = useAiCall<{ steps: Omit<Step, "step_id">[]; reasoning: string }>("Planner", "generate_onboarding_steps");

  function addStep() {
    setSteps((s) => [...s, { step_id: `s${Date.now()}`, title: "", description: "", category: "setup", owner_role: "HR", days_after_start: 0 }]);
  }
  function updateStep(i: number, p: Partial<Step>) {
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...p } : st)));
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }
  // Manual up/down reordering rather than HTML5 drag-and-drop or a DnD
  // library — no drag library is installed in this app, and up/down
  // buttons cover "reorderable steps" without adding a dependency.
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((s) => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    setError(null);
    const structure = { description, steps };
    const res = template
      ? await fetch(`/api/onboarding/templates/${template.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, structure }),
        })
      : await fetch("/api/onboarding/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: orgId, name, structure }),
        });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save template");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-h2 font-semibold text-neutral-950">{template ? "Edit template" : "New template"}</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name *">
            <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Applies to role (for AI generation)">
            <Input className="w-full" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Developer" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea className="w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="flex items-center justify-between">
          <h3 className="text-body-medium font-semibold text-neutral-800">Steps ({steps.length})</h3>
          <div className="flex gap-2">
            <AiButton label="AI: Generate steps" loading={generateAI.loading} onClick={() => generateAI.run({ role })} />
            <Button type="button" variant="secondary" onClick={addStep}>
              + Add step
            </Button>
          </div>
        </div>

        {generateAI.result && (
          <AiSuggestionCard
            reasoning={generateAI.result.reasoning}
            onAccept={() => {
              setSteps((s) => [...s, ...generateAI.result!.steps.map((st, i) => ({ ...st, step_id: `ai${Date.now()}-${i}` }))]);
              generateAI.setResult(null);
            }}
            onReject={() => generateAI.setResult(null)}
          >
            <ul className="text-small text-neutral-800">
              {generateAI.result.steps.map((s, i) => (
                <li key={i}>{s.title}</li>
              ))}
            </ul>
          </AiSuggestionCard>
        )}

        <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1">
          {steps.map((step, i) => (
            <div key={step.step_id} className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-neutral-500 disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="text-neutral-500 disabled:opacity-30">
                    ▼
                  </button>
                </div>
                <Input className="flex-1" placeholder="Step title" value={step.title} onChange={(e) => updateStep(i, { title: e.target.value })} />
                <button type="button" onClick={() => removeStep(i)} className="rounded-md p-1.5 text-neutral-500 hover:bg-danger-100 hover:text-danger-600">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <Select className="sm:col-span-1" value={step.category} onChange={(e) => updateStep(i, { category: e.target.value })}>
                  {["paperwork", "setup", "orientation", "training", "assignments"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Owner role" value={step.owner_role} onChange={(e) => updateStep(i, { owner_role: e.target.value })} />
                <Input
                  type="number"
                  placeholder="Days after start"
                  value={step.days_after_start}
                  onChange={(e) => updateStep(i, { days_after_start: Number(e.target.value) || 0 })}
                />
                <Input placeholder="Description" value={step.description} onChange={(e) => updateStep(i, { description: e.target.value })} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || steps.length === 0}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
