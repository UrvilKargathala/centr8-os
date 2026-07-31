// Mirrors db/schema.ts's enum value lists — kept here once instead of
// re-declared per screen (ai/create-project, project detail, sprint board
// all needed the same lists).
export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "archived"] as const;
export const SPRINT_STATUSES = ["planned", "active", "completed"] as const;
export const TASK_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const EMPLOYMENT_STATUSES = ["active", "onboarding", "on_leave", "notice_period", "terminated"] as const;
export const ONBOARDING_STATUSES = ["not_started", "in_progress", "complete"] as const;

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

// Where a status sits in the workflow, as a 0-100 completion percentage —
// not a subtask checklist (no such model exists). cancelled reads as
// "closed out," same treatment as done, since neither is still in flight.
// Shared by TaskCard's per-task progress bar and the dashboard's "Avg.
// Progress" stat, so the two numbers can't drift apart.
export const TASK_STATUS_PROGRESS: Record<(typeof TASK_STATUSES)[number], number> = {
  backlog: 0,
  todo: 15,
  in_progress: 55,
  in_review: 80,
  done: 100,
  cancelled: 100,
};

// Mirrors db/schema.ts's BUILT_IN_ROLES — kept separate (not imported)
// because that module also pulls in drizzle-orm/pg-core, which has no
// business in a client bundle.
export const ORG_ROLES = ["owner", "admin", "member", "viewer"] as const;

// Mirrors db/schema.ts's Prompt 5.4 status enums.
export const PERFORMANCE_REVIEW_STATUSES = ["draft", "submitted", "completed"] as const;
export const JOB_POSTING_STATUSES = ["draft", "open", "closed"] as const;
export const CANDIDATE_STAGES = ["applied", "interview", "offer", "hired", "rejected"] as const;
export const HR_CASE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted", "lost"] as const;
export const ACCOUNT_TYPES = ["prospect", "customer", "partner", "vendor", "other"] as const;
export const ACCOUNT_STATUSES = ["active", "inactive", "churned"] as const;
// CRM Batch 2 — "discovery" and "contract_sent" added between prospecting
// and negotiation/won, matching the Kanban's 5 open-pipeline columns
// (KANBAN_STAGES below) plus the 2 terminal states.
export const DEAL_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent", "won", "lost"] as const;
export const KANBAN_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"] as const;
export const DEAL_STAGE_LABELS: Record<(typeof DEAL_STAGES)[number], string> = {
  prospecting: "Prospecting",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  contract_sent: "Contract Sent",
  won: "Won",
  lost: "Lost",
};
export const ACTIVITY_TYPES = ["call", "meeting", "task", "note", "email"] as const;
export const CAMPAIGN_STATUSES = ["planned", "active", "completed", "cancelled"] as const;
