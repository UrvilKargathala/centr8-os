// HR Batch 3 — Performance Reviews & OKRs. Hybrid self+manager model:
// distinct from Attendance/Leave's full self-service (everyone can act on
// their own record end-to-end) and Compensation's zero-self-service
// (admin-only, no employee access at all). Here an employee owns their
// self_assessment, their manager owns manager_assessment + final_rating,
// and HR admin can configure cycles and see everything — three separate
// tiers on the same row, not one shared self-service action.
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, performanceReviews } from "@/db/schema";
import { ApiError } from "./helpers";
import { hasPermission, requirePermission } from "./permissions";
import { isManagerOf } from "./employees";

export async function resolveOwnEmployeeId(db: OrgScopedDb, userId: string, orgId: string): Promise<string | null> {
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  return row?.id ?? null;
}

// review:submit_self + the review's employeeId must resolve to the
// caller's own linked employees row — an employee can never write another
// employee's self_assessment.
export async function requireReviewSelfAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<void> {
  await requirePermission(db, userId, orgId, "review", "submit_self");
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!ownId || ownId !== employeeId) {
    throw new ApiError(403, "You can only submit your own self-assessment");
  }
}

// review:submit_manager AND the caller is actually that employee's
// manager — the grant alone isn't sufficient, same shape as
// requireLeaveApproveAccess (lib/api/leave.ts).
export async function requireReviewManagerAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<void> {
  await requirePermission(db, userId, orgId, "review", "submit_manager");
  if (!(await isManagerOf(db, userId, orgId, employeeId))) {
    throw new ApiError(403, "You can only submit a manager assessment for your own reports");
  }
}

// review:view_all (HR admin, sees everything) OR review:view_own (it's
// the caller's own review) OR review:view_team + caller is the employee's
// manager.
export async function requireReviewViewAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<void> {
  if (await hasPermission(db, userId, orgId, "review", "view_all")) return;
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (ownId === employeeId && (await hasPermission(db, userId, orgId, "review", "view_own"))) return;
  if ((await hasPermission(db, userId, orgId, "review", "view_team")) && (await isManagerOf(db, userId, orgId, employeeId))) return;
  throw new ApiError(403, "Not authorized to view this review");
}

export function requireReviewConfigureAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "review", "configure");
}

// OKRs: create_own always allowed for your own employeeId; create_team
// requires the broader grant (freetext team_name, no manager-of check —
// "team-level" isn't tied to a specific employee in this schema).
export async function requireOkrCreateAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string | null): Promise<void> {
  if (employeeId) {
    await requirePermission(db, userId, orgId, "okr", "create_own");
    const ownId = await resolveOwnEmployeeId(db, userId, orgId);
    if (ownId !== employeeId) {
      // Not your own OKR — needs the team-tier grant instead (an HR
      // admin/manager setting an OKR on someone else's behalf).
      await requirePermission(db, userId, orgId, "okr", "create_team");
    }
    return;
  }
  await requirePermission(db, userId, orgId, "okr", "create_team");
}

export async function requireOkrViewAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string | null): Promise<void> {
  if (await hasPermission(db, userId, orgId, "okr", "view_all")) return;
  if (employeeId) {
    const ownId = await resolveOwnEmployeeId(db, userId, orgId);
    if (ownId === employeeId && (await hasPermission(db, userId, orgId, "okr", "view_own"))) return;
  }
  if (await hasPermission(db, userId, orgId, "okr", "view_team")) return;
  throw new ApiError(403, "Not authorized to view this OKR");
}

export type PerformanceReview = typeof performanceReviews.$inferSelect;

// Lazily creates the employee's review row for a cycle on first access —
// same "create on demand" pattern as leave_balances (lib/api/leave.ts's
// getOrCreateBalance) rather than bulk-instantiating a row per employee
// the moment a cycle is created.
export async function getOrCreateReview(db: OrgScopedDb, orgId: string, cycleId: string, employeeId: string): Promise<PerformanceReview> {
  const [existing] = await db
    .select()
    .from(performanceReviews)
    .where(and(eq(performanceReviews.cycleId, cycleId), eq(performanceReviews.employeeId, employeeId)));
  if (existing) return existing;

  const [created] = await db
    .insert(performanceReviews)
    .values({ orgId, cycleId, employeeId, status: "self_assessment_pending" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [row] = await db
    .select()
    .from(performanceReviews)
    .where(and(eq(performanceReviews.cycleId, cycleId), eq(performanceReviews.employeeId, employeeId)));
  return row;
}
