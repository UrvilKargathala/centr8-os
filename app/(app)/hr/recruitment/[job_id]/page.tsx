import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getJobDetailData } from "@/lib/api/recruitment";
import JobDetailPageClient, { type JobDetailInitialData } from "./JobDetailPageClient";

export default async function JobDetailPage({ params }: { params: Promise<{ job_id: string }> }) {
  const { job_id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <JobDetailPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getJobDetailData(db, userId, orgId, job_id);
      return result as unknown as JobDetailInitialData;
    });
    return <JobDetailPageClient initial={initial} />;
  } catch {
    return <JobDetailPageClient />;
  }
}
