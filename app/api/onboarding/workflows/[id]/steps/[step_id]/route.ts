import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { onboardingWorkflows } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission } from "@/lib/api/permissions";
import { isManagerOf } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string; step_id: string }> };
type Step = { step_id: string; status: string; completed_by: string | null; completed_at: string | null; notes: string | null };

// Gated by onboarding:complete_step (owner/admin/member, migration 0070)
// OR the caller being the target employee's manager — same role-or-manager
// pattern as requireEmployeeManageAccess, applied here because
// complete_step is a distinct grant from employee:update.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, step_id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    const status = body.status; // 'in_progress' | 'completed' | 'skipped' | 'pending'
    if (!status) throw new ApiError(400, "status is required");

    const row = await withOrgContext(userId, async (db) => {
      const [workflow] = await db.select().from(onboardingWorkflows).where(eq(onboardingWorkflows.id, id));
      if (!workflow) return undefined;

      const allowed =
        (await hasPermission(db, userId, workflow.orgId, "onboarding", "complete_step")) ||
        (await isManagerOf(db, userId, workflow.orgId, workflow.employeeId));
      if (!allowed) throw new ApiError(403, "Not authorized to update this onboarding step");

      const steps = (workflow.steps as Step[]).map((s) =>
        s.step_id === step_id
          ? {
              ...s,
              status,
              completed_by: status === "completed" ? userId : s.completed_by,
              completed_at: status === "completed" ? new Date().toISOString() : s.completed_at,
              notes: body.notes !== undefined ? body.notes : s.notes,
            }
          : s,
      );
      if (!steps.some((s) => s.step_id === step_id)) throw new ApiError(404, "Step not found");

      const allDone = steps.every((s) => s.status === "completed" || s.status === "skipped");
      const anyStarted = steps.some((s) => s.status !== "pending");
      const workflowStatus = allDone ? "complete" : anyStarted ? "in_progress" : "not_started";

      const [updated] = await db
        .update(onboardingWorkflows)
        .set({
          steps,
          status: workflowStatus,
          startedAt: workflow.startedAt ?? (anyStarted ? new Date() : null),
          completedAt: allDone ? new Date() : null,
        })
        .where(eq(onboardingWorkflows.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Onboarding workflow not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
