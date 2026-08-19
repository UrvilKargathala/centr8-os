"use client";

import { useEffect, useState, use } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";
import { Badge, ProjectStatusBadge, SprintStatusBadge, sprintStatusColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardButton } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
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

const TABS = ["Overview", "Tasks", "Team", "Files", "Activity", "Settings"] as const;
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
  const [peopleById, setPeopleById] = useState<Record<string, { fullName: string }>>({});
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

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/team?org_id=${selectedOrgId}&active=true`)
      .then((r) => r.json())
      .then((b) => {
        if (Array.isArray(b.data)) {
          const map: Record<string, { fullName: string }> = {};
          for (const p of b.data) map[p.id] = { fullName: p.fullName };
          setPeopleById(map);
        }
      });
  }, [selectedOrgId]);

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

  if (loading) return <PageSkeleton variant="detail" />;
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
      {tab === "Tasks" && (
        <TasksTab
          projectId={id}
          orgId={selectedOrgId}
          tasks={tasks}
          canEdit={canEditTasks}
          onTaskClick={setOpenTaskId}
          onStatusChange={handleStatusChange}
          onTaskCreated={loadAll}
          peopleById={peopleById}
        />
      )}
      {tab === "Team" && selectedOrgId && (
        <TeamTab projectId={id} orgId={selectedOrgId} canEdit={can("project", "update")} />
      )}
      {tab === "Files" && <ProjectFilesView tasks={tasks} />}
      {tab === "Activity" && <ActivityTab projectId={id} />}
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks?project_id=${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/members`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/activity`).then((r) => r.json()),
    ]).then(([t, m, a]) => {
      setTasks(t.data ?? []);
      setMembers(m.data ?? []);
      setActivity(a.data ?? []);
    });
  }, [projectId]);

  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const inFlight = tasks.filter((t) => t.status === "in_progress" || t.status === "in_review").length;
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== "done" && t.status !== "cancelled").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const daysToEnd = project.endDate
    ? Math.round((new Date(project.endDate + "T00:00:00").getTime() - Date.now()) / 86400_000)
    : null;

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

  const budgetAllocated = project.budgetAllocated ?? 0;
  const budgetSpent = project.budgetSpent ?? 0;
  const budgetPct = budgetAllocated > 0 ? Math.min(100, Math.round((budgetSpent / budgetAllocated) * 100)) : 0;
  const overBudget = project.budgetAllocated != null && budgetSpent > budgetAllocated;

  const upcomingMilestones = milestones
    .filter((m) => !m.approvedAt)
    .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Task progress" value={total > 0 ? `${pct}%` : "—"} pattern={Math.round(pct / 5)} tone="success" />
        <KpiCard title="Tasks in flight" value={inFlight} pattern={inFlight} tone="info" />
        <KpiCard title="Overdue" value={overdue} pattern={overdue} tone={overdue > 0 ? "danger" : "neutral"} />
        <KpiCard
          title="Days remaining"
          value={daysToEnd == null ? "—" : daysToEnd < 0 ? `${-daysToEnd} over` : daysToEnd}
          pattern={daysToEnd == null ? 0 : Math.min(24, Math.max(0, daysToEnd))}
          tone={daysToEnd != null && daysToEnd < 0 ? "danger" : daysToEnd != null && daysToEnd < 7 ? "warning" : "primary"}
        />
      </div>

      {/* Progress + Budget two-column */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="glass-card rounded-md p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-h3 font-semibold text-neutral-950">Progress</h2>
            <span className="text-caption text-neutral-500">{done}/{total} tasks done</span>
          </div>
          {total === 0 ? (
            <p className="mt-4 text-body text-neutral-600">No tasks yet — add one in the Tasks tab to start tracking.</p>
          ) : (
            <>
              <div className="mt-3 h-2 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-success-600" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-small">
                <StatusRow status="Done" count={tasks.filter((t) => t.status === "done").length} tone="success" />
                <StatusRow status="In progress" count={tasks.filter((t) => t.status === "in_progress").length} tone="info" />
                <StatusRow status="In review" count={tasks.filter((t) => t.status === "in_review").length} tone="warning" />
                <StatusRow status="To do" count={tasks.filter((t) => t.status === "todo").length} tone="neutral" />
                <StatusRow status="Backlog" count={tasks.filter((t) => t.status === "backlog").length} tone="neutral" />
                <StatusRow status="Cancelled" count={tasks.filter((t) => t.status === "cancelled").length} tone="neutral" />
              </div>
            </>
          )}
        </section>

        <section className="glass-card rounded-md p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-h3 font-semibold text-neutral-950">Budget</h2>
            {overBudget && <Badge color="danger">Over budget</Badge>}
          </div>
          {project.budgetAllocated == null && project.budgetSpent == null ? (
            <p className="mt-4 text-body text-neutral-600">Budget not set. Open Settings to allocate.</p>
          ) : (
            <>
              <div className="mt-3 flex items-baseline justify-between text-body">
                <span className="text-neutral-600">
                  Spent <span className="font-medium text-neutral-950">${budgetSpent.toLocaleString()}</span>
                </span>
                <span className="text-neutral-600">
                  of <span className="font-medium text-neutral-950">${budgetAllocated.toLocaleString()}</span>
                </span>
              </div>
              <div className="mt-2 h-2 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
                <div className={`h-full rounded-full ${overBudget ? "bg-danger-600" : "bg-primary-600"}`} style={{ width: `${budgetPct}%` }} />
              </div>
              <p className="mt-2 text-caption text-neutral-500">{budgetPct}% used</p>
            </>
          )}
        </section>
      </div>

      {/* Team + Milestones two-column */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="glass-card rounded-md p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-h3 font-semibold text-neutral-950">Team ({members.length})</h2>
            <span className="text-caption text-neutral-500">Manage on the Team tab</span>
          </div>
          {members.length === 0 ? (
            <p className="mt-4 text-body text-neutral-600">No members yet — add people from the Team tab.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {members.slice(0, 6).map((m) => (
                <li key={m.personId} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                    {(m.fullName ?? "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body text-neutral-950">{m.fullName ?? "Unknown"}</span>
                  {m.isLead && <Badge color="info">Lead</Badge>}
                  <span className="text-caption text-neutral-500">{m.role ?? m.jobTitle ?? "—"}</span>
                </li>
              ))}
              {members.length > 6 && (
                <li className="text-caption text-neutral-500">+ {members.length - 6} more</li>
              )}
            </ul>
          )}
        </section>

        <section className="glass-card rounded-md p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-h3 font-semibold text-neutral-950">Upcoming milestones</h2>
            <span className="text-caption text-neutral-500">{milestones.length} total</span>
          </div>
          {upcomingMilestones.length === 0 ? (
            <p className="mt-4 text-body text-neutral-600">No open milestones.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-200">
              {upcomingMilestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-body">
                  <span className="min-w-0 flex-1 truncate text-neutral-950">{m.name}</span>
                  <span className="shrink-0 text-caption text-neutral-500">{m.dueDate ?? "No date"}</span>
                  {canApprove && (
                    <button
                      type="button"
                      onClick={() => approve(m.id)}
                      disabled={approvingId === m.id}
                      className="shrink-0 text-caption font-medium text-primary-700 hover:underline"
                    >
                      {approvingId === m.id ? "Approving…" : "Approve"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canCreate && (
            <form onSubmit={addMilestone} className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
              <Input className="min-w-0 flex-1" placeholder="New milestone" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <Button type="submit" disabled={saving || !name}>Add</Button>
            </form>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section className="glass-card rounded-md p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-h3 font-semibold text-neutral-950">Recent activity</h2>
          <span className="text-caption text-neutral-500">See all on the Activity tab</span>
        </div>
        {activity.length === 0 ? (
          <p className="mt-4 text-body text-neutral-600">No activity yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200">
            {activity.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-body">
                <span className="text-neutral-950">
                  <span
                    className={
                      a.actorType === "ai"
                        ? "mr-2 rounded-sm bg-ai-100 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-ai-600"
                        : "mr-2 rounded-sm bg-neutral-200 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-neutral-800"
                    }
                  >
                    {a.actorType}
                  </span>
                  {a.action.replace(/_/g, " ")} · <span className="text-neutral-600">{a.targetType}</span>
                </span>
                <span className="text-small text-neutral-500">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusRow({ status, count, tone }: { status: string; count: number; tone: "success" | "info" | "warning" | "neutral" }) {
  const dot = { success: "bg-success-600", info: "bg-info-600", warning: "bg-warning-600", neutral: "bg-neutral-400" }[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-neutral-700">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {status}
      </span>
      <span className="font-medium text-neutral-950">{count}</span>
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
        <div className="h-1.5 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
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
  peopleById,
}: {
  sprints: Sprint[];
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  peopleById?: Record<string, { fullName: string }>;
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
        <SprintBoard tasks={sprintTasks} canEdit={canEdit} onTaskClick={onTaskClick} onStatusChange={onStatusChange} peopleById={peopleById} />
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

const TASK_VIEWS = ["List", "Board", "Calendar"] as const;
type TaskView = (typeof TASK_VIEWS)[number];

function TasksTab({
  projectId,
  orgId,
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
  onTaskCreated,
  peopleById,
}: {
  projectId: string;
  orgId: string | null;
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onTaskCreated: () => void;
  peopleById?: Record<string, { fullName: string }>;
}) {
  const { can } = useOrg();
  const [view, setView] = useState<TaskView>("List");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [prefillStatus, setPrefillStatus] = useState<string | undefined>(undefined);

  const filtered = tasks.filter(
    (t) =>
      (statusFilter === "all" || t.status === statusFilter) &&
      (priorityFilter === "all" || t.priority === priorityFilter) &&
      (assigneeFilter === "" || (t.assigneeId ?? "").includes(assigneeFilter)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 glass rounded-md p-0.5">
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
          <SprintBoard
            tasks={tasks}
            canEdit={canEdit}
            onTaskClick={onTaskClick}
            onStatusChange={onStatusChange}
            onAddTask={(status) => {
              setPrefillStatus(status);
              setShowNew(true);
            }}
            peopleById={peopleById}
          />
        ))}

      {view === "Calendar" && <TaskCalendarView tasks={tasks} onTaskClick={onTaskClick} />}

      {showNew && orgId && (
        <Modal onClose={() => setShowNew(false)}>
          <NewTaskForm
            orgId={orgId}
            projectId={projectId}
            initialStatus={prefillStatus}
            onClose={() => {
              setShowNew(false);
              setPrefillStatus(undefined);
            }}
            onCreated={() => {
              setShowNew(false);
              setPrefillStatus(undefined);
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
  initialStatus,
  onClose,
  onCreated,
}: {
  orgId: string;
  projectId: string;
  initialStatus?: string;
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
        status: initialStatus || undefined,
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
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [endDate, setEndDate] = useState(project.endDate ?? "");
  const [budgetAllocated, setBudgetAllocated] = useState(project.budgetAllocated?.toString() ?? "");
  const [budgetSpent, setBudgetSpent] = useState(project.budgetSpent?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {};
    if (canUpdate) {
      payload.name = name;
      payload.status = status;
      payload.start_date = startDate || null;
      payload.end_date = endDate || null;
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

  async function archiveProject() {
    if (!confirm("Archive this project? It will be hidden from active lists but not deleted.")) return;
    setArchiving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setArchiving(false);
    onSaved();
  }

  const budgetPct = budgetAllocated && Number(budgetAllocated) > 0
    ? Math.min(100, Math.round((Number(budgetSpent) / Number(budgetAllocated)) * 100))
    : 0;
  const overBudget = budgetAllocated && Number(budgetSpent) > Number(budgetAllocated);

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <section className="glass-card rounded-md p-5">
          <div className="mb-4 border-b border-neutral-200 pb-3">
            <h2 className="font-heading text-h3 font-semibold text-neutral-950">General</h2>
            <p className="mt-0.5 text-caption text-neutral-500">Name, status, and timeline</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project name">
              <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} disabled={!canUpdate} />
            </Field>
            <Field label="Status">
              <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canUpdate}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Start date">
              <Input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canUpdate} />
            </Field>
            <Field label="End date">
              <Input type="date" className="w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canUpdate} />
            </Field>
          </div>
        </section>

        {/* Budget */}
        <section className="glass-card rounded-md p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <h2 className="font-heading text-h3 font-semibold text-neutral-950">Budget</h2>
              <p className="mt-0.5 text-caption text-neutral-500">Manual entry — no finance integration</p>
            </div>
            {overBudget && <Badge color="danger">Over budget</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Allocated ($)">
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
            <Field label="Spent ($)">
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

          {budgetAllocated && Number(budgetAllocated) > 0 && (
            <div className="mt-4">
              <div className="h-2 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={`h-full rounded-full ${overBudget ? "bg-danger-600" : "bg-primary-600"}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="mt-1 text-caption text-neutral-500">{budgetPct}% used</p>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-neutral-400">Org: {orgId}</p>
          {(canUpdate || canUpdateBudget) ? (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <p className="text-caption text-neutral-400">Your role doesn&apos;t allow editing project settings.</p>
          )}
        </div>
      </form>

      {orgId && <PortalAccessSection projectId={project.id} orgId={orgId} />}

      {/* Danger zone */}
      {canUpdate && (
        <section className="rounded-md border border-danger-100 bg-neutral-50 p-5">
          <div className="mb-4 border-b border-neutral-200 pb-3">
            <h2 className="font-heading text-h3 font-semibold text-danger-600">Danger zone</h2>
            <p className="mt-0.5 text-caption text-neutral-500">Reversible actions for a project you&apos;re done with</p>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-body-medium font-medium text-neutral-950">Archive project</p>
              <p className="text-small text-neutral-600">
                Hides from the active projects list. Data is preserved and can be restored by changing status back to Active.
              </p>
            </div>
            <button
              type="button"
              onClick={archiveProject}
              disabled={archiving || status === "archived"}
              className="rounded-md border border-danger-600 px-3 py-1.5 text-small font-medium text-danger-600 hover:bg-danger-100 disabled:opacity-60"
            >
              {archiving ? "Archiving…" : status === "archived" ? "Already archived" : "Archive project"}
            </button>
          </div>
        </section>
      )}
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
        <SectionSkeleton variant="table" />
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

