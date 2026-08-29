import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyAttendanceHistory, getMyAttendanceStats, getOrCreateSettings } from "@/lib/api/attendance";
import { AttendancePageClient, type MyAttendanceInitialData } from "./AttendancePageClient";

// Only the default "My Attendance" view is server-seeded — "Team Today"
// (admin-only, canViewAll-gated) stays client-fetched on tab switch, same
// as before; most visits never leave the default view.
export default async function AttendancePage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <AttendancePageClient />;

  try {
    const initialMyAttendance = await withOrgContext(userId, async (db) => {
      const settings = await getOrCreateSettings(db, orgId);
      const [stats, history] = await Promise.all([
        getMyAttendanceStats(db, userId, orgId),
        getMyAttendanceHistory(db, userId, orgId, 30),
      ]);
      return { settings, stats, history } as unknown as MyAttendanceInitialData;
    });
    return <AttendancePageClient initialMyAttendance={initialMyAttendance} />;
  } catch {
    return <AttendancePageClient />;
  }
}
