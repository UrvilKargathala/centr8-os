import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listIntegrations } from "@/lib/api/integrations";
import IntegrationsPageClient, { type Integration } from "./IntegrationsPageClient";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <IntegrationsPageClient />;

  try {
    const initial = await withOrgContext(userId, (db) => listIntegrations(db, userId, orgId));
    return <IntegrationsPageClient initial={initial as unknown as Integration[]} />;
  } catch {
    return <IntegrationsPageClient />;
  }
}
