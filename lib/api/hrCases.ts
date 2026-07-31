// HR Batch 4 — HR Cases & Helpdesk. Full self-service raise, admin-managed
// resolution: any employee can raise/view their own case (hr_case:
// create_own/view_own), HR admin holds hr_case:manage for assignment,
// status, internal notes, categories, and org-wide oversight.
//
// Confidential cases (is_confidential=true) are visible only to hr_case:
// manage holders and the case's own raiser — never surfaced to a general
// "view all cases" caller who isn't a manage holder, and even a manage
// holder only sees confidential content by opening the specific case (the
// list endpoint still redacts subject/description for non-managers, but
// managers always see everything since they ARE the authorized handler
// tier).
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, hrCases } from "@/db/schema";
import { ApiError } from "./helpers";
import { hasPermission, requirePermission } from "./permissions";

export async function resolveOwnEmployeeId(db: OrgScopedDb, userId: string, orgId: string): Promise<string | null> {
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  return row?.id ?? null;
}

export function requireCaseCreateAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "hr_case", "create_own");
}

export function requireCaseManageAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "hr_case", "manage");
}

// hr_case:manage (HR admin/handler) OR the caller is the case's own
// raiser (hr_case:view_own) — the two tiers this module actually has.
export async function requireCaseViewAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<boolean> {
  if (await hasPermission(db, userId, orgId, "hr_case", "manage")) return true;
  const ownId = await resolveOwnEmployeeId(db, userId, orgId);
  if (ownId === employeeId && (await hasPermission(db, userId, orgId, "hr_case", "view_own"))) return false;
  throw new ApiError(403, "Not authorized to view this case");
}

export type HrCase = typeof hrCases.$inferSelect;

export async function getCaseOrThrow(db: OrgScopedDb, id: string): Promise<HrCase> {
  const [row] = await db.select().from(hrCases).where(eq(hrCases.id, id));
  if (!row) throw new ApiError(404, "Case not found");
  return row;
}
