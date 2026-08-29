import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyHrCases } from "@/lib/api/hrCases";
import { CasesPageClient, type HrCase } from "./CasesPageClient";

export default async function CasesPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <CasesPageClient />;

  try {
    const initialMyCases = await withOrgContext(userId, (db) => getMyHrCases(db, userId, orgId));
    return <CasesPageClient initialMyCases={initialMyCases as unknown as HrCase[]} />;
  } catch {
    return <CasesPageClient />;
  }
}
