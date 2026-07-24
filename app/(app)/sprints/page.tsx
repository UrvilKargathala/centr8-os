"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { SprintStatusBadge, sprintStatusColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CardButton } from "@/components/ui/Card";
import { SprintBoard } from "@/components/SprintBoard";
import { CapacityPanel } from "@/components/CapacityPanel";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { Task } from "@/components/TaskCard";

type Project = { id: string; name: string };
type Sprint = { id: string; projectId: string; name: string; status: string; startDate: string | null; endDate: string | null };

// /api/sprints and /api/tasks are always scoped to a project_id (no
// org-wide list endpoint exists) — so this page fetches every project,
// then fans out to fetch each project's sprints/tasks in parallel. Same
// per-project fan-out pattern already used by the dashboard's task counts
// and the projects list's milestone counts.
export default function SprintsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canEdit = can("task", "update");

  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSprintId, setOpenSprintId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/projects?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then(async (projectsBody) => {
        if (!projectsBody.data) throw new Error(projectsBody.error ?? "Failed to load projects");
        const projectList: Project[] = projectsBody.data;
        setProjects(projectList);

        const perProject = await Promise.all(
          projectList.map((p) =>
            Promise.all([
              fetch(`/api/sprints?project_id=${p.id}`).then((r) => r.json()).then((b) => (b.data ?? []) as Sprint[]),
              fetch(`/api/tasks?project_id=${p.id}`)
                .then((r) => r.json())
                .then((b) => ((b.data ?? []) as Task[]).map((t) => ({ ...t, projectName: p.name }))),
            ]).catch(() => [[], []] as [Sprint[], Task[]]),
          ),
        );
        setSprints(perProject.flatMap(([s]) => s));
        setTasks(perProject.flatMap(([, t]) => t));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sprints"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  async function handleSprintStatus(sprintId: string, status: "active" | "completed") {
    const res = await fetch(`/api/sprints/${sprintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) loadAll();
  }

  async function handleStatusChange(taskId: string, status: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Unknown project";
  const openSprint = sprints.find((s) => s.id === openSprintId);

  if (openSprint) {
    const sprintTasks = tasks.filter((t) => t.sprintId === openSprint.id);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setOpenSprintId(null)}>
            ← Sprints
          </Button>
          <div>
            <span className="text-body-medium font-medium text-neutral-950">{openSprint.name}</span>
            <span className="ml-2 text-small text-neutral-600">{projectName(openSprint.projectId)}</span>
          </div>
          <SprintStatusBadge status={openSprint.status} />
          {can("sprint", "update") && openSprint.status === "planned" && (
            <Button onClick={() => handleSprintStatus(openSprint.id, "active")}>Start sprint</Button>
          )}
          {can("sprint", "update") && openSprint.status === "active" && (
            <Button variant="secondary" onClick={() => handleSprintStatus(openSprint.id, "completed")}>
              Complete sprint
            </Button>
          )}
        </div>
        {selectedOrgId && <CapacityPanel sprintId={openSprint.id} orgId={selectedOrgId} />}
        <SprintBoard tasks={sprintTasks} canEdit={canEdit} onTaskClick={setOpenTaskId} onStatusChange={handleStatusChange} />

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

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Sprints</h1>

      {sprints.length === 0 ? (
        <p className="text-body text-neutral-600">No sprints yet. Create one from a project's Sprints tab.</p>
      ) : (
        <div className="space-y-3">
          {sprints.map((s) => {
            const sprintTasks = tasks.filter((t) => t.sprintId === s.id);
            return (
              <CardButton key={s.id} onClick={() => setOpenSprintId(s.id)} color={sprintStatusColor(s.status)} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-body-medium font-medium text-neutral-950">{s.name}</span>
                    <span className="ml-2 text-small text-neutral-600">{projectName(s.projectId)}</span>
                  </div>
                  <SprintStatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-small text-neutral-600">
                  {s.startDate ?? "No start"} – {s.endDate ?? "No end"} · {sprintTasks.length} tasks
                </p>
              </CardButton>
            );
          })}
        </div>
      )}
    </div>
  );
}
