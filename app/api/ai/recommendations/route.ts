import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { deals, leaveRequests, people, projects, sprintPlanProposals, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { generateAI } from "@/lib/ai/generate";

const OPEN_DEAL_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"] as const;
const STALE_DAYS = 14;

// No permission gate — computed live from data the caller can already see
// through its own resource-level permissions on each source table; nothing
// new is exposed here.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const result = await withOrgContext(userId, async (db) => {
      const orgTasks = await db.select().from(tasks).where(eq(tasks.orgId, orgId));
      const overdueTasks = orgTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done" && t.status !== "cancelled");

      const orgProjects = await db.select().from(projects).where(eq(projects.orgId, orgId));
      const projectTaskCounts = new Map<string, { blocked: number }>();
      for (const t of orgTasks) {
        if (!projectTaskCounts.has(t.projectId)) projectTaskCounts.set(t.projectId, { blocked: 0 });
        if (t.status === "in_review") projectTaskCounts.get(t.projectId)!.blocked += 1;
      }
      const atRiskProjectNames = orgProjects
        .filter((p) => (projectTaskCounts.get(p.id)?.blocked ?? 0) >= 2 && p.status === "active")
        .map((p) => p.name);

      const orgPeople = await db.select().from(people).where(and(eq(people.orgId, orgId), eq(people.isActive, true)));
      const estimatedByAssignee = new Map<string, number>();
      for (const t of orgTasks) {
        if (t.assigneeId && t.status !== "done" && t.status !== "cancelled") {
          estimatedByAssignee.set(t.assigneeId, (estimatedByAssignee.get(t.assigneeId) ?? 0) + (t.estimate ?? 0));
        }
      }
      const overAllocatedMembers = orgPeople.filter((p) => (estimatedByAssignee.get(p.id) ?? 0) > p.availableHoursPerWeek).map((p) => p.fullName);

      const orgDeals = await db.select().from(deals).where(and(eq(deals.orgId, orgId), inArray(deals.stage, OPEN_DEAL_STAGES)));
      const now = Date.now();
      const atRiskDealNames = orgDeals
        .filter((d) => (now - new Date(d.stageChangedAt).getTime()) / 86400000 > STALE_DAYS)
        .map((d) => d.name);

      const pendingLeave = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.orgId, orgId), eq(leaveRequests.status, "pending")));

      const pendingPlans = await db
        .select()
        .from(sprintPlanProposals)
        .where(and(eq(sprintPlanProposals.orgId, orgId), eq(sprintPlanProposals.status, "pending")));

      const ai = (await generateAI("Analyst", "generate_recommendations", {
        overdue_tasks_count: overdueTasks.length,
        at_risk_project_names: atRiskProjectNames,
        over_allocated_members: overAllocatedMembers,
        at_risk_deal_names: atRiskDealNames,
        pending_leave_requests: pendingLeave.length,
        pending_sprint_plans: pendingPlans.length,
      })) as { recommendations: unknown[] };

      return ai.recommendations;
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
