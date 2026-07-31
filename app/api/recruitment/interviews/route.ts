import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { interviewSchedules } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireRecruitmentViewAccess, requireScheduleInterviewAccess } from "@/lib/api/recruitment";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const candidateId = req.nextUrl.searchParams.get("candidate_id");

    const rows = await withOrgContext(userId, async (db) => {
      await requireRecruitmentViewAccess(db, userId, orgId);
      const conditions = [eq(interviewSchedules.orgId, orgId)];
      if (candidateId) conditions.push(eq(interviewSchedules.candidateId, candidateId));
      return db.select().from(interviewSchedules).where(and(...conditions));
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
    if (!body.org_id || !body.candidate_id) throw new ApiError(400, "org_id and candidate_id are required");

    const [row] = await withOrgContext(userId, async (db) => {
      await requireScheduleInterviewAccess(db, userId, body.org_id);
      return db
        .insert(interviewSchedules)
        .values({
          orgId: body.org_id,
          candidateId: body.candidate_id,
          interviewerId: body.interviewer_id ?? null,
          scheduledAt: body.scheduled_at ? new Date(body.scheduled_at) : null,
          interviewType: body.interview_type ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
