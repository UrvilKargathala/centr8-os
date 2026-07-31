import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getOrCreateSettings, isLateArrival, isWeekendDate, requireAttendanceViewAccess, resolveOwnEmployeeId } from "@/lib/api/attendance";

// Built from local y/m/d components directly rather than constructing a
// local Date and calling .toISOString() on it — that round-trip shifts
// the calendar date outside UTC (same bug fixed in weekdaysElapsed below
// and lib/api/leave.ts's countLeaveDays).
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfMonth(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function startOfWeek(): string {
  const d = new Date();
  const diff = d.getDate() - d.getDay(); // Sunday-start week
  return isoDate(new Date(d.getFullYear(), d.getMonth(), diff));
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const scopeParam = req.nextUrl.searchParams.get("scope");
    const scope = scopeParam === "org" ? "org" : scopeParam === "employee" ? "employee" : "me";
    const employeeIdParam = req.nextUrl.searchParams.get("employee_id");
    if (scope === "employee" && !employeeIdParam) throw new ApiError(400, "employee_id is required for scope=employee");

    const stats = await withOrgContext(userId, async (db) => {
      const settings = await getOrCreateSettings(db, orgId);
      const monthConditions = [eq(attendanceRecords.orgId, orgId), gte(attendanceRecords.workDate, startOfMonth())];

      if (scope === "org") {
        await requirePermission(db, userId, orgId, "attendance", "view_all");
      } else if (scope === "employee") {
        // Same permission shape as GET /api/attendance/employee/[id]:
        // attendance:view_all OR (attendance:view_own AND it's the
        // requester's own linked employee row).
        await requireAttendanceViewAccess(db, userId, orgId, employeeIdParam!);
        monthConditions.push(eq(attendanceRecords.employeeId, employeeIdParam!));
      } else {
        await requirePermission(db, userId, orgId, "attendance", "view_own");
        const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
        if (!employeeId) return null;
        monthConditions.push(eq(attendanceRecords.employeeId, employeeId));
      }

      const monthRecords = await db.select().from(attendanceRecords).where(and(...monthConditions));

      const workedDays = monthRecords.filter((r) => r.status === "checked_out" || r.status === "half_day" || r.status === "checked_in");
      const weekdaysElapsed = (() => {
        // UTC-stepped, same reasoning as lib/api/leave.ts's countLeaveDays —
        // constructing local-time Date objects and calling .toISOString()
        // on them shifts the calendar date outside UTC, silently
        // miscounting weekends.
        const start = new Date(`${startOfMonth()}T00:00:00Z`).getTime();
        const end = new Date(`${isoDate(new Date())}T00:00:00Z`).getTime();
        let count = 0;
        for (let t = start; t <= end; t += 86_400_000) {
          const iso = new Date(t).toISOString().slice(0, 10);
          if (!isWeekendDate(iso, settings.weekendDays as string[])) count++;
        }
        return count;
      })();
      const attendanceRatePercent = weekdaysElapsed > 0 ? Math.round((workedDays.length / weekdaysElapsed) * 100) : 0;

      const withMinutes = monthRecords.filter((r) => r.totalMinutes != null);
      const avgHoursPerDay = withMinutes.length
        ? Math.round((withMinutes.reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0) / withMinutes.length / 60) * 10) / 10
        : 0;

      const checkedInRecords = monthRecords.filter((r) => r.checkInTime);
      const lateRecords = checkedInRecords.filter((r) => isLateArrival(r.checkInTime!, r.workDate, settings));
      const onTimeRate = checkedInRecords.length
        ? Math.round(((checkedInRecords.length - lateRecords.length) / checkedInRecords.length) * 100)
        : 0;

      const weekStart = startOfWeek();
      const lateArrivalsThisWeek = lateRecords.filter((r) => r.workDate >= weekStart).length;

      return {
        attendance_rate_percent: attendanceRatePercent,
        avg_hours_per_day: avgHoursPerDay,
        late_arrivals_this_week: lateArrivalsThisWeek,
        on_time_rate: onTimeRate,
      };
    });

    return NextResponse.json({ data: stats });
  } catch (err) {
    return handleApiError(err);
  }
}
