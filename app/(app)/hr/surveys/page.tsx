import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { hasRespondedToSurvey, listAllSurveys } from "@/lib/api/surveys";
import { SurveysPageClient, type ActiveSurveysInitialData, type Survey } from "./SurveysPageClient";

export default async function SurveysPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <SurveysPageClient />;

  try {
    const initialActive = await withOrgContext(userId, async (db) => {
      const all = await listAllSurveys(db, userId, orgId);
      const surveys = (all as unknown as Survey[]).filter((s) => s.status === "active");
      const responded: Record<string, boolean> = {};
      await Promise.all(
        surveys.map(async (s) => {
          responded[s.id] = await hasRespondedToSurvey(db, userId, orgId, s.id);
        }),
      );
      return { surveys, responded } as ActiveSurveysInitialData;
    });
    return <SurveysPageClient initialActive={initialActive} />;
  } catch {
    return <SurveysPageClient />;
  }
}
