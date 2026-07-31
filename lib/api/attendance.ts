// HR Batch 2 — Attendance self-service. Mirrors lib/api/employees.ts's
// shape: small helpers wrapping requirePermission with the extra
// "is this actually the caller's own record" check self-service actions
// need, so every route calls the same logic instead of re-deriving it.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { attendanceSettings, employees } from "@/db/schema";
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
