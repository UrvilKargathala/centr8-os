import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { jobPostings } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listAllJobPostings, requireCreateJobAccess, requireRecruitmentViewAccess } from "@/lib/api/recruitment";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const status = req.nextUrl.searchParams.get("status");

    if (!status) {
      const data = await withOrgContext(userId, (db) => listAllJobPostings(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requireRecruitmentViewAccess(db, userId, orgId);
      const conditions = [eq(jobPostings.orgId, orgId)];
      if (status) conditions.push(eq(jobPostings.status, status as (typeof jobPostings.status.enumValues)[number]));
      return db.select().from(jobPostings).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.title) throw new ApiError(400, "org_id and title are required");

    const [row] = await withOrgContext(userId, async (db) => {
      await requireCreateJobAccess(db, userId, body.org_id);
      return db
        .insert(jobPostings)
        .values({
          orgId: body.org_id,
          title: body.title,
          departmentId: body.department_id ?? null,
          employmentType: body.employment_type ?? undefined,
          location: body.location ?? null,
          status: body.status ?? undefined,
          description: body.description ?? null,
          requirements: body.requirements ?? null,
          salaryRangeMin: body.salary_range_min ?? null,
          salaryRangeMax: body.salary_range_max ?? null,
          currency: body.currency ?? undefined,
          hiringManagerId: body.hiring_manager_id ?? null,
          openedAt: body.status === "open" ? new Date() : null,
          createdBy: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
