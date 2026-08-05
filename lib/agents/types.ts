// Agent type definitions. The worker dispatch table is no longer used;
// AI calls run inline via generateAI(). These types are kept for the
// real Gemini-backed agent modules in planner.ts / monitor.ts.
export type AgentJobHandler = (input: unknown) => Promise<unknown>;

export type AgentType = "planner" | "monitor" | "analyst" | "writer" | "communicator";
export type AutonomyTier = "tier_0" | "tier_1" | "tier_2" | "tier_3";

export interface AgentJobDefinition {
  agentType: AgentType;
  tier: AutonomyTier;
  handler: AgentJobHandler;
  // audit_log.action/target_type for this job type — kept as the exact
  // strings the pre-worker inline routes used (e.g.
  // "ai_project_draft_generated"), so the dashboard's "Recent activity"
  // feed reads the same as before the migration to a worker (Prompt 2.1
  // task 3's "sit on the correct foundation" without changing behavior).
  auditAction: string;
  targetType: string;
  // Resolves the audit_log.target_id from the job's org id and validated
  // input — organization id for org-level actions, a more specific id
  // (e.g. project id) when the job's input carries one.
  targetId: (orgId: string, input: unknown) => string;
}
