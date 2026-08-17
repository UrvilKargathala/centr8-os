import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, hrCaseComments, hrCases } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getCaseOrThrow, requireCaseManageAccess, requireCaseViewAccess } from "@/lib/api/hrCases";
import { createNotification } from "@/lib/notifications/create";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const row = await getCaseOrThrow(db, id);
      const isHandler = await requireCaseViewAccess(db, userId, row.orgId, row.employeeId);

      const comments = await db.select().from(hrCaseComments).where(eq(hrCaseComments.caseId, id));
      const visibleComments = isHandler ? comments : comments.filter((c) => !c.isInternalNote);

      return { case: row, comments: visibleComments };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ orgId: hrCases.orgId, status: hrCases.status, employeeId: hrCases.employeeId })
        .from(hrCases)
        .where(eq(hrCases.id, id));
      if (!existing) return undefined;
      await requireCaseManageAccess(db, userId, existing.orgId);

      const nextStatus = body.status ?? existing.status;
      const [updated] = await db
        .update(hrCases)
        .set({
          categoryId: body.category_id === undefined ? undefined : body.category_id,
          priority: body.priority ?? undefined,
          status: nextStatus,
          assignedTo: body.assigned_to === undefined ? undefined : body.assigned_to,
          isConfidential: body.is_confidential === undefined ? undefined : body.is_confidential,
          resolvedAt: nextStatus === "resolved" && existing.status !== "resolved" ? new Date() : undefined,
          closedAt: nextStatus === "closed" && existing.status !== "closed" ? new Date() : undefined,
        })
        .where(eq(hrCases.id, id))
        .returning();

      if (updated && nextStatus !== existing.status) {
        const [raiser] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, existing.employeeId));
        if (raiser?.userId) {
          await createNotification(db, {
            orgId: existing.orgId,
            userId: raiser.userId,
            type: "hr_case_update",
            title: `Your case "${updated.subject}" is now ${nextStatus}`,
            linkType: "hr_case",
            linkId: updated.id,
          });
        }
      }

      return updated;
    });
    if (!row) throw new ApiError(404, "Case not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
