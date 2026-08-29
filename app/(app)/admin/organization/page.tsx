import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getOrgDetail } from "@/lib/api/orgs";
import OrganizationPageClient, { type OrgDetail } from "./OrganizationPageClient";

export default async function OrganizationPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <OrganizationPageClient />;

  try {
    const org = await withOrgContext(userId, (db) => getOrgDetail(db, orgId));
    return <OrganizationPageClient initial={org as OrgDetail} />;
  } catch {
    return <OrganizationPageClient />;
  }
}
