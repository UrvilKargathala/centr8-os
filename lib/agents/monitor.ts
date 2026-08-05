// Monitor agent (FR-8.x), Tier 0 — read-only. Computes signals straight
// from tasks/sprints/task_dependencies and writes a plain-language summary;
// never writes to any work-hierarchy table itself. The API route
// (app/api/ai/project-health/route.ts) is the only place that persists a
// project_health_snapshots row, after polling this job's result.
//
// Migrated from lib/ai/healthSignals.ts + lib/ai/gemini.ts (Prompt 2.1).
import { eq, inArray } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { sprints, taskDependencies, tasks } from "@/db/schema";
import { AgentError, callGemini } from "./shared/geminiClient";

export interface ProjectHealthSignals {
  computedAt: string;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  sprints: {
    id: string;
    name: string;
    status: string;
    totalTasks: number;
    doneTasks: number;
    burnRate: number;
  }[];
}

const CLOSED_STATUSES = new Set(["done", "cancelled"]);

export async function computeProjectHealthSignals(
  db: OrgScopedDb,
  projectId: string,
): Promise<ProjectHealthSignals> {
  const [projectTasks, projectSprints] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    db.select().from(sprints).where(eq(sprints.projectId, projectId)),
  ]);

  const dependencies = projectTasks.length
    ? await db
        .select()
        .from(taskDependencies)
        .where(
          inArray(
            taskDependencies.taskId,
            projectTasks.map((t) => t.id),
          ),
        )
    : [];

  const taskById = new Map(projectTasks.map((t) => [t.id, t]));
  const sprintById = new Map(projectSprints.map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);

  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
  const openTasks = projectTasks.filter((t) => !CLOSED_STATUSES.has(t.status)).length;

  // "Overdue" has no direct column on tasks — proxied via the task's
  // sprint end date, since tasks don't carry their own due date.
  const overdueTasks = projectTasks.filter((t) => {
    if (CLOSED_STATUSES.has(t.status)) return false;
    const sprint = t.sprintId ? sprintById.get(t.sprintId) : undefined;
    return sprint?.endDate != null && sprint.endDate < today;
  }).length;

  // A task is blocked if any of its dependencies (task_dependencies.task_id
  // -> depends_on_task_id) points at a task that isn't closed yet.
  const blockedTaskIds = new Set<string>();
  for (const dep of dependencies) {
    const blocker = taskById.get(dep.dependsOnTaskId);
    if (blocker && !CLOSED_STATUSES.has(blocker.status)) {
      blockedTaskIds.add(dep.taskId);
    }
  }

  const sprintSignals = projectSprints.map((s) => {
    const sprintTasks = projectTasks.filter((t) => t.sprintId === s.id);
    const sprintDone = sprintTasks.filter((t) => t.status === "done").length;
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      totalTasks: sprintTasks.length,
      doneTasks: sprintDone,
      burnRate: sprintTasks.length ? Number((sprintDone / sprintTasks.length).toFixed(2)) : 0,
    };
  });

  return {
    computedAt: new Date().toISOString(),
    totalTasks: projectTasks.length,
    openTasks,
    doneTasks,
    overdueTasks,
    blockedTasks: blockedTaskIds.size,
    sprints: sprintSignals,
  };
}

const HEALTH_SUMMARY_INSTRUCTIONS = `You are the Monitor agent for Centr8 OS, an AI project manager. Given a project's name and computed health signals (task counts, overdue count, blocked count, per-sprint burn rates), write a plain-language health summary: 2-4 sentences, no markdown, no headings. State the overall picture, then call out anything worth a human's attention (overdue or blocked tasks, a stalled sprint). If the signals look healthy, say so plainly — don't invent risk that isn't in the data. This is informational only; do not suggest or imply any automatic action.`;

export async function generateHealthSummary(projectName: string, signals: ProjectHealthSignals): Promise<string> {
  const text = await callGemini(
    `${HEALTH_SUMMARY_INSTRUCTIONS}\n\nProject: ${projectName}\nSignals: ${JSON.stringify(signals)}`,
  );
  return text.trim();
}

export interface ProjectHealthScanInput {
  projectId: string;
  projectName: string;
}

export interface ProjectHealthScanOutput {
  signals: ProjectHealthSignals;
  aiSummary: string;
}

// Project health scan handler. Takes a db handle as a closure argument.
export function makeProjectHealthScanJob(db: OrgScopedDb) {
  return async function runProjectHealthScanJob(input: unknown): Promise<ProjectHealthScanOutput> {
    const { projectId, projectName } = input as ProjectHealthScanInput;
    if (typeof projectId !== "string" || typeof projectName !== "string") {
      throw new AgentError("project_health_scan job requires string `projectId` and `projectName`");
    }
    const signals = await computeProjectHealthSignals(db, projectId);
    const aiSummary = await generateHealthSummary(projectName, signals);
    return { signals, aiSummary };
  };
}
