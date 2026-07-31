// HR Batch 2 — Leave Management self-service. Same helper shape as
// lib/api/attendance.ts: permission wrappers plus the balance/day-count
// math every route needs, so it's written once and every route calls it.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, leaveBalances, leavePolicies, leaveTypes } from "@/db/schema";
import { ApiError } from "./helpers";
import { hasPermission, requirePermission } from "./permissions";
import { getOrCreateSettings, isWeekendDate } from "./attendance";
import { isManagerOf } from "./employees";

// leave:view_all (see anyone) OR leave:view_own + it's the caller's own
// linked employee row — identical shape to requireAttendanceViewAccess.
export async function requireLeaveViewAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<void> {
  if (await hasPermission(db, userId, orgId, "leave", "view_all")) return;
  await requirePermission(db, userId, orgId, "leave", "view_own");
  const [own] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  if (!own || own.id !== employeeId) {
    throw new ApiError(403, "Not authorized to view this employee's leave");
  }
}

// leave:approve (the base grant) AND (manager of the requester OR
// leave:view_all) — per Batch 2 spec, stricter than Attendance's
// self-access shape: having the approve action alone isn't enough, the
// caller also has to actually be in a position to approve *this* request.
export async function requireLeaveApproveAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<void> {
  await requirePermission(db, userId, orgId, "leave", "approve");
  if (await hasPermission(db, userId, orgId, "leave", "view_all")) return;
  if (await isManagerOf(db, userId, orgId, employeeId)) return;
  throw new ApiError(403, "You can only approve leave for your own reports");
}

export function requireLeaveConfigureAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "leave", "configure");
}

export function requireLeaveManageBalancesAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "leave", "manage_balances");
}

// Weekday-exclusive, inclusive of both endpoints — reuses the org's
// attendance_settings.weekend_days rather than hardcoding Sat/Sun.
//
// Iterates entirely in UTC (both endpoints parsed as "...T00:00:00Z" and
// stepped by exactly 86_400_000ms) rather than constructing local-time
// Date objects and calling .toISOString() on them — that round-trip
// shifts the calendar date whenever the server's local timezone isn't
// UTC (e.g. UTC+5:30 turns local midnight into the previous UTC evening),
// silently miscounting which days are weekends.
export async function countLeaveDays(db: OrgScopedDb, orgId: string, startDate: string, endDate: string): Promise<number> {
  const settings = await getOrCreateSettings(db, orgId);
  const weekendDays = settings.weekendDays as string[];
  let count = 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  for (let t = start; t <= end; t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (!isWeekendDate(iso, weekendDays)) count++;
  }
  return count;
}

export type LeaveBalance = typeof leaveBalances.$inferSelect;

// Finds the applicable active policy for this employee (matches
// applies_to against the employee's department/employment_type, falling
// back to the org's 'all' policy) and lazily creates the year's balance
// row from it if one doesn't already exist. Returns null if no policy
// covers this leave_type at all (e.g. a type with no policy configured yet).
export async function getOrCreateBalance(
  db: OrgScopedDb,
  orgId: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
): Promise<LeaveBalance | null> {
  const [existing] = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.orgId, orgId), eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.leaveTypeId, leaveTypeId), eq(leaveBalances.year, year)));
  if (existing) return existing;

  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) return null;

  const policies = await db
    .select()
    .from(leavePolicies)
    .where(and(eq(leavePolicies.orgId, orgId), eq(leavePolicies.leaveTypeId, leaveTypeId), eq(leavePolicies.isActive, true)));

  const specific = policies.find(
    (p) => p.appliesTo === `department:${employee.departmentId}` || p.appliesTo === `employment_type:${employee.employmentType}`,
  );
  const policy = specific ?? policies.find((p) => p.appliesTo === "all");
  if (!policy) return null;

  const [created] = await db
    .insert(leaveBalances)
    .values({
      orgId,
      employeeId,
      leaveTypeId,
      year,
      allottedDays: policy.annualAllotmentDays,
      carriedForwardDays: 0,
      usedDays: 0,
      pendingDays: 0,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a race with another concurrent first-request — read back the row
  // the other request just created.
  const [row] = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.orgId, orgId), eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.leaveTypeId, leaveTypeId), eq(leaveBalances.year, year)));
  return row ?? null;
}

export function remainingDays(balance: LeaveBalance): number {
  return balance.allottedDays + balance.carriedForwardDays - balance.usedDays - balance.pendingDays;
}

export type LeaveType = typeof leaveTypes.$inferSelect;

export async function getLeaveType(db: OrgScopedDb, leaveTypeId: string): Promise<LeaveType | undefined> {
  const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, leaveTypeId));
  return row;
}

// Shared by approve + reject: releases the pending_days a creation put "at
// risk", and — only on approval — moves that same amount into used_days.
// Rejection/cancellation never touch used_days (Part 1 spec).
export async function settlePendingDays(
  db: OrgScopedDb,
  orgId: string,
  employeeId: string,
  leaveTypeId: string,
  startDate: string,
  totalDays: number,
  outcome: "approved" | "released",
): Promise<void> {
  const [balance] = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.orgId, orgId), eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.leaveTypeId, leaveTypeId), eq(leaveBalances.year, new Date(startDate).getFullYear())));
  if (!balance) return;

  await db
    .update(leaveBalances)
    .set({
      pendingDays: Math.max(0, balance.pendingDays - totalDays),
      usedDays: outcome === "approved" ? balance.usedDays + totalDays : balance.usedDays,
      updatedAt: new Date(),
    })
    .where(eq(leaveBalances.id, balance.id));
}
