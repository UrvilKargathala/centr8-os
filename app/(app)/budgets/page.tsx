"use client";

import { useEffect, useMemo, useState } from "react";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, ProjectStatusBadge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";

type Project = { id: string; name: string; status: string; budgetAllocated: number | null; budgetSpent: number | null };

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

// Org-wide roll-up of the per-project budget fields (Prompt 3.2) — no new
// table, this just aggregates projects.budgetAllocated/budgetSpent that
// already exist and are edited on the project Settings tab.
export default function BudgetsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = can("budget", "update");

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/projects?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load projects");
        setProjects(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const budgeted = useMemo(() => projects.filter((p) => p.budgetAllocated != null), [projects]);
  const totalAllocated = budgeted.reduce((sum, p) => sum + (p.budgetAllocated ?? 0), 0);
  const totalSpent = budgeted.reduce((sum, p) => sum + (p.budgetSpent ?? 0), 0);
  const pctUsed = totalAllocated > 0 ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100)) : 0;
  const overBudgetCount = budgeted.filter((p) => (p.budgetSpent ?? 0) > (p.budgetAllocated ?? 0)).length;

  async function save(id: string, allocated: string, spent: string) {
    setSaving(true);
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget_allocated: allocated === "" ? null : Number(allocated),
        budget_spent: spent === "" ? null : Number(spent),
      }),
    });
    setSaving(false);
    setEditingId(null);
    loadAll();
  }

  if (orgLoading || loading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Budgets</h1>
        <p className="mt-1 text-body text-neutral-600">Org-wide roll-up of allocated vs. spent across every project.</p>
      </div>

      {projects.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12c1.598 0 2.978.8 3.6 1.964M12 8V6m0 2v8m0 0v2m0-2c-1.598 0-2.978-.8-3.6-1.964"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Budgets are set per-project on each project's Settings tab.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card padding="sm">
              <p className="text-small text-neutral-600">Total allocated</p>
              <p className="mt-1 text-h1 font-semibold text-neutral-950">{formatCurrency(totalAllocated)}</p>
            </Card>
            <Card padding="sm">
              <p className="text-small text-neutral-600">Total spent</p>
              <p className="mt-1 text-h1 font-semibold text-neutral-950">{formatCurrency(totalSpent)}</p>
              <div className="mt-2 h-1.5 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={`h-full rounded-full ${totalSpent > totalAllocated ? "bg-danger-600" : "bg-primary-600"}`}
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
            </Card>
            <Card padding="sm">
              <p className="text-small text-neutral-600">Projects over budget</p>
              <p className="mt-1 text-display font-semibold text-neutral-950">{overBudgetCount}</p>
            </Card>
          </div>

          <BudgetTable projects={projects} editingId={editingId} setEditingId={setEditingId} saving={saving} canEdit={canEdit} onSave={save} />
        </>
      )}
    </div>
  );
}

function BudgetTable({
  projects,
  editingId,
  setEditingId,
  saving,
  canEdit,
  onSave,
}: {
  projects: Project[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  saving: boolean;
  canEdit: boolean;
  onSave: (id: string, allocated: string, spent: string) => void;
}) {
  const { page, setPage, pageSize, total, paged } = usePagination(projects, 10);
  return (
    <Card padding="sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Allocated</TableHead>
            <TableHead>Spent</TableHead>
            {canEdit && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((p) =>
            editingId === p.id ? (
              <BudgetEditRow key={p.id} project={p} saving={saving} onCancel={() => setEditingId(null)} onSave={onSave} />
            ) : (
              <TableRow key={p.id}>
                <TableCell>
                  <a href={`/projects/${p.id}`} className="font-medium text-neutral-950 hover:underline">
                    {p.name}
                  </a>
                </TableCell>
                <TableCell>
                  <ProjectStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="text-neutral-600">
                  {p.budgetAllocated != null ? formatCurrency(p.budgetAllocated) : "Not set"}
                </TableCell>
                <TableCell className="text-neutral-600">
                  <span className="flex items-center gap-2">
                    {p.budgetSpent != null ? formatCurrency(p.budgetSpent) : "Not set"}
                    {p.budgetAllocated != null && (p.budgetSpent ?? 0) > p.budgetAllocated && (
                      <Badge color="danger">Over</Badge>
                    )}
                  </span>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="secondary" onClick={() => setEditingId(p.id)}>
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </Card>
  );
}

function BudgetEditRow({
  project,
  saving,
  onSave,
  onCancel,
}: {
  project: Project;
  saving: boolean;
  onSave: (id: string, allocated: string, spent: string) => void;
  onCancel: () => void;
}) {
  const [allocated, setAllocated] = useState(project.budgetAllocated?.toString() ?? "");
  const [spent, setSpent] = useState(project.budgetSpent?.toString() ?? "");

  return (
    <TableRow>
      <TableCell className="font-medium text-neutral-950">{project.name}</TableCell>
      <TableCell>
        <ProjectStatusBadge status={project.status} />
      </TableCell>
      <TableCell>
        <Input type="number" min="0" step="0.01" className="w-32" value={allocated} onChange={(e) => setAllocated(e.target.value)} />
      </TableCell>
      <TableCell>
        <Input type="number" min="0" step="0.01" className="w-32" value={spent} onChange={(e) => setSpent(e.target.value)} />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button onClick={() => onSave(project.id, allocated, spent)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
