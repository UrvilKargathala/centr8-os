import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyLeaveBalances, getMyLeaveRequests } from "@/lib/api/leave";
import { LeavePageClient, type MyLeaveInitialData } from "./LeavePageClient";

// Only the default "My Leave" tab is server-seeded — Approvals/Team
// Calendar/Policies stay client-fetched on tab switch, same reasoning as
// the Attendance page's "Team Today" tab.
export default async function LeaveManagementPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <LeavePageClient />;

  try {
    const initialMyLeave = await withOrgContext(userId, async (db) => {
      const [balances, requests] = await Promise.all([getMyLeaveBalances(db, userId, orgId), getMyLeaveRequests(db, userId, orgId)]);
      return { balances, requests } as unknown as MyLeaveInitialData;
    });
    return <LeavePageClient initialMyLeave={initialMyLeave} />;
  } catch {
    return <LeavePageClient />;
  }
}
