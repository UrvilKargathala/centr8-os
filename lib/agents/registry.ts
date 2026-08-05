// Maps a job_type string to the agent module that handles it.
// Historical — was the worker's dispatch table; now unused since AI
// calls run inline via generateAI(). Kept for reference.
import type { OrgScopedDb } from "@/db/withOrgContext";
import type { AgentJobDefinition } from "./types";
import { runCreateProjectDraftJob } from "./planner";
import { makeProjectHealthScanJob } from "./monitor";

// analyst.ts, writer.ts, and communicator.ts are scaffolded (Prompt 2.1
// task 2) but have no job types to register yet — see Prompt 2.6/2.7/3.1.

// Monitor's job needs a live db handle (health signals are computed with
// live queries, not passed in as input), so the registry is built per
// worker-connection rather than being a static module-level object.
export function buildRegistry(db: OrgScopedDb): Record<string, AgentJobDefinition> {
  return {
    create_project_draft: {
      agentType: "planner",
      tier: "tier_0",
      handler: runCreateProjectDraftJob,
      auditAction: "ai_project_draft_generated",
      targetType: "organization",
      targetId: (orgId) => orgId,
    },
    project_health_scan: {
      agentType: "monitor",
      tier: "tier_0",
      handler: makeProjectHealthScanJob(db),
      auditAction: "project_health_snapshot_generated",
      targetType: "project",
      targetId: (_orgId, input) => (input as { projectId: string }).projectId,
    },
  };
}
