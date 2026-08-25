// HR Batch 4 — Learning & Training. Self-service consumption (everyone can
// browse the catalog and enroll/mark their own progress), admin-only
// authoring (training:manage) and org-wide progress oversight
// (training:view_all_progress).
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, trainingCourses, trainingEnrollments } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";

export async function resolveOwnEmployeeId(db: OrgScopedDb, userId: string, orgId: string): Promise<string | null> {
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  return row?.id ?? null;
}

export function requireTrainingManageAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "training", "manage");
}

export function requireTrainingViewAllProgressAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "training", "view_all_progress");
}

// training:enroll_own + the enrollment's employeeId must resolve to the
// caller's own linked employees row — an employee can never edit someone
// else's enrollment/progress.
export async function requireEnrollmentOwnAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<void> {
  await requirePermission(db, userId, orgId, "training", "enroll_own");
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!ownId || ownId !== employeeId) {
    throw new ApiError(403, "You can only manage your own enrollment");
  }
}

// Shared by app/api/training/courses/route.ts and
// app/(app)/hr/training/page.tsx (server-rendered "Course Catalog" tab,
// the default).
export async function listAllCourses(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "training", "read");
  return db.select().from(trainingCourses).where(eq(trainingCourses.orgId, orgId));
}

// Shared by app/api/training/my-enrollments/route.ts and
// app/(app)/hr/training/page.tsx.
export async function getMyEnrollments(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "training", "view_own");
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (!ownId) return [];
  return db.select().from(trainingEnrollments).where(and(eq(trainingEnrollments.orgId, orgId), eq(trainingEnrollments.employeeId, ownId)));
}

export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;
