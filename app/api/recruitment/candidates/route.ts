import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { candidates } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireManageCandidatesAccess, requireRecruitmentViewAccess } from "@/lib/api/recruitment";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const jobPostingId = req.nextUrl.searchParams.get("job_posting_id");
    const stage = req.nextUrl.searchParams.get("stage");

    const rows = await withOrgContext(userId, async (db) => {
      await requireRecruitmentViewAccess(db, userId, orgId);
      const conditions = [eq(candidates.orgId, orgId)];
      if (jobPostingId) conditions.push(eq(candidates.jobPostingId, jobPostingId));
      if (stage) conditions.push(eq(candidates.stage, stage as (typeof candidates.stage.enumValues)[number]));
      return db.select().from(candidates).where(and(...conditions));
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
    if (!body.org_id || !body.job_posting_id || !body.full_name || !body.email) {
      throw new ApiError(400, "org_id, job_posting_id, full_name, and email are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requireManageCandidatesAccess(db, userId, body.org_id);
      return db
        .insert(candidates)
        .values({
          orgId: body.org_id,
          jobPostingId: body.job_posting_id,
          fullName: body.full_name,
          email: body.email,
          phone: body.phone ?? null,
          resumeUrl: body.resume_url ?? null,
          source: body.source ?? null,
          stage: body.stage ?? undefined,
          notes: body.notes ?? null,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
