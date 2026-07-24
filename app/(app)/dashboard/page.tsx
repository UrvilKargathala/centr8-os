"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { createClient } from "@/lib/supabase/client";
import { ProjectStatusBadge, projectStatusColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Card, CardLink } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { AiBanner } from "@/components/ui/AiBanner";
import { generateAI } from "@/lib/ai/generate";
import { TaskCalendarView } from "@/components/TaskCalendarView";
import type { Task } from "@/components/TaskCard";
import { TASK_STATUSES, TASK_STATUS_PROGRESS } from "@/lib/constants";

type Project = { id: string; name: string; status: string };
type Sprint = { id: string; projectId: string; name: string; status: string };
type AuditEntry = {
  id: string;
  actorType: "human" | "ai";
  actorUserId: string | null;
  action: string;
  targetType: string;
  createdAt: string;
};

export default function DashboardPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [allTasks, setAllTasks] = useState<(Task & { projectId: string })[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [planiqQ, setPlaniqQ] = useState("");
  const [planiqAnswer, setPlaniqAnswer] = useState<string | null>(null);
  const [planiqLoading, setPlaniqLoading] = useState(false);

  async function askPlaniq(q: string) {
    if (!q.trim()) return;
    setPlaniqQ(q);
    setPlaniqLoading(true);
    setPlaniqAnswer(null);
    const a = (await generateAI("Analyst", "ask", { question: q })) as string;
    setPlaniqAnswer(a);
    setPlaniqLoading(false);
  }

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/projects?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/audit-log?org_id=${selectedOrgId}&limit=15`).then((r) => r.json()),
    ])
      .then(async ([projectsBody, activityBody]) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        setProjects(projectsBody.data);
        setActivity(activityBody.data ?? []);

        // No aggregate "task counts by status across the org" endpoint
        // exists — tasks are always scoped to a project or sprint. Same
        // per-project fetch-and-aggregate pattern as the project list's
        // milestone counts.
        const perProject = await Promise.all(
          projectsBody.data.map((p: Project) =>
            Promise.all([
              fetch(`/api/tasks?project_id=${p.id}`).then((r) => r.json()).then((b) => (b.data ?? []) as Task[]).catch(() => []),
              fetch(`/api/sprints?project_id=${p.id}`).then((r) => r.json()).then((b) => (b.data ?? []) as Sprint[]).catch(() => []),
            ]).then(([tasks, sprints]) => ({ project: p, tasks, sprints })),
          ),
        );
        const counts: Record<string, number> = {};
        for (const status of TASK_STATUSES) counts[status] = 0;
        for (const { tasks } of perProject) for (const t of tasks as Task[]) counts[t.status] = (counts[t.status] ?? 0) + 1;
        setTaskCounts(counts);
        setAllTasks(perProject.flatMap(({ project, tasks }) => (tasks as Task[]).map((t) => ({ ...t, projectId: project.id, projectName: project.name }))));
        setSprints(perProject.flatMap(({ sprints }) => sprints));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const activeProjects = projects.filter((p) => p.status === "active");

  const totalTasks = TASK_STATUSES.reduce((sum, s) => sum + (taskCounts[s] ?? 0), 0);
  const doneCount = taskCounts.done ?? 0;
  const pendingCount = totalTasks - doneCount - (taskCounts.cancelled ?? 0);
  const avgProgress = totalTasks
    ? Math.round(
        TASK_STATUSES.reduce((sum, s) => sum + (taskCounts[s] ?? 0) * TASK_STATUS_PROGRESS[s], 0) / totalTasks,
      )
    : 0;

  // AI-recommended actions derived from real state. Each has a `do` that
  // either PATCHes something or navigates — no mock-only buttons that
  // silently do nothing.
  type Recommendation = { id: string; label: string; sub: string; href?: string; do?: () => Promise<void> };
  const recommendations: Recommendation[] = [];
  const unassigned = allTasks.filter((t) => !t.assigneeId && t.status !== "done" && t.status !== "cancelled");
  if (unassigned.length > 0) {
    const byProject = new Map<string, number>();
    for (const t of unassigned) byProject.set(t.projectName ?? t.projectId, (byProject.get(t.projectName ?? t.projectId) ?? 0) + 1);
    const [topProject, count] = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];
    const projId = allTasks.find((t) => (t.projectName ?? t.projectId) === topProject)?.projectId;
    recommendations.push({
      id: "assign",
      label: `Assign ${count} unassigned task${count === 1 ? "" : "s"} in ${topProject}`,
      sub: "Unassigned tasks stall silently — the project lead can pick them up.",
      href: projId ? `/projects/${projId}` : "/tasks",
    });
  }
  const plannedSprint = sprints.find((s) => s.status === "planned");
  if (plannedSprint) {
    recommendations.push({
      id: "start-sprint",
      label: `Start ${plannedSprint.name}`,
      sub: "This sprint has been planned but never activated.",
      do: async () => {
        await fetch(`/api/sprints/${plannedSprint.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        });
        window.location.reload();
      },
    });
  }
  const noDueDate = allTasks.filter((t) => !t.dueDate && t.status !== "done" && t.status !== "cancelled");
  if (noDueDate.length > 0 && recommendations.length < 3) {
    recommendations.push({
      id: "due-dates",
      label: `Set due dates on ${noDueDate.length} task${noDueDate.length === 1 ? "" : "s"}`,
      sub: "Tasks without due dates don't appear in Calendar or Deadlines views.",
      href: "/tasks",
    });
  }
  const stalePlanning = projects.filter((p) => p.status === "planning");
  if (stalePlanning.length > 0 && recommendations.length < 3) {
    recommendations.push({
      id: "activate-project",
      label: `Move ${stalePlanning[0].name} out of Planning`,
      sub: "Once scope is set, flip status to Active so it shows in reports.",
      href: `/projects/${stalePlanning[0].id}`,
    });
  }
  const activeSprint = sprints.find((s) => s.status === "active");

  const calendarTasks: Task[] = allTasks.filter((t) => t.dueDate);

  // Activity per day for the last 7 calendar days. Buckets audit entries by
  // local day (not UTC — same reason the calendar view uses local ISO).
  const activityPerDay = (() => {
    const days: {
      label: string;
      iso: string;
      count: number;
      human: number;
      ai: number;
      topAction: string | null;
      full: string;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        iso,
        count: 0,
        human: 0,
        ai: 0,
        topAction: null,
        full: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }),
      });
    }
    const actionCounts = new Map<string, Map<string, number>>();
    for (const a of activity) {
      const d = new Date(a.createdAt);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const bucket = days.find((x) => x.iso === iso);
      if (!bucket) continue;
      bucket.count++;
      if (a.actorType === "ai") bucket.ai++;
      else bucket.human++;
      if (!actionCounts.has(iso)) actionCounts.set(iso, new Map());
      const m = actionCounts.get(iso)!;
      m.set(a.action, (m.get(a.action) ?? 0) + 1);
    }
    for (const day of days) {
      const m = actionCounts.get(day.iso);
      if (m) day.topAction = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    return days;
  })();
  const activityMax = Math.max(1, ...activityPerDay.map((d) => d.count));

  const firstName = email ? email.split("@")[0].split(/[._-]/)[0] : null;
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">
          {displayName ? `Welcome, ${displayName}` : "Welcome"}
        </h1>
        <p className="mt-1 text-body text-neutral-600">Check out the latest updates.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Active projects" value={activeProjects.length} pattern={activeProjects.length} tone="primary" />
        <KpiCard title="Tasks in flight" value={pendingCount} pattern={pendingCount} tone="info" />
        <KpiCard title="Tasks done" value={doneCount} pattern={doneCount} tone="success" />
        <KpiCard title="Avg. progress" value={`${avgProgress}%`} pattern={Math.round(avgProgress / 5)} tone="warning" />
      </div>

      <section className="overflow-hidden rounded-md border border-ai-600/40 bg-neutral-50">
        <AiBanner label="AI PlanIQ" />
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <p className="text-body text-neutral-800">
              Good morning{displayName ? `, ${displayName}` : ""}. How can I assist you today?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={planiqQ}
                onChange={(e) => setPlaniqQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") askPlaniq(planiqQ);
                }}
                placeholder="Ask me anything about the workspace…"
                className="flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-body focus:border-primary-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => askPlaniq(planiqQ)}
                disabled={planiqLoading || !planiqQ.trim()}
                className="rounded-md bg-primary-600 px-3 py-2 text-small font-medium text-neutral-50 hover:bg-primary-700 disabled:opacity-60"
              >
                {planiqLoading ? "Thinking…" : "Ask"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {["What's overdue?", "Which project is at risk?", "Who's overloaded?"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askPlaniq(q)}
                  className="rounded-full border border-ai-600/40 bg-ai-100 px-3 py-1 text-caption font-medium text-ai-600 hover:bg-ai-100/70"
                >
                  {q}
                </button>
              ))}
            </div>
            {planiqAnswer && <p className="rounded-md border border-neutral-300 bg-neutral-100 p-3 text-body text-neutral-800">{planiqAnswer}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/tasks"
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-center hover:bg-neutral-100"
            >
              <svg className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-caption font-medium text-neutral-800">Task Overview</span>
            </Link>
            <Link
              href="/executive"
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-center hover:bg-neutral-100"
            >
              <svg className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14" />
              </svg>
              <span className="text-caption font-medium text-neutral-800">Project Efficiency</span>
            </Link>
            <Link
              href="/hr/reviews"
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-center hover:bg-neutral-100"
            >
              <svg className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8" />
              </svg>
              <span className="text-caption font-medium text-neutral-800">Team Performance</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-h3 font-semibold text-neutral-800">AI recommended actions</h2>
            <span className="rounded-full bg-ai-100 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-ai-600">
              AI
            </span>
          </div>
          {recommendations.length === 0 ? (
            <p className="rounded-md border border-neutral-300 bg-neutral-50 p-4 text-body text-neutral-600">
              Nothing to act on right now — everything is assigned, sprints are moving, and dates are set.
            </p>
          ) : (
            <ul className="space-y-2">
              {recommendations.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-md border border-ai-600/40 bg-neutral-50 p-3">
                  <p className="text-body-medium font-medium text-neutral-950">{r.label}</p>
                  <p className="mt-0.5 text-small text-neutral-600">{r.sub}</p>
                  <div className="mt-2 flex gap-2">
                    {r.do ? (
                      <button
                        type="button"
                        onClick={() => r.do?.()}
                        className="rounded-md bg-primary-600 px-2.5 py-1 text-small font-medium text-neutral-50 hover:bg-primary-700"
                      >
                        Do it
                      </button>
                    ) : r.href ? (
                      <Link
                        href={r.href}
                        className="rounded-md bg-primary-600 px-2.5 py-1 text-small font-medium text-neutral-50 hover:bg-primary-700"
                      >
                        Do it
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-small font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {activeSprint && (
            <div className="rounded-md border border-neutral-300 bg-neutral-50 p-3">
              <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Active sprint</p>
              <Link href="/sprints" className="mt-0.5 block text-body-medium font-medium text-neutral-950 hover:underline">
                {activeSprint.name}
              </Link>
              <p className="text-small text-neutral-600">
                {allTasks.filter((t) => t.sprintId === activeSprint.id && t.status === "done").length}/
                {allTasks.filter((t) => t.sprintId === activeSprint.id).length} tasks done
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-h3 font-semibold text-neutral-800">This month at a glance</h2>
          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-3">
            <TaskCalendarView tasks={calendarTasks} onTaskClick={() => {}} />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-h3 font-semibold text-neutral-800">Activity — last 7 days</h2>
          <span className="text-caption text-neutral-600">
            {activityPerDay.reduce((s, d) => s + d.count, 0)} events
          </span>
        </div>
        <Card>
          <div className="grid grid-cols-7 gap-3">
            {activityPerDay.map((d) => {
              const h = (d.count / activityMax) * 100;
              return (
                <div key={d.iso} className="group relative flex flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end">
                    <div
                      className={`w-full rounded-t-sm transition ${
                        d.count > 0 ? "bg-primary-600 group-hover:bg-primary-700" : "bg-neutral-200"
                      }`}
                      style={{ height: `${Math.max(4, h)}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-body-medium font-medium text-neutral-950">{d.count}</p>
                    <p className="text-caption text-neutral-500">{d.label}</p>
                  </div>
                  <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-md border border-neutral-300 bg-neutral-950 p-2.5 text-left opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                    <p className="text-caption font-semibold text-neutral-50">{d.full}</p>
                    <p className="mt-1 text-caption text-neutral-300">
                      {d.count} event{d.count === 1 ? "" : "s"}
                    </p>
                    {d.count > 0 && (
                      <div className="mt-1.5 space-y-0.5 text-caption text-neutral-300">
                        <div className="flex justify-between">
                          <span>Human</span>
                          <span className="text-neutral-50">{d.human}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AI</span>
                          <span className="text-neutral-50">{d.ai}</span>
                        </div>
                        {d.topAction && (
                          <div className="mt-1 border-t border-neutral-700 pt-1">
                            <span className="text-neutral-400">Top: </span>
                            <span className="text-neutral-50">{d.topAction.replace(/_/g, " ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-neutral-950" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-h3 font-semibold text-neutral-800">Project overview</h2>
          <div className="flex items-center gap-3 text-caption text-neutral-600">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success-600" /> Done</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-info-600" /> In progress</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-neutral-300" /> Pending</span>
          </div>
        </div>
        <Card>
          {projects.length === 0 ? (
            <p className="text-body text-neutral-600">No projects yet.</p>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => {
                const pTasks = allTasks.filter((t) => t.projectId === p.id);
                const total = pTasks.length;
                const done = pTasks.filter((t) => t.status === "done").length;
                const inProg = pTasks.filter((t) => t.status === "in_progress" || t.status === "in_review").length;
                const pending = total - done - inProg - pTasks.filter((t) => t.status === "cancelled").length;
                const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
                return (
                  <li key={p.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/projects/${p.id}`} className="min-w-0 truncate text-body-medium font-medium text-neutral-950 hover:underline">
                        {p.name}
                      </Link>
                      <span className="shrink-0 text-caption text-neutral-600">
                        {done}/{total} done
                      </span>
                    </div>
                    {total > 0 ? (
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div className="bg-success-600" style={{ width: `${pct(done)}%` }} />
                        <div className="bg-info-600" style={{ width: `${pct(inProg)}%` }} />
                        <div className="bg-neutral-300" style={{ width: `${pct(pending)}%` }} />
                      </div>
                    ) : (
                      <div className="h-2 w-full rounded-full bg-neutral-200" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-h3 font-semibold text-neutral-800">Active projects</h2>
          <Button href="/projects" variant="secondary">
            View all →
          </Button>
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-body text-neutral-600">No active projects.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((p) => (
              <CardLink key={p.id} href={`/projects/${p.id}`} color={projectStatusColor(p.status)} padding="sm" className="flex items-center justify-between">
                <span className="text-body-medium font-medium text-neutral-950">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
              </CardLink>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-h3 font-semibold text-neutral-800">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-body text-neutral-600">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-body">
                <span className="text-neutral-950">
                  {/* No user-directory endpoint exists (same gap as task
                      assignee) — actor is shown by type, not resolved name. */}
                  <span
                    className={
                      a.actorType === "ai"
                        ? "mr-2 rounded-sm bg-ai-100 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-ai-600"
                        : "mr-2 rounded-sm bg-neutral-200 px-1.5 py-0.5 text-caption font-medium uppercase tracking-wide text-neutral-800"
                    }
                  >
                    {a.actorType}
                  </span>
                  {a.action.replace(/_/g, " ")} · {a.targetType}
                </span>
                <span className="text-small text-neutral-600">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
