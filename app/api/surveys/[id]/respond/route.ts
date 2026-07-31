import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getSurveyOrThrow, requireSurveyRespondAccess, resolveOwnEmployeeId, submitResponse } from "@/lib/api/surveys";

type Params = { params: Promise<{ id: string }> };

// submitResponse (lib/api/surveys.ts) never writes employeeId onto the
// response row for an is_anonymous=true survey — that's enforced there,
// not here, so there's exactly one place in the codebase where an
// anonymous response's identity could leak, and it's covered by
// db/test-surveys-batch4-verify.ts.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.answers) throw new ApiError(400, "answers is required");

    const row = await withOrgContext(userId, async (db) => {
      const survey = await getSurveyOrThrow(db, id);
      await requireSurveyRespondAccess(db, userId, survey.orgId);
      const ownId = await resolveOwnEmployeeId(db, userId, survey.orgId);
      if (!ownId) throw new ApiError(400, "No linked employee record for this user");

      return submitResponse(db, survey.orgId, survey, ownId, body.answers);
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
