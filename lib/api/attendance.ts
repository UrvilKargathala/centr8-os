// HR Batch 2 — Attendance self-service. Mirrors lib/api/employees.ts's
// shape: small helpers wrapping requirePermission with the extra
// "is this actually the caller's own record" check self-service actions
// need, so every route calls the same logic instead of re-deriving it.
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { attendanceRecords, attendanceSettings, employees } from "@/db/schema";
import { ApiError } from "./helpers";
import { hasPermission, requirePermission } from "./permissions";

export async function resolveOwnEmployeeId(db: OrgScopedDb, userId: string, orgId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  return row?.id ?? null;
}

// attendance:record_own + the target employeeId must resolve to the
// caller's own linked employees row — record_own does not let you punch
// someone else's card, that's attendance:edit_any (requireAttendanceEditAccess).
export async function requireAttendanceSelfAccess(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  employeeId: string,
): Promise<void> {
  await requirePermission(db, userId, orgId, "attendance", "record_own");
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!ownId || ownId !== employeeId) {
    throw new ApiError(403, "You can only check yourself in or out");
  }
}

// attendance:view_all (see anyone) OR attendance:view_own + it's the
// caller's own record.
export async function requireAttendanceViewAccess(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  employeeId: string,
): Promise<void> {
  if (await hasPermission(db, userId, orgId, "attendance", "view_all")) return;
  await requirePermission(db, userId, orgId, "attendance", "view_own");
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!ownId || ownId !== employeeId) {
    throw new ApiError(403, "Not authorized to view this employee's attendance");
  }
}

export function requireAttendanceEditAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "attendance", "edit_any");
}

export type AttendanceSettings = typeof attendanceSettings.$inferSelect;

export async function getOrCreateSettings(db: OrgScopedDb, orgId: string): Promise<AttendanceSettings> {
  const [existing] = await db.select().from(attendanceSettings).where(eq(attendanceSettings.orgId, orgId));
  if (existing) return existing;
  const [created] = await db.insert(attendanceSettings).values({ orgId }).returning();
  return created;
}

// >= min_hours_for_full_day -> checked_out (full day); >= min_hours_for_half_day
// -> half_day; below that -> half_day too (Batch 2 spec: "decide based on
// config" — treating a sub-half-day as half_day rather than a distinct
// short-day status keeps the status enum to what's actually used elsewhere
// in this app; total_minutes itself still records the real duration).
export function computeCheckoutStatus(totalMinutes: number, settings: AttendanceSettings): "checked_out" | "half_day" {
  const hours = totalMinutes / 60;
  if (hours >= settings.minHoursForFullDay) return "checked_out";
  return "half_day";
}

export function isLateArrival(checkInTime: Date, workDate: string, settings: AttendanceSettings): boolean {
  const [h, m] = settings.workdayStartTime.split(":").map(Number);
  const threshold = new Date(`${workDate}T00:00:00`);
  threshold.setHours(h, m + settings.lateCheckinThresholdMinutes, 0, 0);
  return checkInTime > threshold;
}

export function requestIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// Shared "is this date one of the org's configured weekend days" check —
// reused by attendance stats and Leave Management's weekday-exclusive day
// counting (lib/api/leave.ts) so there's exactly one place that reads
// attendance_settings.weekend_days, not a hardcoded Sat/Sun in each.
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export function isWeekendDate(dateStr: string, weekendDays: string[]): boolean {
  const day = DAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()];
  return weekendDays.includes(day);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfMonth(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function startOfWeek(): string {
  const d = new Date();
  const diff = d.getDate() - d.getDay();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), diff));
}

// Shared by app/api/attendance/stats?scope=me and
// app/(app)/hr/attendance/page.tsx (server-rendered initial load of the
// default "My Attendance" view). Only the scope=me case — org/employee
// scopes stay in the route, not worth extracting for one caller each.
export async function getMyAttendanceStats(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "attendance", "view_own");
  const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!employeeId) return null;

  const settings = await getOrCreateSettings(db, orgId);
  const monthRecords = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.orgId, orgId), eq(attendanceRecords.employeeId, employeeId), gte(attendanceRecords.workDate, startOfMonth())));

  const workedDays = monthRecords.filter((r) => r.status === "checked_out" || r.status === "half_day" || r.status === "checked_in");
  const weekdaysElapsed = (() => {
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
  const onTimeRate = checkedInRecords.length ? Math.round(((checkedInRecords.length - lateRecords.length) / checkedInRecords.length) * 100) : 0;

  const weekStart = startOfWeek();
  const lateArrivalsThisWeek = lateRecords.filter((r) => r.workDate >= weekStart).length;

  return {
    attendance_rate_percent: attendanceRatePercent,
    avg_hours_per_day: avgHoursPerDay,
    late_arrivals_this_week: lateArrivalsThisWeek,
    on_time_rate: onTimeRate,
  };
}

// Shared by app/api/attendance/my-history/route.ts and
// app/(app)/hr/attendance/page.tsx (server-rendered initial load).
export async function getMyAttendanceHistory(db: OrgScopedDb, userId: string, orgId: string, limit = 30) {
  await requirePermission(db, userId, orgId, "attendance", "view_own");
  const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!employeeId) return [];

  return db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.employeeId, employeeId))
    .orderBy(desc(attendanceRecords.workDate))
    .limit(limit);
}
