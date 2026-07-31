import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingEnrollments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireEnrollmentOwnAccess } from "@/lib/api/training";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, id));
      if (!existing) return undefined;
      await requireEnrollmentOwnAccess(db, userId, existing.orgId, existing.employeeId);

      const nextStatus = body.status ?? existing.status;
      const [updated] = await db
        .update(trainingEnrollments)
        .set({
          status: nextStatus,
          progressPercent: body.progress_percent ?? undefined,
          completedAt: nextStatus === "completed" && existing.status !== "completed" ? new Date() : undefined,
        })
        .where(eq(trainingEnrollments.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Enrollment not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
