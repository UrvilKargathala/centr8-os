import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllAccounts, listAllContacts } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { AccountsPageClient, type AccountsInitialData } from "./AccountsPageClient";

// Permission-denied (requirePermission inside listAllAccounts/listAllContacts
// throws) falls through to the client component with no initial data — same
// degrade-to-client-fetch behavior as CRM Leads' server page.
export default async function AccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <AccountsPageClient />;

  try {
    const [accounts, contacts, employees] = await withOrgContext(userId, (db) =>
      Promise.all([listAllAccounts(db, userId, orgId), listAllContacts(db, userId, orgId), listAllEmployees(db, userId, orgId)]),
    );
    const initial: AccountsInitialData = {
      accounts: accounts as unknown as AccountsInitialData["accounts"],
      contacts,
      employees: employees as unknown as AccountsInitialData["employees"],
    };
    return <AccountsPageClient initial={initial} />;
  } catch {
    return <AccountsPageClient />;
  }
}
