"use client";

import { useEffect, useState, use } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge, ProjectStatusBadge, SprintStatusBadge, sprintStatusColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardButton } from "@/components/ui/Card";
import { Input, Select, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SprintBoard } from "@/components/SprintBoard";
import { TaskListView } from "@/components/TaskListView";
import { TaskCalendarView } from "@/components/TaskCalendarView";
import { ProjectFilesView } from "@/components/ProjectFilesView";
import { CapacityPanel } from "@/components/CapacityPanel";
import { SendViaSlackButton } from "@/components/SendViaSlackButton";
import { SendViaGmailButton } from "@/components/SendViaGmailButton";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { Task } from "@/components/TaskCard";
import { PROJECT_STATUSES, TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES } from "@/lib/constants";

type Project = {
  id: string;
  orgId: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetAllocated: number | null;
  budgetSpent: number | null;
};
type Milestone = { id: string; name: string; dueDate: string | null; approvedAt: string | null };
type Sprint = { id: string; name: string; status: string; startDate: string | null; endDate: string | null };

const TABS = ["Overview", "Sprints", "Tasks", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { selectedOrgId, can } = useOrg();
  const canEditTasks = can("task", "update");

  const [tab, setTab] = useState<Tab>("Overview");
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/milestones?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/sprints?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/tasks?project_id=${id}`).then((r) => r.json()),
    ])
      .then(([p, m, s, t]) => {
        if (!p.data) throw new Error(p.error ?? "Failed to load project");
        setProject(p.data);
        setMilestones(m.data ?? []);
        setSprints(s.data ?? []);
        setTasks(t.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [id]);

  async function handleStatusChange(taskId: string, status: string) {
    // Optimistic update so the board feels immediate, then reconcile with
    // the server (which also re-runs the RBAC check — a viewer's drag
    // wouldn't reach here since canEdit already hides dragging, but this
    // covers any other path that calls it).
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) loadAll(); // revert to server truth on failure
  }

  if (loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  if (!project) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">{project.name}</h1>
          <p className="mt-1 text-body text-neutral-600">
            {project.startDate ?? "No start date"} – {project.endDate ?? "No end date"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedOrgId && (
            <>
              <SendViaSlackButton orgId={selectedOrgId} defaultText={`Update on ${project.name}: `} />
              <SendViaGmailButton orgId={selectedOrgId} defaultSubject={`Update on ${project.name}`} />
            </>
          )}
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-600 hover:text-neutral-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab projectId={id} project={project} milestones={milestones} onMilestoneAdded={loadAll} />}
      {tab === "Sprints" && (
        <SprintsTab sprints={sprints} tasks={tasks} canEdit={canEditTasks} onTaskClick={setOpenTaskId} onStatusChange={handleStatusChange} />
      )}
      {tab === "Tasks" && (
        <TasksTab
          projectId={id}
          orgId={selectedOrgId}
          tasks={tasks}
          canEdit={canEditTasks}
          onTaskClick={setOpenTaskId}
          onStatusChange={handleStatusChange}
          onTaskCreated={loadAll}
        />
      )}
      {tab === "Settings" && project && (
        <SettingsTab project={project} orgId={selectedOrgId} onSaved={loadAll} />
      )}

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => {
            setOpenTaskId(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function OverviewTab({
  projectId,
  project,
  milestones,
  onMilestoneAdded,
}: {
  projectId: string;
  project: Project;
  milestones: Milestone[];
  onMilestoneAdded: () => void;
}) {
  const { selectedOrgId, can } = useOrg();
  const canCreate = can("milestone", "create");
  const canApprove = can("milestone", "approve");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !selectedOrgId) return;
    setSaving(true);
    await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, project_id: projectId, name, due_date: dueDate || null }),
    });
    setName("");
    setDueDate("");
    setSaving(false);
    onMilestoneAdded();
  }

  async function approve(milestoneId: string) {
    setApprovingId(milestoneId);
    await fetch(`/api/milestones/${milestoneId}/approve`, { method: "POST" });
    setApprovingId(null);
    onMilestoneAdded();
  }

  return (
    <div className="space-y-6">
      {(project.budgetAllocated != null || project.budgetSpent != null) && <BudgetSummary project={project} />}

      <div className="space-y-4">
      <h2 className="text-h3 font-semibold text-neutral-800">Milestones</h2>
      {milestones.length === 0 ? (
        <p className="text-body text-neutral-600">No milestones yet.</p>
      ) : (
        <Card padding="sm" className="p-0">
          <ul className="divide-y divide-neutral-200">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
                <span className="text-neutral-950">{m.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600">{m.dueDate ?? "No due date"}</span>
                  {m.approvedAt ? (
                    <Badge color="success">Approved</Badge>
                  ) : (
                    canApprove && (
                      <Button variant="secondary" onClick={() => approve(m.id)} disabled={approvingId === m.id}>
                        {approvingId === m.id ? "Approving…" : "Approve"}
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canCreate && (
        <form onSubmit={addMilestone} className="flex flex-wrap gap-2">
          <Input className="min-w-0 flex-1" placeholder="New milestone name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit" disabled={saving || !name}>
            Add
          </Button>
        </form>
      )}
      </div>
    </div>
  );
}

function BudgetSummary({ project }: { project: Project }) {
  const allocated = project.budgetAllocated ?? 0;
  const spent = project.budgetSpent ?? 0;
  const overBudget = project.budgetAllocated != null && spent > allocated;
  const pctUsed = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;

  return (
    <Card padding="sm" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 font-semibold text-neutral-800">Budget</h2>
        {overBudget && <Badge color="danger">Over budget</Badge>}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-body">
        <span className="text-neutral-600">
          Allocated: <span className="font-medium text-neutral-950">{project.budgetAllocated != null ? `$${allocated.toLocaleString()}` : "Not set"}</span>
        </span>
        <span className="text-neutral-600">
          Spent: <span className="font-medium text-neutral-950">{project.budgetSpent != null ? `$${spent.toLocaleString()}` : "Not set"}</span>
        </span>
      </div>
      {project.budgetAllocated != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className={`h-full rounded-full ${overBudget ? "bg-danger-600" : "bg-primary-600"}`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
      )}
    </Card>
  );
}

function SprintsTab({
  sprints,
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
}: {
  sprints: Sprint[];
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const { selectedOrgId } = useOrg();
  const [openSprintId, setOpenSprintId] = useState<string | null>(null);

  if (sprints.length === 0) return <p className="text-body text-neutral-600">No sprints yet.</p>;

  const openSprint = sprints.find((s) => s.id === openSprintId);
  if (openSprint) {
    const sprintTasks = tasks.filter((t) => t.sprintId === openSprint.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setOpenSprintId(null)}>
            ← Sprints
          </Button>
          <span className="text-body-medium font-medium text-neutral-950">{openSprint.name}</span>
          <SprintStatusBadge status={openSprint.status} />
        </div>
        {selectedOrgId && <CapacityPanel sprintId={openSprint.id} orgId={selectedOrgId} />}
        <SprintBoard tasks={sprintTasks} canEdit={canEdit} onTaskClick={onTaskClick} onStatusChange={onStatusChange} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sprints.map((s) => {
        const sprintTasks = tasks.filter((t) => t.sprintId === s.id);
        return (
          <CardButton key={s.id} onClick={() => setOpenSprintId(s.id)} color={sprintStatusColor(s.status)} padding="sm">
            <div className="flex items-center justify-between">
              <span className="text-body-medium font-medium text-neutral-950">{s.name}</span>
              <SprintStatusBadge status={s.status} />
            </div>
            <p className="mt-1 text-small text-neutral-600">
              {s.startDate ?? "No start"} – {s.endDate ?? "No end"} · {sprintTasks.length} tasks
            </p>
          </CardButton>
        );
      })}
    </div>
  );
}

const TASK_VIEWS = ["List", "Board", "Calendar", "Files"] as const;
type TaskView = (typeof TASK_VIEWS)[number];

function TasksTab({
  projectId,
  orgId,
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
  onTaskCreated,
}: {
  projectId: string;
  orgId: string | null;
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onTaskCreated: () => void;
}) {
  const { can } = useOrg();
  const [view, setView] = useState<TaskView>("List");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = tasks.filter(
    (t) =>
      (statusFilter === "all" || t.status === statusFilter) &&
      (priorityFilter === "all" || t.priority === priorityFilter) &&
      (assigneeFilter === "" || (t.assigneeId ?? "").includes(assigneeFilter)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
          {TASK_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-sm px-3 py-1.5 text-body-medium font-medium transition-colors ${
                view === v ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {can("task", "create") && <Button onClick={() => setShowNew(true)}>+ New Task</Button>}
      </div>

      {view === "List" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All priorities</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Input placeholder="Filter by assignee ID" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} />
          </div>
          {filtered.length === 0 ? (
            <p className="text-body text-neutral-600">No tasks match.</p>
          ) : (
            <TaskListView tasks={filtered} onTaskClick={onTaskClick} />
          )}
        </>
      )}

      {view === "Board" &&
        (tasks.length === 0 ? (
          <p className="text-body text-neutral-600">No tasks yet.</p>
        ) : (
          <SprintBoard tasks={tasks} canEdit={canEdit} onTaskClick={onTaskClick} onStatusChange={onStatusChange} />
        ))}

      {view === "Calendar" && <TaskCalendarView tasks={tasks} onTaskClick={onTaskClick} />}

      {view === "Files" && <ProjectFilesView tasks={tasks} />}

      {showNew && orgId && (
        <Modal onClose={() => setShowNew(false)}>
          <NewTaskForm
            orgId={orgId}
            projectId={projectId}
            onClose={() => setShowNew(false)}
            onCreated={() => {
              setShowNew(false);
              onTaskCreated();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewTaskForm({
  orgId,
  projectId,
  onClose,
  onCreated,
}: {
  orgId: string;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof TASK_PRIORITIES)[number]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        project_id: projectId,
        title,
        description: description || null,
        priority,
        due_date: dueDate || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create task");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">New Task</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Title">
        <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Description">
        <Input className="w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Priority">
          <Select className="w-full" value={priority} onChange={(e) => setPriority(e.target.value as (typeof TASK_PRIORITIES)[number])}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" className="w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title}>
          {saving ? "Creating…" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}

function SettingsTab({ project, orgId, onSaved }: { project: Project; orgId: string | null; onSaved: () => void }) {
  const { can } = useOrg();
  const canUpdate = can("project", "update");
  const canUpdateBudget = can("budget", "update");
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [budgetAllocated, setBudgetAllocated] = useState(project.budgetAllocated?.toString() ?? "");
  const [budgetSpent, setBudgetSpent] = useState(project.budgetSpent?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Only send fields the role can actually change — sending an unchanged
    // name/status while only budget:update is granted would still trip
    // the server's project:update check for no reason.
    const payload: Record<string, unknown> = {};
    if (canUpdate) {
      payload.name = name;
      payload.status = status;
    }
    if (canUpdateBudget) {
      payload.budget_allocated = budgetAllocated === "" ? null : Number(budgetAllocated);
      payload.budget_spent = budgetSpent === "" ? null : Number(budgetSpent);
    }

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    <div className="max-w-md space-y-8">
    <form onSubmit={handleSave} className="space-y-4">
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      <Field label="Name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} disabled={!canUpdate} />
      </Field>
      <Field label="Status">
        <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canUpdate}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      {/* FR-3.x (Prompt 3.2) — simple manual entry, no finance integration. */}
      <div className="grid grid-cols-1 gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2">
        <Field label="Budget allocated ($)">
          <Input
            type="number"
            min="0"
            step="0.01"
            className="w-full"
            value={budgetAllocated}
            onChange={(e) => setBudgetAllocated(e.target.value)}
            disabled={!canUpdateBudget}
            placeholder="Not set"
          />
        </Field>
        <Field label="Budget spent ($)">
          <Input
            type="number"
            min="0"
            step="0.01"
            className="w-full"
            value={budgetSpent}
            onChange={(e) => setBudgetSpent(e.target.value)}
            disabled={!canUpdateBudget}
            placeholder="Not set"
          />
        </Field>
      </div>

      <p className="text-small text-neutral-400">Org: {orgId}</p>
      {canUpdate || canUpdateBudget ? (
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      ) : (
        <p className="text-small text-neutral-400">Your role doesn't allow editing project settings.</p>
      )}
    </form>

      {orgId && <PortalAccessSection projectId={project.id} orgId={orgId} />}
    </div>
  );
}

type PortalGrant = { id: string; clientName: string; hiddenFields: string[]; createdAt: string; revokedAt: string | null };

// FR-4.x (Prompt 3.1) — who can view this project's client portal, and
// whether budget is hidden from them. Lives in Settings alongside the
// budget fields it controls visibility of.
function PortalAccessSection({ projectId, orgId }: { projectId: string; orgId: string }) {
  const { can, orgs } = useOrg();
  const orgSlug = orgs.find((o) => o.id === orgId)?.slug ?? null;
  const canRead = can("portal", "read");
  const canConfigure = can("portal", "configure");

  const [grants, setGrants] = useState<PortalGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState("");
  const [hideBudget, setHideBudget] = useState(true);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ clientName: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/portal-access?project_id=${projectId}&org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setGrants(b.data ?? []))
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [projectId, orgId, canRead]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/portal-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        project_id: projectId,
        client_name: clientName,
        hidden_fields: hideBudget ? ["budget"] : [],
      }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create access link");
      return;
    }
    setJustCreated({ clientName: body.data.clientName, token: body.data.token });
    setClientName("");
    load();
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/portal-access/${id}`, { method: "DELETE" });
    load();
  }

  if (!canRead) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-neutral-950">Client portal access</h2>
        <p className="mt-1 text-small text-neutral-600">
          Each grant is a link a client can open without logging in. Budget is hidden from clients by default.
        </p>
      </div>

      {justCreated && (
        <div className="space-y-1.5 rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
          <p className="text-small font-medium text-warning-600">
            Copy this link now — it won&apos;t be shown again for &ldquo;{justCreated.clientName}&rdquo;.
          </p>
          <code className="block break-all rounded-sm bg-neutral-50 px-2 py-1.5 text-small text-neutral-950">
            {typeof window !== "undefined" ? window.location.origin : ""}/portal/{orgSlug ?? "…"}?token={justCreated.token}
          </code>
          <Button variant="secondary" onClick={() => setJustCreated(null)}>
            Done
          </Button>
        </div>
      )}

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {loading ? (
        <p className="text-body text-neutral-600">Loading…</p>
      ) : grants.length === 0 ? (
        <p className="text-body text-neutral-600">No client access grants yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
              <div>
                <span className="text-neutral-950">{g.clientName}</span>
                <span className="ml-2 text-small text-neutral-600">
                  {g.revokedAt ? "Revoked" : g.hiddenFields.includes("budget") ? "Budget hidden" : "Budget visible"}
                </span>
              </div>
              {canConfigure && !g.revokedAt && (
                <button onClick={() => handleRevoke(g.id)} className="text-small text-danger-600 hover:underline">
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canConfigure && (
        <form onSubmit={handleCreate} className="space-y-3 border-t border-neutral-200 pt-4">
          <Field label="Client name">
            <Input className="w-full" placeholder="e.g. Acme Corp" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-body text-neutral-800">
            <input type="checkbox" checked={hideBudget} onChange={(e) => setHideBudget(e.target.checked)} />
            Hide budget from this client
          </label>
          <Button type="submit" variant="secondary" disabled={creating || !clientName}>
            {creating ? "Creating…" : "+ New access link"}
          </Button>
        </form>
      )}
    </Card>
  );
}
