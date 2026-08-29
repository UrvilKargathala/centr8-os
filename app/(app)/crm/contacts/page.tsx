import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAccountNames, listAllContacts } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { ContactsPageClient, type ContactsInitialData } from "./ContactsPageClient";

// contacts:read gates the whole page (falls through to client on denial,
// same as CRM Leads/Accounts). accounts/employees are soft-failed to []
// individually — the page's original client fetch degraded the same way
// when the caller had contact:read but not account:read/employee:read.
export default async function ContactsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ContactsPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const contacts = await listAllContacts(db, userId, orgId);
      const [accounts, employees] = await Promise.all([
        listAccountNames(db, userId, orgId).catch(() => []),
        listAllEmployees(db, userId, orgId).catch(() => []),
      ]);
      return { contacts, accounts, employees } as ContactsInitialData;
    });
    return <ContactsPageClient initial={initial} />;
  } catch {
    return <ContactsPageClient />;
  }
}
