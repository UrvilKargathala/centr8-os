"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { AiBanner } from "@/components/ui/AiBanner";
import { KpiCard } from "@/components/ui/KpiCard";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { generateAI } from "@/lib/ai/generate";
import { TASK_PRIORITIES } from "@/lib/constants";

type Row = {
  id: string;
  projectId: string;
  sprintId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
};
type Counts = {
  total: number;
  pending: number;
  in_progress: number;
  in_review: number;
  completed: number;
  overdue: number;
  trend_total: number;
  trend_completed: number;
};
type Project = { id: string; name: string };
type Person = { id: string; fullName: string; jobTitle: string | null };

type Tab = "all" | "pending" | "in_progress" | "in_review" | "completed" | "overdue";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
];

const EMPTY_COPY: Record<Tab, string> = {
  all: "No tasks yet — create your first task to get started",
  pending: "No pending tasks",
  in_progress: "No tasks currently in progress",
  in_review: "No tasks in review",
  completed: "No completed tasks yet",
  overdue: "No overdue tasks — you're on track",
};

// URL query params drive tab, project, priority, assignee, q so the page
// state is bookmarkable.
function tabToParams(tab: Tab) {
  if (tab === "all") return {} as Record<string, string>;
  if (tab === "overdue") return { overdue_only: "true" };
  const map: Record<Tab, string> = { all: "", pending: "todo", in_progress: "in_progress", in_review: "in_review", completed: "done", overdue: "" };
  return { status: map[tab] };
}

export default function TasksPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="table" />}>
      <TasksInner />
    </Suspense>
  );
}

