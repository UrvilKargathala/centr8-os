import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyEnrollments, listAllCourses } from "@/lib/api/training";
import { TrainingPageClient, type CatalogInitialData } from "./TrainingPageClient";

export default async function TrainingPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <TrainingPageClient />;

  try {
    const initialCatalog = await withOrgContext(userId, async (db) => {
      const [courses, enrollments] = await Promise.all([listAllCourses(db, userId, orgId), getMyEnrollments(db, userId, orgId)]);
      return { courses, enrollments } as unknown as CatalogInitialData;
    });
    return <TrainingPageClient initialCatalog={initialCatalog} />;
  } catch {
    return <TrainingPageClient />;
  }
}
