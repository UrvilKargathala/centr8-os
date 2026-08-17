"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { SectionSkeleton } from "@/components/ui/skeleton";

type Cycle = {
  id: string;
  name: string;
  cycleType: string;
  selfAssessmentOpenDate: string | null;
  selfAssessmentDueDate: string | null;
  managerAssessmentDueDate: string | null;
  status: "draft" | "active" | "closed";
  appliesTo: string;
};
type SelfAssessment = { strengths?: string; areas_for_growth?: string; achievements?: string; goals_next_period?: string; self_rating?: number };
type ManagerAssessment = { strengths?: string; areas_for_growth?: string; feedback?: string; manager_rating?: number };
type Review = {
  id: string;
  cycleId: string;
  employeeId: string;
  selfSubmittedAt: string | null;
  selfAssessment: SelfAssessment;
  managerAssessment: ManagerAssessment;
  finalRating: string | null;
  status: string;
};
type Employee = { id: string; fullName: string };

const STATUS_COLOR: Record<string, "warning" | "success" | "danger" | "neutral" | "info"> = {
  not_started: "neutral",
  self_assessment_pending: "warning",
  manager_assessment_pending: "info",
  completed: "success",
};
const FINAL_RATINGS = ["exceeds", "meets", "needs_improvement", "unsatisfactory"];

const TABS = ["My Reviews", "Team Reviews", "All Reviews", "Cycles"] as const;
type Tab = (typeof TABS)[number];

export default function ReviewsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canViewTeam = can("review", "view_team");
  const canViewAll = can("review", "view_all");
  const canConfigure = can("review", "configure");
  const [tab, setTab] = useState<Tab>("My Reviews");

  const visibleTabs = TABS.filter((t) => {
    if (t === "Team Reviews") return canViewTeam;
    if (t === "All Reviews") return canViewAll;
    if (t === "Cycles") return canConfigure;
    return true;
  });

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Performance Reviews</h1>
        <p className="mt-1 text-body text-neutral-600">Self-assessments, manager feedback, and review cycles</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "My Reviews" && <MyReviewsTab orgId={selectedOrgId} />}
      {tab === "Team Reviews" && canViewTeam && <TeamReviewsTab orgId={selectedOrgId} />}
      {tab === "All Reviews" && canViewAll && <AllReviewsTab orgId={selectedOrgId} />}
      {tab === "Cycles" && canConfigure && <CyclesTab orgId={selectedOrgId} />}
    </div>
  );
}

function MyReviewsTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<{ cycle: Cycle; review: Review }[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/reviews/my?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId]);

  if (loading) return <SectionSkeleton variant="table" />;
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No reviews yet</EmptyTitle>
          <EmptyDescription>You&apos;ll see your reviews here once a cycle is active.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map(({ cycle, review }) => (
        <MyReviewCard key={review.id} cycle={cycle} review={review} onSaved={load} />
      ))}
    </div>
  );
}

