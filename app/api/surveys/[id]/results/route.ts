import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { surveyResponses } from "@/db/schema";
import { handleApiError, requireUserId } from "@/lib/api/helpers";
import { getSurveyOrThrow, requireSurveyViewResultsAccess } from "@/lib/api/surveys";

type Question = { id: string; text: string; type: "rating_1_5" | "text" | "multiple_choice"; options?: string[] };

// Aggregated results only — this query selects `answers` alone, never
// `employee_id`, from survey_responses, regardless of whether the survey
// is anonymous. There is no code path in this route that can attribute an
// answer to a person.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const survey = await getSurveyOrThrow(db, id);
      await requireSurveyViewResultsAccess(db, userId, survey.orgId);

      const rows = await db.select({ answers: surveyResponses.answers }).from(surveyResponses).where(eq(surveyResponses.surveyId, id));
      const allAnswers = rows.map((r) => r.answers as Record<string, unknown>);
      const questions = (survey.questions as Question[]) ?? [];

      const results = questions.map((q) => {
        const values = allAnswers.map((a) => a[q.id]).filter((v) => v !== undefined && v !== null && v !== "");
        if (q.type === "rating_1_5") {
          const nums = values.map(Number).filter((n) => !Number.isNaN(n));
          const average = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
          const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          nums.forEach((n) => {
            if (distribution[n] !== undefined) distribution[n] += 1;
          });
          return { question_id: q.id, text: q.text, type: q.type, average, distribution, response_count: nums.length };
        }
        if (q.type === "multiple_choice") {
          const distribution: Record<string, number> = {};
          (q.options ?? []).forEach((o) => (distribution[o] = 0));
          values.forEach((v) => {
            const key = String(v);
            distribution[key] = (distribution[key] ?? 0) + 1;
          });
          return { question_id: q.id, text: q.text, type: q.type, distribution, response_count: values.length };
        }
        // text — shuffled, never carries any respondent identity.
        const texts = values.map(String);
        for (let i = texts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [texts[i], texts[j]] = [texts[j], texts[i]];
        }
        return { question_id: q.id, text: q.text, type: q.type, responses: texts, response_count: texts.length };
      });

      return { survey_id: id, total_responses: rows.length, questions: results };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
