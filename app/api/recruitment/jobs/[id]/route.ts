import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { jobPostings } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireCreateJobAccess } from "@/lib/api/recruitment";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
      if (!existing) return undefined;
      await requireCreateJobAccess(db, userId, existing.orgId);

      const nextStatus = body.status ?? existing.status;
      const [updated] = await db
        .update(jobPostings)
        .set({
          title: body.title ?? undefined,
          departmentId: body.department_id ?? undefined,
          employmentType: body.employment_type ?? undefined,
          location: body.location ?? undefined,
          status: nextStatus,
          description: body.description ?? undefined,
          requirements: body.requirements ?? undefined,
          salaryRangeMin: body.salary_range_min ?? undefined,
          salaryRangeMax: body.salary_range_max ?? undefined,
          currency: body.currency ?? undefined,
          hiringManagerId: body.hiring_manager_id ?? undefined,
          openedAt: nextStatus === "open" && !existing.openedAt ? new Date() : undefined,
          closedAt: (nextStatus === "closed" || nextStatus === "filled") && !existing.closedAt ? new Date() : undefined,
        })
        .where(eq(jobPostings.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Job posting not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
