import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listOrgMembers } from "@/lib/api/orgMembers";
import MembersPageClient, { type Member } from "./MembersPageClient";

export default async function MembersPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <MembersPageClient />;

  try {
    const initial = await withOrgContext(userId, (db) => listOrgMembers(db, userId, orgId));
    return <MembersPageClient initial={initial as unknown as Member[]} />;
  } catch {
    return <MembersPageClient />;
  }
}
