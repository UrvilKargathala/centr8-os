import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listHolidays } from "@/lib/api/holidays";
import HolidaysPageClient, { type Holiday } from "./HolidaysPageClient";

export default async function HolidaysPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <HolidaysPageClient />;

  try {
    const initial = await withOrgContext(userId, (db) => listHolidays(db, userId, orgId));
    return <HolidaysPageClient initial={initial as unknown as Holiday[]} />;
  } catch {
    return <HolidaysPageClient />;
  }
}
