import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { interviewSchedules } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireInterviewFeedbackAccess } from "@/lib/api/recruitment";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(interviewSchedules).where(eq(interviewSchedules.id, id));
      if (!existing) return undefined;
      await requireInterviewFeedbackAccess(db, userId, existing.orgId, existing.interviewerId);

      const [updated] = await db
        .update(interviewSchedules)
        .set({
          feedback: body.feedback ?? undefined,
          recommendation: body.recommendation ?? undefined,
          status: "completed",
        })
        .where(eq(interviewSchedules.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Interview not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