// ─────────────────────────────────────────────────────────────
// Team tab
// ─────────────────────────────────────────────────────────────

type ProjectMemberRow = {
  personId: string;
  role: string | null;
  hoursPerWeek: number | null;
  access: string;
  isLead: boolean;
  fullName: string | null;
  jobTitle: string | null;
};
type OrgPerson = { id: string; fullName: string; jobTitle: string | null; availableHoursPerWeek: number };

function TeamTab({ projectId, orgId, canEdit }: { projectId: string; orgId: string; canEdit: boolean }) {
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [people, setPeople] = useState<OrgPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}/members`).then((r) => r.json()),
      fetch(`/api/team?org_id=${orgId}&active=true`).then((r) => r.json()),
    ])
      .then(([m, p]) => {
        setMembers(m.data ?? []);
        setPeople(p.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(loadAll, [projectId, orgId]);

  async function removeMember(personId: string) {
    if (!confirm("Remove this member from the project?")) return;
    await fetch(`/api/projects/${projectId}/members?person_id=${personId}`, { method: "DELETE" });
    loadAll();
  }

  const availableToAdd = people.filter((p) => !members.some((m) => m.personId === p.id));

  if (loading) return <SectionSkeleton variant="list" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-h3 font-semibold text-neutral-950">Team ({members.length})</h2>
        {canEdit && availableToAdd.length > 0 && (
          <Button onClick={() => setAddOpen(true)}>+ Add member</Button>
        )}
      </div>

      {members.length === 0 ? (
        <div className="glass-card rounded-md border-dashed p-8 text-center">
          <p className="font-medium text-neutral-950">No team members yet</p>
          <p className="mt-1 text-small text-neutral-600">Add people from your Team directory to work on this project.</p>
          {canEdit && availableToAdd.length > 0 && (
            <div className="mt-3 flex justify-center">
              <Button onClick={() => setAddOpen(true)}>+ Add member</Button>
            </div>
          )}
        </div>
      ) : (
        <ul className="glass-table divide-y divide-neutral-200">
          {members.map((m) => (
            <li key={m.personId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                {(m.fullName ?? "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate font-medium text-neutral-950">{m.fullName ?? "Unknown"}</p>
                  {m.isLead && <Badge color="info">Lead</Badge>}
                </div>
                <p className="truncate text-caption text-neutral-500">
                  {m.role ?? m.jobTitle ?? "—"} · {m.access} · {m.hoursPerWeek ? `${m.hoursPerWeek} hrs/wk` : "no capacity set"}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeMember(m.personId)}
                  className="rounded-md p-1.5 text-neutral-500 hover:bg-danger-100 hover:text-danger-600"
                  aria-label="Remove"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <AddProjectMemberModal
          projectId={projectId}
          candidates={availableToAdd}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function AddProjectMemberModal({
  projectId,
  candidates,
  onClose,
  onAdded,
}: {
  projectId: string;
  candidates: OrgPerson[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [personId, setPersonId] = useState(candidates[0]?.id ?? "");
  const [role, setRole] = useState("");
  const [hours, setHours] = useState("");
  const [access, setAccess] = useState<"Admin" | "Editor" | "Viewer">("Editor");
  const [isLead, setIsLead] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personId) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: personId,
        role: role || null,
        hours_per_week: hours ? Number(hours) : null,
        access,
        is_lead: isLead,
      }),
    });
    setSaving(false);
    onAdded();
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="font-heading text-h3 font-semibold text-neutral-950">Add project member</h3>
        <Field label="Person">
          <Select className="w-full" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.jobTitle ? ` — ${p.jobTitle}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role on this project">
            <Input className="w-full" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Developer" />
          </Field>
          <Field label="Hours per week">
            <Input type="number" min="0" className="w-full" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
        <Field label="Access">
          <Select className="w-full" value={access} onChange={(e) => setAccess(e.target.value as "Admin" | "Editor" | "Viewer")}>
            <option value="Admin">Admin</option>
            <option value="Editor">Editor</option>
            <option value="Viewer">Viewer</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-body text-neutral-800">
          <input type="checkbox" checked={isLead} onChange={(e) => setIsLead(e.target.checked)} />
          Mark as project lead
        </label>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !personId}>{saving ? "Adding…" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Activity tab
// ─────────────────────────────────────────────────────────────

type ActivityRow = { id: string; actorType: "human" | "ai"; actorUserId: string | null; action: string; targetType: string; createdAt: string };

function ActivityTab({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/activity`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <SectionSkeleton variant="list" />;
  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-md border-dashed p-8 text-center">
        <p className="font-medium text-neutral-950">No activity yet</p>
        <p className="mt-1 text-small text-neutral-600">Every change on this project — status flips, assignments, comments — shows here as it happens.</p>
      </div>
    );
  }
  return (
    <ul className="glass-table divide-y divide-neutral-200">
      {rows.map((a) => (
        <li key={a.id} className="flex items-center justify-between px-4 py-3 text-body">
          <span className="text-neutral-950">
            <span
              className={
                a.actorType === "ai"
                  ? "mr-2 rounded-sm bg-ai-100 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-ai-600"
                  : "mr-2 rounded-sm bg-neutral-200 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-neutral-800"
              }
            >
              {a.actorType}
            </span>
            {a.action.replace(/_/g, " ")} · <span className="text-neutral-600">{a.targetType}</span>
          </span>
          <span className="text-small text-neutral-600">{new Date(a.createdAt).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
