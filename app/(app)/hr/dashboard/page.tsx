import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllEmployees } from "@/lib/api/employees";
import { listPendingLeaveApprovals } from "@/lib/api/leave";
import { listTeamAttendanceForDate } from "@/lib/api/attendance";
import HrDashboardPageClient, { type HrDashboardInitialData } from "./HrDashboardPageClient";

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default async function HrDashboardPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId, grants } = await getCurrentOrg(userId);

  if (!orgId) return <HrDashboardPageClient />;

  const canViewAttendance = grants.some((g) => g.resourceType === "attendance" && g.action === "view_own");

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const days = last7Days();
      const today = days[days.length - 1];

      const [employees, pendingLeaveRows, attendanceByDay] = await Promise.all([
        listAllEmployees(db, userId, orgId),
        listPendingLeaveApprovals(db, userId, orgId).catch(() => []),
        canViewAttendance
          ? Promise.all(
              days.map((date) =>
                listTeamAttendanceForDate(db, userId, orgId, date)
                  .then((rows) => [date, rows] as [string, unknown[]])
                  .catch(() => [date, []] as [string, unknown[]]),
              ),
            )
          : Promise.resolve([] as [string, unknown[]][]),
      ]);

      const weekCounts: Record<string, number> = {};
      let todayRecords: unknown[] = [];
      for (const [date, rows] of attendanceByDay) {
        weekCounts[date] = rows.length;
        if (date === today) todayRecords = rows;
      }

      return {
        employees,
        pendingLeave: pendingLeaveRows.filter((r) => r.status === "pending").length,
        weekCounts,
        todayRecords,
      } as unknown as HrDashboardInitialData;
    });
    return <HrDashboardPageClient initial={initial} />;
  } catch {
    return <HrDashboardPageClient />;
  }
}
