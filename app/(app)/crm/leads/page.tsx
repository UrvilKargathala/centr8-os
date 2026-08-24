import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllLeads } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { LeadsPageClient, type Employee, type Lead } from "./LeadsPageClient";

// Server-rendered: reuses lib/api/crm.ts's listAllLeads and
// lib/api/employees.ts's listAllEmployees (the owner-picker source), same
// functions app/api/crm/leads and app/api/employees already call for the
// unfiltered case. If the caller lacks "lead:read" (requirePermission
// throws), fall through to the client component with no initial data —
// its own fetch + existing error handling takes over, same as before this
// page was server-rendered, so a permission-denied visit degrades exactly
// like it already did rather than crashing the page.
export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <LeadsPageClient />;

  try {
    const [leads, employees] = await withOrgContext(userId, (db) =>
      Promise.all([listAllLeads(db, userId, orgId), listAllEmployees(db, userId, orgId)]),
    );
    return (
      <LeadsPageClient
        initialLeads={leads as unknown as Lead[]}
        initialEmployees={employees as unknown as Employee[]}
      />
    );
  } catch {
    return <LeadsPageClient />;
  }
}
