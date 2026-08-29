import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listOnboardingWorkflows } from "@/lib/api/onboarding";
import { listAllEmployees } from "@/lib/api/employees";
import OnboardingPageClient, { type OnboardingInitialData } from "./OnboardingPageClient";

export default async function OnboardingPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <OnboardingPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [workflows, employees] = await Promise.all([
        listOnboardingWorkflows(db, userId, orgId),
        listAllEmployees(db, userId, orgId),
      ]);
      return {
        workflows: workflows.filter((w) => w.status !== "complete"),
        employees,
      } as unknown as OnboardingInitialData;
    });
    return <OnboardingPageClient initial={initial} />;
  } catch {
    return <OnboardingPageClient />;
  }
}
