import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { computePipelineStats, listAccountNames, listAllContacts, listAllDeals } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { DealsPageClient, type DealsInitialData } from "./DealsPageClient";

// deal:read gates the whole page (degrades to client on denial, same as
// CRM Leads/Accounts/Contacts). accounts/contacts/employees soft-fail to
// [] individually, matching the page's original client-fetch degradation.
export default async function DealsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <DealsPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [deals, stats] = await Promise.all([listAllDeals(db, userId, orgId), computePipelineStats(db, userId, orgId)]);
      const [accounts, contacts, employees] = await Promise.all([
        listAccountNames(db, userId, orgId).catch(() => []),
        listAllContacts(db, userId, orgId).catch(() => []),
        listAllEmployees(db, userId, orgId).catch(() => []),
      ]);
      return { deals, stats, accounts, contacts, employees } as unknown as DealsInitialData;
    });
    return <DealsPageClient initial={initial} />;
  } catch {
    return <DealsPageClient />;
  }
}
