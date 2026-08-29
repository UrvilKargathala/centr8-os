import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllJobPostings } from "@/lib/api/recruitment";
import { RecruitmentPageClient, type JobPosting } from "./RecruitmentPageClient";

export default async function RecruitmentPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <RecruitmentPageClient />;

  try {
    const initialJobs = await withOrgContext(userId, (db) => listAllJobPostings(db, userId, orgId));
    return <RecruitmentPageClient initialJobs={initialJobs as unknown as JobPosting[]} />;
  } catch {
    return <RecruitmentPageClient />;
  }
}