function TasksInner() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const tab = (searchParams.get("tab") as Tab) || "all";
  const projectFilter = searchParams.get("project") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const assigneeFilter = searchParams.get("assignee") || "";
  const searchFromUrl = searchParams.get("q") || "";

  const [q, setQ] = useState(searchFromUrl);
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const peopleById = useMemo(() => {
    const m: Record<string, Person> = {};
    for (const p of people) m[p.id] = p;
    return m;
  }, [people]);

  // Debounced search value → URL (300ms).
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      router.replace(`?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.replace(`?${params.toString()}`);
  }

  const loadAll = useCallback(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    const listParams = new URLSearchParams({ org_id: selectedOrgId });
    Object.entries(tabToParams(tab)).forEach(([k, v]) => v && listParams.set(k, v));
    if (projectFilter) listParams.set("project", projectFilter);
    if (priorityFilter) listParams.set("priority", priorityFilter);
    if (assigneeFilter) listParams.set("assignee_id", assigneeFilter);
    if (searchFromUrl) listParams.set("q", searchFromUrl);

    Promise.all([
      fetch(`/api/tasks?${listParams}`).then((r) => r.json()),
      fetch(`/api/tasks/counts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/projects?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/team?org_id=${selectedOrgId}&active=true`).then((r) => r.json()),
    ])
      .then(([tBody, cBody, pBody, teamBody]) => {
        setRows(tBody.data ?? []);
        setCounts(cBody.data ?? null);
        setProjects(pBody.data ?? []);
        setPeople(teamBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [selectedOrgId, tab, projectFilter, priorityFilter, assigneeFilter, searchFromUrl]);

  useEffect(loadAll, [loadAll]);

  // Cmd+K to focus search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { page, setPage, pageSize, total, paged } = usePagination(rows, 10);

  const anyFilterActive = !!(projectFilter || priorityFilter || assigneeFilter);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";

  async function handleDelete(id: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.show("Task deleted");
      loadAll();
    } else {
      toast.show("Failed to delete", "error");
    }
  }

  async function bulkSetStatus(status: string) {
    const ids = [...selected];
    await Promise.all(ids.map((id) =>
      fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    ));
    setSelected(new Set());
    toast.show(`${ids.length} task${ids.length > 1 ? "s" : ""} → ${status.replace("_", " ")}`);
    loadAll();
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!confirm(`Delete ${ids.length} task${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    toast.show(`${ids.length} task${ids.length > 1 ? "s" : ""} deleted`);
    loadAll();
  }

  if (orgLoading || !selectedOrgId) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Tasks</h1>
          <p className="mt-1 text-body text-neutral-600">All tasks across your projects</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              ref={searchRef}
              className="w-64 pl-8"
              placeholder="Search tasks…  ⌘K"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </div>
          {can("task", "create") && <Button onClick={() => setShowNew(true)}>+ New Task</Button>}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiClickCard title="Total tasks" value={counts?.total ?? 0} trend={counts?.trend_total ?? 0} onClick={() => setParam("tab", "all")} tone="neutral" />
        <KpiClickCard title="Pending" value={counts?.pending ?? 0} onClick={() => setParam("tab", "pending")} tone="warning" />
        <KpiClickCard title="In progress" value={counts?.in_progress ?? 0} onClick={() => setParam("tab", "in_progress")} tone="info" />
        <KpiClickCard title="Completed" value={counts?.completed ?? 0} trend={counts?.trend_completed ?? 0} onClick={() => setParam("tab", "completed")} tone="success" />
      </div>

      {/* Tab bar + secondary filters */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex shrink-0 gap-1 glass rounded-md p-0.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            const n =
              t.id === "all" ? counts?.total :
              t.id === "pending" ? counts?.pending :
              t.id === "in_progress" ? counts?.in_progress :
              t.id === "in_review" ? counts?.in_review :
              t.id === "completed" ? counts?.completed :
              counts?.overdue;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setParam("tab", t.id)}
                className={`rounded-sm px-3 py-1.5 text-body-medium font-medium transition-colors ${
                  active ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {t.label} {n != null && <span className="text-caption text-neutral-500">({n})</span>}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select value={projectFilter} onChange={(e) => setParam("project", e.target.value || null)} className="w-40">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select value={priorityFilter} onChange={(e) => setParam("priority", e.target.value || null)} className="w-32">
            <option value="">Any priority</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          <Select value={assigneeFilter} onChange={(e) => setParam("assignee", e.target.value || null)} className="w-40">
            <option value="">Any assignee</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </Select>
          {anyFilterActive && (
            <button
              type="button"
              onClick={() => {
                setParam("project", null);
                setParam("priority", null);
                setParam("assignee", null);
              }}
              className="text-small text-primary-700 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <SectionSkeleton variant="table" />
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>{EMPTY_COPY[tab]}</EmptyTitle>
            <EmptyDescription>Filters and search all keep working — clear them if the tab feels wrong.</EmptyDescription>
          </EmptyHeader>
          {can("task", "create") && tab !== "overdue" && (
            <div className="mt-3 flex justify-center">
              <Button onClick={() => setShowNew(true)}>+ New Task</Button>
            </div>
          )}
        </Empty>
      ) : (
        <>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-primary-600 bg-primary-100 px-4 py-2">
            <span className="text-body-medium font-medium text-primary-700">{selected.size} selected</span>
            <Select className="w-36" defaultValue="" onChange={(e) => { if (e.target.value) bulkSetStatus(e.target.value); e.target.value = ""; }}>
              <option value="" disabled>Set status…</option>
              <option value="todo">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
            </Select>
            {can("task", "delete") && (
              <button type="button" onClick={bulkDelete} className="text-small font-medium text-danger-600 hover:underline">Delete</button>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-small text-neutral-600 hover:underline">Clear</button>
          </div>
        )}
        <div className="overflow-x-auto glass-table">
          <table className="w-full min-w-[960px] text-body">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </th>
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Assignee</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2 text-right">Est</th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {paged.map((r) => {
                const overdue = r.dueDate && r.dueDate < new Date().toISOString().slice(0, 10) && r.status !== "done" && r.status !== "cancelled";
                const person = r.assigneeId ? peopleById[r.assigneeId] : null;
                const flash = flashId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenTaskId(r.id)}
                    className={`cursor-pointer transition-colors ${flash ? "bg-primary-100" : overdue ? "bg-danger-100/40 hover:bg-danger-100" : "hover:bg-neutral-100"}`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.id); else next.delete(r.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-950">{r.title}</p>
                      <p className="text-caption text-neutral-500">{projectName(r.projectId)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {person ? (
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                            {person.fullName.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <span className="text-small">{person.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-small text-neutral-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><TaskPriorityBadge priority={r.priority} /></td>
                    <td className="px-4 py-3"><TaskStatusBadge status={r.status} /></td>
                    <td className={`px-4 py-3 text-small ${overdue ? "font-medium text-danger-600" : "text-neutral-700"}`}>
                      {r.dueDate ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-small text-neutral-700">{r.estimate ?? "—"}</td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {can("task", "delete") && (
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          aria-label="Delete"
                          className="rounded-md p-1 text-neutral-500 hover:bg-danger-100 hover:text-danger-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
        </>
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

      {showNew && selectedOrgId && (
        <QuickNewTaskModal
          orgId={selectedOrgId}
          projects={projects}
          people={people}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            loadAll();
            setFlashId(id);
            setTimeout(() => setFlashId(null), 2000);
            toast.show("Task created");
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI click card with trend
// ─────────────────────────────────────────────────────────────

function KpiClickCard({
  title,
  value,
  trend,
  onClick,
  tone,
}: {
  title: string;
  value: number;
  trend?: number;
  onClick: () => void;
  tone: "neutral" | "success" | "info" | "warning" | "danger";
}) {
  const trendProp =
    trend !== undefined && trend !== 0
      ? { text: `${trend > 0 ? "+" : ""}${trend} this week`, positive: trend > 0 }
      : undefined;
  return (
    <button type="button" onClick={onClick} className="h-full text-left transition hover:scale-[1.01]">
      <KpiCard title={title} value={value} pattern={value} tone={tone} trend={trendProp} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick-add task modal
// ─────────────────────────────────────────────────────────────

type Sprint = { id: string; name: string; projectId: string };

function QuickNewTaskModal({
  orgId,
  projects,
  people,
  onClose,
  onCreated,
}: {
  orgId: string;
  projects: Project[];
  people: Person[];
  onClose: () => void;
  onCreated: (newTaskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintId, setSprintId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ai, setAi] = useState<{ subtask_titles: string[]; reasoning: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPicked, setAiPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) return setSprints([]);
    fetch(`/api/sprints?project_id=${projectId}`)
      .then((r) => r.json())
      .then((b) => setSprints(b.data ?? []));
  }, [projectId]);

  async function runAi() {
    setAiLoading(true);
    const r = (await generateAI("Planner", "suggest_task_breakdown", { title, projectId })) as {
      subtask_titles: string[];
      reasoning: string;
    };
    setAi(r);
    setAiPicked(new Set(r.subtask_titles));
    setAiLoading(false);
  }
  async function acceptAi() {
    if (!ai || !orgId) return;
    const subtasks = [...aiPicked];
    await Promise.all(
      subtasks.map((s) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: orgId,
            project_id: projectId,
            sprint_id: sprintId || null,
            title: s,
            assignee_id: assigneeId || null,
            priority,
          }),
        }),
      ),
    );
    setAi(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !projectId) return;
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        project_id: projectId,
        sprint_id: sprintId || null,
        title,
        description: description || null,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        estimate: estimate ? Number(estimate) : null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(body.error ?? "Failed to create task");
    onCreated(body.data.id);
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="font-heading text-h2 font-semibold text-neutral-950">New task</h2>
        {err && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{err}</p>}

        <Field label="Title *">
          <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project *">
            <Select className="w-full" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sprint">
            <Select className="w-full" value={sprintId} onChange={(e) => setSprintId(e.target.value)} disabled={!projectId}>
              <option value="">Backlog (no sprint)</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assignee">
            <Select className="w-full" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Segmented
              value={priority}
              onChange={(v) => setPriority(v)}
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Med" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
            />
          </Field>
          <Field label="Due date">
            <Input type="date" className="w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Estimate (hrs)">
            <Input type="number" className="w-full" min="0" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea rows={2} className="w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note — full description later" />
        </Field>

        {title && projectId && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={runAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
              </svg>
              {aiLoading ? "Thinking…" : "AI: Suggest breakdown"}
            </button>
            {ai && (
              <div className="space-y-2 overflow-hidden rounded-md border border-ai-600/40">
                <AiBanner />
                <div className="space-y-2 px-4 pb-3">
                  <ul className="space-y-1">
                    {ai.subtask_titles.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-body">
                        <input
                          type="checkbox"
                          checked={aiPicked.has(s)}
                          onChange={(e) => {
                            const next = new Set(aiPicked);
                            if (e.target.checked) next.add(s);
                            else next.delete(s);
                            setAiPicked(next);
                          }}
                        />
                        <span className="text-neutral-800">{s}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-small text-neutral-600">{ai.reasoning}</p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={acceptAi}>Accept selected</Button>
                    <Button type="button" variant="secondary" onClick={() => setAi(null)}>Reject</Button>
                  </div>
                  <p className="text-caption text-neutral-500">
                    Accepted subtasks are created as tasks in the same project.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !title || !projectId}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
