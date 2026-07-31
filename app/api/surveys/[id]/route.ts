import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { engagementSurveys, surveyRespondents } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getSurveyOrThrow, requireSurveyManageAccess, resolveOwnEmployeeId } from "@/lib/api/surveys";

type Params = { params: Promise<{ id: string }> };

// Survey detail for responding — questions plus whether the caller has
// already responded (via survey_respondents, never survey_responses, so
// this can never leak an anonymous answer).
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const survey = await getSurveyOrThrow(db, id);
      await requirePermission(db, userId, survey.orgId, "engagement", "respond");
      const ownId = await resolveOwnEmployeeId(db, userId, survey.orgId);
      let hasResponded = false;
      if (ownId) {
        const [respondent] = await db
          .select({ id: surveyRespondents.id })
          .from(surveyRespondents)
          .where(and(eq(surveyRespondents.surveyId, id), eq(surveyRespondents.employeeId, ownId)));
        hasResponded = respondent !== undefined;
      }
      return { survey, hasResponded };
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
      const survey = await getSurveyOrThrow(db, id);
      await requireSurveyManageAccess(db, userId, survey.orgId);

      const [updated] = await db
        .update(engagementSurveys)
        .set({
          title: body.title ?? undefined,
          description: body.description === undefined ? undefined : body.description,
          questions: body.questions ?? undefined,
          status: body.status ?? undefined,
          opensAt: body.opens_at === undefined ? undefined : body.opens_at ? new Date(body.opens_at) : null,
          closesAt: body.closes_at === undefined ? undefined : body.closes_at ? new Date(body.closes_at) : null,
        })
        .where(eq(engagementSurveys.id, id))
        .returning();
      return updated;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