function MyReviewCard({ cycle, review, onSaved }: { cycle: Cycle; review: Review; onSaved: () => void }) {
  const alreadySubmitted = review.status !== "not_started" && review.status !== "self_assessment_pending";
  const [strengths, setStrengths] = useState(review.selfAssessment?.strengths ?? "");
  const [areas, setAreas] = useState(review.selfAssessment?.areas_for_growth ?? "");
  const [achievements, setAchievements] = useState(review.selfAssessment?.achievements ?? "");
  const [goals, setGoals] = useState(review.selfAssessment?.goals_next_period ?? "");
  const [rating, setRating] = useState(review.selfAssessment?.self_rating?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const draftAI = useAiCall<{ strengths: string; areas_for_growth: string; achievements: string; goals_next_period: string }>("Writer", "draft_self_assessment");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/reviews/${review.id}/self-assessment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strengths,
        areas_for_growth: areas,
        achievements,
        goals_next_period: goals,
        self_rating: rating ? Number(rating) : null,
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Card color={review.status === "completed" ? "success" : undefined} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h3 font-semibold text-neutral-950">{cycle.name}</h3>
        <Badge color={STATUS_COLOR[review.status] ?? "neutral"}>{review.status.replace(/_/g, " ")}</Badge>
      </div>

      {alreadySubmitted ? (
        <div className="space-y-2 text-body text-neutral-700">
          <p><span className="font-medium">Strengths:</span> {review.selfAssessment?.strengths || "—"}</p>
          <p><span className="font-medium">Areas for growth:</span> {review.selfAssessment?.areas_for_growth || "—"}</p>
          <p><span className="font-medium">Achievements:</span> {review.selfAssessment?.achievements || "—"}</p>
          <p><span className="font-medium">Goals next period:</span> {review.selfAssessment?.goals_next_period || "—"}</p>
          {review.selfAssessment?.self_rating != null && <p><span className="font-medium">Self rating:</span> {review.selfAssessment.self_rating}/5</p>}
          {review.status === "completed" && (
            <div className="mt-3 rounded-md border border-success-600/30 bg-success-100 p-3">
              <p className="text-body-medium font-semibold text-success-600">Manager final rating: {review.finalRating ?? "—"}</p>
              {review.managerAssessment?.feedback && <p className="mt-1 text-body text-neutral-700">{review.managerAssessment.feedback}</p>}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <AiButton label="Draft self-assessment" loading={draftAI.loading} onClick={() => draftAI.run({ name: "you", cycle_name: cycle.name })} />
          {draftAI.result && (
            <AiSuggestionCard
              onAccept={() => {
                setStrengths(draftAI.result!.strengths);
                setAreas(draftAI.result!.areas_for_growth);
                setAchievements(draftAI.result!.achievements);
                setGoals(draftAI.result!.goals_next_period);
                draftAI.setResult(null);
              }}
              onReject={() => draftAI.setResult(null)}
            >
              <p className="text-body text-neutral-700">{draftAI.result.strengths}</p>
            </AiSuggestionCard>
          )}
          <Field label="Strengths">
            <Textarea className="w-full" rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
          </Field>
          <Field label="Areas for growth">
            <Textarea className="w-full" rows={2} value={areas} onChange={(e) => setAreas(e.target.value)} />
          </Field>
          <Field label="Achievements">
            <Textarea className="w-full" rows={2} value={achievements} onChange={(e) => setAchievements(e.target.value)} />
          </Field>
          <Field label="Goals for next period">
            <Textarea className="w-full" rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
          </Field>
          <Field label="Self rating (1-5)">
            <Input type="number" min={1} max={5} className="w-24" value={rating} onChange={(e) => setRating(e.target.value)} />
          </Field>
          <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit self-assessment"}</Button>
        </form>
      )}
    </Card>
  );
}

function TeamReviewsTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<{ cycle: Cycle; review: Review; employee: Employee }[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/reviews/team?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId]);

  if (loading) return <SectionSkeleton variant="table" />;
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No reports to review</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const byEmployee = new Map<string, { employee: Employee; items: { cycle: Cycle; review: Review }[] }>();
  for (const row of rows) {
    if (!byEmployee.has(row.employee.id)) byEmployee.set(row.employee.id, { employee: row.employee, items: [] });
    byEmployee.get(row.employee.id)!.items.push({ cycle: row.cycle, review: row.review });
  }

  return (
    <div className="space-y-6">
      {Array.from(byEmployee.values()).map(({ employee, items }) => (
        <div key={employee.id}>
          <h2 className="mb-2 text-h3 font-semibold text-neutral-950">{employee.fullName}</h2>
          <div className="space-y-3">
            {items.map(({ cycle, review }) => (
              <TeamReviewCard key={review.id} cycle={cycle} review={review} employeeName={employee.fullName} onSaved={load} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamReviewCard({ cycle, review, employeeName, onSaved }: { cycle: Cycle; review: Review; employeeName: string; onSaved: () => void }) {
  const selfSubmitted = Object.keys(review.selfAssessment ?? {}).some((k) => (review.selfAssessment as Record<string, unknown>)[k]);
  const alreadyDone = review.status === "completed";
  const [strengths, setStrengths] = useState(review.managerAssessment?.strengths ?? "");
  const [areas, setAreas] = useState(review.managerAssessment?.areas_for_growth ?? "");
  const [feedback, setFeedback] = useState(review.managerAssessment?.feedback ?? "");
  const [managerRating, setManagerRating] = useState(review.managerAssessment?.manager_rating?.toString() ?? "");
  const [finalRating, setFinalRating] = useState(review.finalRating ?? "meets");
  const [saving, setSaving] = useState(false);
  const summarizeAI = useAiCall<string>("Analyst", "summarize_review_feedback");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/reviews/${review.id}/manager-assessment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strengths,
        areas_for_growth: areas,
        feedback,
        manager_rating: managerRating ? Number(managerRating) : null,
        final_rating: finalRating,
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-medium font-semibold text-neutral-950">{cycle.name}</h3>
        <Badge color={STATUS_COLOR[review.status] ?? "neutral"}>{review.status.replace(/_/g, " ")}</Badge>
      </div>

      {selfSubmitted ? (
        <div className="rounded-md bg-neutral-100 p-3 text-body text-neutral-700">
          <p className="text-caption font-medium uppercase text-neutral-500">Self-assessment</p>
          <p><span className="font-medium">Strengths:</span> {review.selfAssessment?.strengths || "—"}</p>
          <p><span className="font-medium">Areas for growth:</span> {review.selfAssessment?.areas_for_growth || "—"}</p>
          <p><span className="font-medium">Achievements:</span> {review.selfAssessment?.achievements || "—"}</p>
        </div>
      ) : (
        <p className="text-body text-neutral-500">Self-assessment not submitted yet.</p>
      )}

      {alreadyDone ? (
        <div className="rounded-md border border-success-600/30 bg-success-100 p-3 text-body text-neutral-700">
          <p className="font-semibold text-success-600">Final rating: {review.finalRating}</p>
          <p>{review.managerAssessment?.feedback}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <AiButton
            label="Summarize feedback"
            loading={summarizeAI.loading}
            onClick={() => summarizeAI.run({ name: employeeName, self_assessment_summary: review.selfAssessment?.strengths ?? "" })}
          />
          {summarizeAI.result && (
            <AiSuggestionCard onAccept={() => { setFeedback(summarizeAI.result!); summarizeAI.setResult(null); }} onReject={() => summarizeAI.setResult(null)}>
              <p className="text-body text-neutral-700">{summarizeAI.result}</p>
            </AiSuggestionCard>
          )}
          <Field label="Strengths">
            <Textarea className="w-full" rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
          </Field>
          <Field label="Areas for growth">
            <Textarea className="w-full" rows={2} value={areas} onChange={(e) => setAreas(e.target.value)} />
          </Field>
          <Field label="Feedback">
            <Textarea className="w-full" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
          <div className="flex gap-3">
            <Field label="Manager rating (1-5)">
              <Input type="number" min={1} max={5} className="w-24" value={managerRating} onChange={(e) => setManagerRating(e.target.value)} />
            </Field>
            <Field label="Final rating">
              <Select className="w-48" value={finalRating} onChange={(e) => setFinalRating(e.target.value)}>
                {FINAL_RATINGS.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit manager assessment"}</Button>
        </form>
      )}
    </Card>
  );
}

function AllReviewsTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Review[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cycleFilter, setCycleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/review-cycles?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
    ]).then(([c, e]) => {
      setCycles(c.data ?? []);
      setEmployees(e.data ?? []);
    });
  }, [orgId]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ org_id: orgId });
    if (cycleFilter) params.set("cycle_id", cycleFilter);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/reviews?${params}`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
      .finally(() => setLoading(false));
  }, [orgId, cycleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Field label="Cycle">
          <Select className="w-48" value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)}>
            <option value="">All</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select className="w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="not_started">Not started</option>
            <option value="self_assessment_pending">Self-assessment pending</option>
            <option value="manager_assessment_pending">Manager assessment pending</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
      </div>
      {loading ? (
        <SectionSkeleton variant="table" />
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Final rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{employees.find((e) => e.id === r.employeeId)?.fullName ?? "—"}</TableCell>
                  <TableCell>{cycles.find((c) => c.id === r.cycleId)?.name ?? "—"}</TableCell>
                  <TableCell><Badge color={STATUS_COLOR[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell>{r.finalRating ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function CyclesTab({ orgId }: { orgId: string }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/review-cycles?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setCycles(b.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId]);

  async function updateStatus(cycle: Cycle, status: string) {
    await fetch(`/api/review-cycles/${cycle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}>+ New Cycle</Button>
      </div>
      {loading ? (
        <SectionSkeleton variant="table" />
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Self-assessment due</TableHead>
                <TableHead>Manager assessment due</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-neutral-600">{c.cycleType}</TableCell>
                  <TableCell className="text-neutral-600">{c.selfAssessmentDueDate ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{c.managerAssessmentDueDate ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{c.appliesTo}</TableCell>
                  <TableCell>
                    <Select className="w-32" value={c.status} onChange={(e) => updateStatus(c, e.target.value)}>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {showNew && <NewCycleModal orgId={orgId} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewCycleModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [cycleType, setCycleType] = useState("quarterly");
  const [selfOpen, setSelfOpen] = useState("");
  const [selfDue, setSelfDue] = useState("");
  const [managerDue, setManagerDue] = useState("");
  const [status, setStatus] = useState("draft");
  const [appliesTo, setAppliesTo] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/review-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        cycle_type: cycleType,
        self_assessment_open_date: selfOpen || undefined,
        self_assessment_due_date: selfDue || undefined,
        manager_assessment_due_date: managerDue || undefined,
        status,
        applies_to: appliesTo,
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
        <h3 className="text-h3 font-semibold text-neutral-950">New review cycle</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Name">
          <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q1 2027" autoFocus />
        </Field>
        <Field label="Cycle type">
          <Select className="w-full" value={cycleType} onChange={(e) => setCycleType(e.target.value)}>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="probation">Probation</option>
          </Select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Self-assessment opens"><Input type="date" className="w-full" value={selfOpen} onChange={(e) => setSelfOpen(e.target.value)} /></Field>
          <Field label="Self-assessment due"><Input type="date" className="w-full" value={selfDue} onChange={(e) => setSelfDue(e.target.value)} /></Field>
          <Field label="Manager assessment due"><Input type="date" className="w-full" value={managerDue} onChange={(e) => setManagerDue(e.target.value)} /></Field>
        </div>
        <Field label="Applies to">
          <Input className="w-full" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} placeholder="all" />
        </Field>
        <Field label="Status">
          <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
