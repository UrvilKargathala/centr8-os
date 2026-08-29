import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyOkrs } from "@/lib/api/reviews";
import { OkrsPageClient, type Okr } from "./OkrsPageClient";

export default async function OkrsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <OkrsPageClient />;

  try {
    const initialMyOkrs = await withOrgContext(userId, (db) => getMyOkrs(db, userId, orgId));
    return <OkrsPageClient initialMyOkrs={initialMyOkrs as unknown as Okr[]} />;
  } catch {
    return <OkrsPageClient />;
  }
}
