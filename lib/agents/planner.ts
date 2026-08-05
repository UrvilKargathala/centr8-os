// Planner agent (FR-7.x), Tier 0 — Suggest Only. Only ever produces a
// draft; it must never write to the DB itself. The human-in-the-loop write
// path lives entirely in app/api/ai/create-project-draft/accept/route.ts.
import { AgentError, callGemini } from "./shared/geminiClient";
import type { ProjectDraft } from "@/lib/ai/projectDraft";

const DRAFT_INSTRUCTIONS = `You are the Planner agent for Centr8 OS, an AI project manager. Given a free-text request, produce a structured project-creation draft as strict JSON matching exactly this shape (no extra keys, no markdown fences, no commentary):

{
  "goal": { "title": string, "description": string | null },
  "project": {
    "name": string,
    "description": string | null,
    "status": "planning" | "active" | "on_hold" | "completed" | "archived",
    "start_date": string | null,
    "end_date": string | null
  },
  "milestones": [ { "name": string, "due_date": string | null } ],
  "sprints": [ { "name": string, "start_date": string | null, "end_date": string | null, "status": "planned" | "active" | "completed" } ],
  "tasks": [
    {
      "title": string,
      "description": string | null,
      "priority": "low" | "medium" | "high" | "urgent",
      "estimate": number | null,
      "sprint_index": number | null
    }
  ]
}

Dates are "YYYY-MM-DD" or null. "sprint_index" is the index of the task's sprint within the "sprints" array above, or null if unassigned. Default "project.status" to "planning" and every sprint's "status" to "planned" unless the request implies otherwise. Keep it realistic and scoped to what was actually asked — a handful of milestones, a few sprints, a modest task list is typical, not a hard rule.`;

export interface CreateProjectDraftInput {
  prompt: string;
}

export async function generateProjectDraft(prompt: string): Promise<ProjectDraft> {
  const text = await callGemini(`${DRAFT_INSTRUCTIONS}\n\nRequest: ${prompt}`, { json: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AgentError("Gemini returned malformed JSON");
  }

  return normalizeDraft(parsed);
}

// job_type "create_project_draft" — registered in lib/agents/registry.ts.
export async function runCreateProjectDraftJob(input: unknown): Promise<ProjectDraft> {
  const { prompt } = input as CreateProjectDraftInput;
  if (typeof prompt !== "string" || !prompt) {
    throw new AgentError("create_project_draft job requires a string `prompt`");
  }
  return generateProjectDraft(prompt);
}

// Coerces/validates the LLM's JSON into ProjectDraft — never trust a
// free-text model's output shape enough to hand it straight to db.insert.
function normalizeDraft(value: unknown): ProjectDraft {
  if (typeof value !== "object" || value === null) {
    throw new AgentError("Gemini draft was not a JSON object");
  }
  const v = value as Record<string, unknown>;
  const goal = asRecord(v.goal);
  const project = asRecord(v.project);

  if (typeof goal.title !== "string" || typeof project.name !== "string") {
    throw new AgentError("Gemini draft is missing goal.title or project.name");
  }

  const sprints = asArray(v.sprints).map((s) => {
    const sr = asRecord(s);
    return {
      name: typeof sr.name === "string" ? sr.name : "Untitled sprint",
      start_date: asStringOrNull(sr.start_date),
      end_date: asStringOrNull(sr.end_date),
      status: asEnum(sr.status, ["planned", "active", "completed"] as const, "planned"),
    };
  });

  return {
    goal: { title: goal.title, description: asStringOrNull(goal.description) },
    project: {
      name: project.name,
      description: asStringOrNull(project.description),
      status: asEnum(
        project.status,
        ["planning", "active", "on_hold", "completed", "archived"] as const,
        "planning",
      ),
      start_date: asStringOrNull(project.start_date),
      end_date: asStringOrNull(project.end_date),
    },
    milestones: asArray(v.milestones).map((m) => {
      const mr = asRecord(m);
      return {
        name: typeof mr.name === "string" ? mr.name : "Untitled milestone",
        due_date: asStringOrNull(mr.due_date),
      };
    }),
    sprints,
    tasks: asArray(v.tasks).map((t) => {
      const tr = asRecord(t);
      const sprintIndex = typeof tr.sprint_index === "number" ? tr.sprint_index : null;
      return {
        title: typeof tr.title === "string" ? tr.title : "Untitled task",
        description: asStringOrNull(tr.description),
        priority: asEnum(tr.priority, ["low", "medium", "high", "urgent"] as const, "medium"),
        estimate: typeof tr.estimate === "number" ? tr.estimate : null,
        sprint_index: sprintIndex !== null && sprintIndex >= 0 && sprintIndex < sprints.length ? sprintIndex : null,
      };
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback;
}
