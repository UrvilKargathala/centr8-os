// HR Batch 4 — Employee Engagement/Surveys. Self-service response
// (everyone can respond), admin-only authoring (survey:manage) and
// aggregated-results viewing (survey:view_results).
//
// Anonymity is enforced structurally, not by a boolean flag: an
// is_anonymous=true survey's responses are inserted with employeeId=null
// (submitResponse below), and duplicate-submission prevention is handled
// by a SEPARATE table (survey_respondents) that always records the real
// employeeId but is never selected alongside survey_responses.answers in
// any function in this file or any route that imports it. There is no
// query path here that can join "who responded" back to "what they said"
// for an anonymous survey — see db/test-surveys-batch4-verify.ts for the
// regression test that checks this directly.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, engagementSurveys, surveyRespondents, surveyResponses } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";

export async function resolveOwnEmployeeId(db: OrgScopedDb, userId: string, orgId: string): Promise<string | null> {
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  return row?.id ?? null;
}

export function requireSurveyManageAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "engagement", "manage");
}

export function requireSurveyRespondAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "engagement", "respond");
}

export function requireSurveyViewResultsAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "engagement", "view_results");
}

export type EngagementSurvey = typeof engagementSurveys.$inferSelect;

export async function getSurveyOrThrow(db: OrgScopedDb, id: string): Promise<EngagementSurvey> {
  const [row] = await db.select().from(engagementSurveys).where(eq(engagementSurveys.id, id));
  if (!row) throw new ApiError(404, "Survey not found");
  return row;
}

// Submits a response and records the dedup-tracking row in one call.
// employeeId is only ever written to survey_responses when the survey is
// NOT anonymous — for an anonymous survey the row is inserted with
// employeeId=null, full stop, before this function ever touches
// survey_respondents.
export async function submitResponse(
  db: OrgScopedDb,
  orgId: string,
  survey: EngagementSurvey,
  employeeId: string,
  answers: Record<string, unknown>,
) {
  const [alreadyResponded] = await db
    .select({ id: surveyRespondents.id })
    .from(surveyRespondents)
    .where(and(eq(surveyRespondents.surveyId, survey.id), eq(surveyRespondents.employeeId, employeeId)));
  if (alreadyResponded) throw new ApiError(409, "You have already responded to this survey");

  const [response] = await db
    .insert(surveyResponses)
    .values({
      orgId,
      surveyId: survey.id,
      employeeId: survey.isAnonymous ? null : employeeId,
      answers,
    })
    .returning();

  await db.insert(surveyRespondents).values({ orgId, surveyId: survey.id, employeeId }).onConflictDoNothing();

  return response;
}
