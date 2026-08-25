import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listPayslipRecordsForPeriod, monthlyPeriods } from "@/lib/api/payroll";
import { listAllEmployees } from "@/lib/api/employees";
import { PayrollPageClient, type PayrollInitialData } from "./PayrollPageClient";

// Zero self-service in this pillar (compensation:view_sensitive required)
// — falls through to the client component with no initial data on denial,
// same as CRM's degrade-to-client pattern.
export default async function PayrollPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <PayrollPageClient />;

  try {
    const periods = monthlyPeriods();
    const initial = await withOrgContext(userId, async (db) => {
      const [records, employees] = await Promise.all([
        periods[0] ? listPayslipRecordsForPeriod(db, userId, orgId, periods[0].period_start, periods[0].period_end) : [],
        listAllEmployees(db, userId, orgId),
      ]);
      return { periods, records, employees } as unknown as PayrollInitialData;
    });
    return <PayrollPageClient initial={initial} />;
  } catch {
    return <PayrollPageClient />;
  }
}
