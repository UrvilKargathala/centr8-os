"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { ProjectStatusBadge, Badge, projectStatusColor } from "@/components/ui/Badge";
import { CardLink } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { AiBanner } from "@/components/ui/AiBanner";
import { KpiCard } from "@/components/ui/KpiCard";
import { generateAI } from "@/lib/ai/generate";

type Project = {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

type HealthSnapshot = {
  projectId: string;
  aiSummary: string;
  signals: { overdueTasks: number; blockedTasks: number };
};

export default function ProjectsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestoneCounts, setMilestoneCounts] = useState<Record<string, number>>({});
  const [taskProgress, setTaskProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [health, setHealth] = useState<Record<string, HealthSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [taskDeadlines, setTaskDeadlines] = useState<
    { projectId: string; projectName: string; taskId: string; taskTitle: string; dueDate: string }[]
  >([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/projects?org_id=${selectedOrgId}`).then((r) => r.json()),
      // Real health data, per Prompt 0.2's "health indicator (mock value for
      // now)" — Prompt 1.6 already built this for real, so there's no
      // reason to fake it here.
      fetch(`/api/ai/project-health?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(async ([projectsBody, healthBody]) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        const list: Project[] = projectsBody.data;
        setProjects(list);

        const healthMap: Record<string, HealthSnapshot> = {};
        if (healthBody.data) {
          for (const snap of healthBody.data) healthMap[snap.projectId] = snap;
        }
        setHealth(healthMap);

        const counts = await Promise.all(
          list.map((p) =>
            fetch(`/api/milestones?project_id=${p.id}`)
              .then((r) => r.json())
              .then((b) => [p.id, (b.data ?? []).length] as const)
              .catch(() => [p.id, 0] as const),
          ),
        );
        setMilestoneCounts(Object.fromEntries(counts));

        const perProject = await Promise.all(
          list.map((p) =>
            fetch(`/api/tasks?project_id=${p.id}`)
              .then((r) => r.json())
              .then((b) => {
                const tasks: { id: string; title: string; status: string; dueDate: string | null }[] = b.data ?? [];
                return { project: p, tasks };
              })
              .catch(() => ({ project: p, tasks: [] as { id: string; title: string; status: string; dueDate: string | null }[] })),
          ),
        );
        setTaskProgress(
          Object.fromEntries(
            perProject.map(({ project, tasks }) => [
              project.id,
              { done: tasks.filter((t) => t.status === "done").length, total: tasks.length },
            ]),
          ),
        );
        setTaskDeadlines(
          perProject.flatMap(({ project, tasks }) =>
            tasks
              .filter((t) => t.dueDate && t.status !== "done" && t.status !== "cancelled")
              .map((t) => ({
                projectId: project.id,
                projectName: project.name,
                taskId: t.id,
                taskTitle: t.title,
                dueDate: t.dueDate!,
              })),
          ),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const kpis = useMemo(() => {
    const active = projects.filter((p) => p.status === "active").length;
    const planning = projects.filter((p) => p.status === "planning").length;
    let atRisk = 0;
    for (const snap of Object.values(health)) {
      if (snap.signals.overdueTasks > 0 || snap.signals.blockedTasks > 0) atRisk++;
    }
    return { total: projects.length, active, planning, atRisk };
  }, [projects, health]);

  const filteredProjects = projects;

  // Combine project end-dates + task due-dates into one deadline stream, drop
  // anything already past, sort nearest first, take the top 5.
  const upcomingDeadlines = useMemo(() => {
    type D = { kind: "project" | "task"; title: string; sub: string; date: string; href: string };
    const items: D[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const p of projects) {
      if (p.endDate) items.push({ kind: "project", title: p.name, sub: "project ends", date: p.endDate, href: `/projects/${p.id}` });
    }
    for (const d of taskDeadlines) {
      items.push({ kind: "task", title: d.taskTitle, sub: d.projectName, date: d.dueDate, href: `/projects/${d.projectId}` });
    }
    return items
      .filter((i) => new Date(i.date + "T00:00:00") >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [projects, taskDeadlines]);

  function daysUntil(iso: string) {
    const t = new Date(iso + "T00:00:00").getTime();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((t - now.getTime()) / 86400000);
  }
  function daysLabel(iso: string) {
    const d = daysUntil(iso);
    if (d === 0) return "Today";
    if (d === 1) return "Tomorrow";
    if (d <= 7) return `${d} days`;
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  function daysTone(iso: string): "danger" | "warning" | "neutral" {
    const d = daysUntil(iso);
    if (d <= 2) return "danger";
    if (d <= 7) return "warning";
    return "neutral";
  }

  async function runAiSummary() {
    setAiLoading(true);
    setAiSummary(null);
    const s = (await generateAI("Writer", "deadline_summary", {
      deadlines: upcomingDeadlines.map((d) => ({ title: d.title, days: daysUntil(d.date), kind: d.kind, sub: d.sub })),
    })) as string;
    setAiSummary(s);
    setAiLoading(false);
  }

  if (orgLoading || loading) {
    return <p className="text-body text-neutral-600">Loading projects…</p>;
  }

  if (!selectedOrgId) {
    return <p className="text-body text-neutral-600">No organization selected.</p>;
  }

  if (error) {
    return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Projects</h1>
        {can("project", "create") && <Button onClick={() => setShowNewProject(true)}>+ New Project</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Total projects" value={kpis.total} pattern={kpis.total} tone="neutral" />
        <KpiCard title="Active" value={kpis.active} pattern={kpis.active} tone="success" />
        <KpiCard title="Planning" value={kpis.planning} pattern={kpis.planning} tone="info" />
        <KpiCard title="At risk" value={kpis.atRisk} pattern={kpis.atRisk} tone="danger" />
      </div>

      <div className="space-y-2 rounded-md border border-ai-600/40 bg-neutral-50 p-4">
        <AiBanner label="AI: What's coming up" />
        {aiSummary ? (
          <p className="text-body text-neutral-800">{aiSummary}</p>
        ) : upcomingDeadlines.length === 0 ? (
          <p className="text-body text-neutral-600">Nothing due — add task due-dates or project end-dates so AI can flag what needs attention.</p>
        ) : (
          <p className="text-body text-neutral-600">
            {upcomingDeadlines.length} deadline{upcomingDeadlines.length === 1 ? "" : "s"} in the next stretch.
            Ask AI to summarize what needs your attention and what can wait.
          </p>
        )}
        <button
          type="button"
          onClick={runAiSummary}
          disabled={aiLoading || upcomingDeadlines.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
        >
          {aiLoading ? "Thinking…" : aiSummary ? "Regenerate" : "AI: Summarize deadlines"}
        </button>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setView("grid")}
          title="Grid view"
          aria-label="Grid view"
          className={`rounded-md p-2 ${view === "grid" ? "bg-primary-100 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          title="List view"
          aria-label="List view"
          className={`rounded-md p-2 ${view === "list" ? "bg-primary-100 text-primary-700" : "text-neutral-500 hover:bg-neutral-100"}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <p className="text-body text-neutral-600">
          {projects.length === 0 ? "No projects yet." : "No projects match this filter."}
        </p>
      ) : view === "list" ? (
        <div className="overflow-x-auto rounded-md border border-neutral-300">
          <table className="w-full min-w-[640px] text-body">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Milestones</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-neutral-50">
              {filteredProjects.map((project) => {
                const progress = taskProgress[project.id];
                const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
                const snapshot = health[project.id];
                const overdue = snapshot?.signals.overdueTasks ?? 0;
                const blocked = snapshot?.signals.blockedTasks ?? 0;
                return (
                  <tr
                    key={project.id}
                    onClick={() => (window.location.href = `/projects/${project.id}`)}
                    className="cursor-pointer hover:bg-neutral-100"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-950">{project.name}</td>
                    <td className="px-4 py-3">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{milestoneCounts[project.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      {progress && progress.total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
                            <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-small text-neutral-600">{pct}%</span>
                        </div>
                      ) : (
                        <span className="text-small text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!snapshot ? (
                        <span className="text-small text-neutral-400">No scan</span>
                      ) : overdue === 0 && blocked === 0 ? (
                        <Badge color="success">On track</Badge>
                      ) : (
                        <div className="flex gap-1">
                          {overdue > 0 && <Badge color="danger">{overdue} overdue</Badge>}
                          {blocked > 0 && <Badge color="warning">{blocked} blocked</Badge>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const snapshot = health[project.id];
            return (
              <CardLink
                key={project.id}
                href={`/projects/${project.id}`}
                color={projectStatusColor(project.status)}
                className="group flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-h3 font-semibold text-neutral-950 group-hover:underline">{project.name}</h2>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <div className="text-small text-neutral-600">{milestoneCounts[project.id] ?? 0} milestones</div>

                {(() => {
                  const progress = taskProgress[project.id];
                  if (!progress || progress.total === 0) {
                    return <div className="text-small text-neutral-400">No tasks yet</div>;
                  }
                  const pct = Math.round((progress.done / progress.total) * 100);
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-small text-neutral-600">
                        <span>
                          {progress.done}/{progress.total} tasks done
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {snapshot ? (
                  <div className="space-y-1.5 border-t border-neutral-200 pt-3">
                    <div className="flex gap-2">
                      {snapshot.signals.overdueTasks > 0 && <Badge color="danger">{snapshot.signals.overdueTasks} overdue</Badge>}
                      {snapshot.signals.blockedTasks > 0 && <Badge color="warning">{snapshot.signals.blockedTasks} blocked</Badge>}
                      {snapshot.signals.overdueTasks === 0 && snapshot.signals.blockedTasks === 0 && (
                        <Badge color="success">On track</Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 text-small text-neutral-600">{snapshot.aiSummary}</p>
                  </div>
                ) : (
                  <div className="border-t border-neutral-200 pt-3 text-small text-neutral-400">No health scan yet</div>
                )}
              </CardLink>
            );
          })}
        </div>
      )}

      {showNewProject && (
        <NewProjectWizard
          orgId={selectedOrgId}
          currentUserId=""
          onClose={() => setShowNewProject(false)}
          onCreated={() => {
            setShowNewProject(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

