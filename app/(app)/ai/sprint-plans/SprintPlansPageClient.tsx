"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, Field, Textarea } from "@/components/ui/Input";
import { AiBanner } from "@/components/ui/AiBanner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { PageSkeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type Project = { id: string; name: string };
type ProposedTask = { title: string; assignee_name?: string | null; estimate?: string | number | null; priority?: string | null };
type CapacityAnalysis = { total_capacity?: number; total_estimated?: number; utilization_percent?: number; warnings?: string[] };
export type SprintPlanProposal = {
  id: string;
  projectId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string | null;
  sprintName?: string | null;
  reasoning?: string | null;
  capacityAnalysis?: CapacityAnalysis | null;
  proposedTasks?: ProposedTask[] | null;
  rejectionReason?: string | null;
  sprintId?: string | null;
};

export function SprintPlansPageClient({
  initialPlans,
  initialProjects,
}: {
  initialPlans?: SprintPlanProposal[];
  initialProjects?: Project[];
}) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);
  const [projectFilter, setProjectFilter] = useState("");
  const [plans, setPlans] = useState<SprintPlanProposal[]>(initialPlans ?? []);
  const [loading, setLoading] = useState(!initialPlans);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genProjectId, setGenProjectId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canCreate = can("sprint_plan", "create");
  const canApprove = can("sprint_plan", "approve");

  function loadPlans() {
    if (!selectedOrgId) return;
    setLoading(true);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    if (projectFilter) params.set("project_id", projectFilter);
    fetch(`/api/ai/sprint-plans?${params}`)
      .then((r) => r.json())
      .then((body) => setPlans(body.data ?? []))
      .finally(() => setLoading(false));
  }

  const skippedInitialProjects = useRef(!!initialProjects);
  useEffect(() => {
    if (!selectedOrgId) return;
    if (skippedInitialProjects.current) {
      skippedInitialProjects.current = false;
      return;
    }
    fetch(`/api/projects?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setProjects(body.data ?? []));
  }, [selectedOrgId]);

  const skippedInitialPlans = useRef(!!initialPlans);
  useEffect(() => {
    if (skippedInitialPlans.current) {
      skippedInitialPlans.current = false;
      return;
    }
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, projectFilter]);

  async function generate() {
    if (!selectedOrgId || !genProjectId) return;
    setGenerating(true);
    setGenError(null);
    const res = await fetch("/api/ai/sprint-plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, project_id: genProjectId }),
    });
    const body = await res.json();
    setGenerating(false);
    if (!res.ok) return setGenError(body.error ?? "Failed to generate plan");
    setShowGenerate(false);
    setGenProjectId("");
    loadPlans();
    setSelectedId(body.data.id);
  }

  async function approve(id: string) {
    setBusy(true);
    await fetch(`/api/ai/sprint-plans/${id}/approve`, { method: "POST" });
    setBusy(false);
    loadPlans();
  }

  async function reject() {
    if (!selectedId) return;
    setBusy(true);
    await fetch(`/api/ai/sprint-plans/${selectedId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    });
    setBusy(false);
    setShowReject(false);
    setRejectionReason("");
    loadPlans();
  }

  if (orgLoading || loading) return <PageSkeleton variant="cards" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Unknown project";
  const grouped = {
    pending: plans.filter((p) => p.status === "pending"),
    approved: plans.filter((p) => p.status === "approved"),
    rejected: plans.filter((p) => p.status === "rejected"),
  };
  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const util = selected?.capacityAnalysis?.utilization_percent ?? null;
  const utilColor = util === null ? "bg-neutral-400" : util < 80 ? "bg-success-600" : util <= 100 ? "bg-warning-600" : "bg-danger-600";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Sprint Plans</h1>
          <p className="text-body text-neutral-600">AI-drafted sprint plans awaiting your review.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-48" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {canCreate && <Button onClick={() => setShowGenerate(true)}>Generate New Plan</Button>}
        </div>
      </div>

      {plans.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No sprint plans yet</EmptyTitle>
            <EmptyDescription>Generate one to get an AI-drafted sprint proposal.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            {(["pending", "approved", "rejected"] as const).map((group) =>
              grouped[group].length === 0 ? null : (
                <div key={group} className="space-y-2">
                  <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">{group}</p>
                  {grouped[group].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full rounded-md border p-3 text-left text-body ${
                        selectedId === p.id ? "border-primary-600 bg-primary-100" : "glass-card hover:bg-neutral-100"
                      }`}
                    >
                      <p className="font-medium text-neutral-950">{projectName(p.projectId)}</p>
                      <p className="truncate text-small text-neutral-600">{p.sprintName ?? "Untitled sprint"}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <Badge color={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "ai"}>{p.status}</Badge>
                        <span className="text-caption text-neutral-500">{timeAgo(p.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ),
            )}
          </div>

          <div>
            {!selected ? (
              <Card>
                <p className="text-body text-neutral-600">Select a plan to see details.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-h3 font-semibold text-neutral-950">{selected.sprintName ?? `${projectName(selected.projectId)} — Untitled sprint`}</h2>
                      <p className="text-small text-neutral-600">Created {timeAgo(selected.createdAt)}</p>
                    </div>
                    <Badge color={selected.status === "approved" ? "success" : selected.status === "rejected" ? "danger" : "ai"}>
                      {selected.status}
                    </Badge>
                  </div>
                </Card>

                <div className="overflow-hidden glass-card rounded-md border-ai-600/40">
                  <AiBanner label="AI-generated — review before accepting" />
                  <p className="whitespace-pre-wrap px-4 py-3 text-body text-neutral-800">{selected.reasoning ?? "No reasoning provided."}</p>
                </div>

                <Card className="space-y-2">
                  <h3 className="text-body-medium font-semibold text-neutral-950">Capacity Analysis</h3>
                  {util !== null ? (
                    <>
                      <div className="h-3 w-full rounded-sm bg-neutral-200">
                        <div className={`h-3 rounded-sm ${utilColor}`} style={{ width: `${Math.min(util, 100)}%` }} />
                      </div>
                      <p className="text-small text-neutral-600">{util}% utilization</p>
                    </>
                  ) : (
                    <p className="text-small text-neutral-600">No capacity data.</p>
                  )}
                  {(selected.capacityAnalysis?.warnings ?? []).map((w, i) => (
                    <p key={i} className="text-small text-warning-600">
                      {w}
                    </p>
                  ))}
                </Card>

                <Card padding="sm" className="overflow-x-auto">
                  <h3 className="mb-2 text-body-medium font-semibold text-neutral-950">Proposed Tasks</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Estimate</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selected.proposedTasks ?? []).map((t, i) => (
                        <TableRow key={i}>
                          <TableCell>{t.title}</TableCell>
                          <TableCell>{t.assignee_name ?? "Unassigned"}</TableCell>
                          <TableCell>{t.estimate ?? "—"}</TableCell>
                          <TableCell>{t.priority ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {selected.status === "pending" && canApprove && (
                  <div className="flex gap-2">
                    <Button disabled={busy} onClick={() => approve(selected.id)}>
                      Approve Plan
                    </Button>
                    <Button variant="danger" disabled={busy} onClick={() => setShowReject(true)}>
                      Reject Plan
                    </Button>
                  </div>
                )}
                {selected.status === "approved" && (
                  <p className="text-small text-neutral-600">
                    Approved {selected.decidedAt ? timeAgo(selected.decidedAt) : ""} —{" "}
                    <Link href={`/projects/${selected.projectId}`} className="text-primary-700 underline">
                      View project
                    </Link>
                  </p>
                )}
                {selected.status === "rejected" && (
                  <Card padding="sm">
                    <p className="text-small text-neutral-600">
                      Rejected {selected.decidedAt ? timeAgo(selected.decidedAt) : ""}
                    </p>
                    {selected.rejectionReason && <p className="mt-1 text-body text-neutral-800">{selected.rejectionReason}</p>}
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showGenerate && (
        <Modal onClose={() => setShowGenerate(false)}>
          <h2 className="text-h3 font-semibold text-neutral-950">Generate Sprint Plan</h2>
          <div className="mt-4 space-y-3">
            <Field label="Project">
              <Select className="w-full" value={genProjectId} onChange={(e) => setGenProjectId(e.target.value)}>
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {genError && <p className="text-small text-danger-600">{genError}</p>}
            <div className="flex gap-2 pt-2">
              <Button onClick={generate} disabled={generating || !genProjectId}>
                {generating ? "Analyzing backlog and team capacity…" : "Confirm"}
              </Button>
              <Button variant="secondary" onClick={() => setShowGenerate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showReject && (
        <Modal onClose={() => setShowReject(false)} maxWidth="max-w-md">
          <h2 className="text-h3 font-semibold text-neutral-950">Reject Sprint Plan</h2>
          <div className="mt-4 space-y-3">
            <Field label="Reason">
              <Textarea className="w-full" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button variant="danger" onClick={reject} disabled={busy || !rejectionReason.trim()}>
                Reject Plan
              </Button>
              <Button variant="secondary" onClick={() => setShowReject(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
