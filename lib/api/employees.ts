// Prompt 5.1/5.2 — several employee-scoped actions (onboarding, leave
// approval) aren't role-permission-grid entries ("the employee's manager"
// isn't a role), so they're checked here: a role-grid permission (HR admin)
// OR the current user is the target employee's manager (employees.managerId
// -> that manager's employees.userId matches the caller).
import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission, type PermissionAction, type ResourceType } from "./permissions";

export async function isManagerOf(db: OrgScopedDb, userId: string, orgId: string, employeeId: string): Promise<boolean> {
  const [target] = await db
    .select({ managerId: employees.managerId })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, orgId)));
  if (!target?.managerId) return false;

  const [manager] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, target.managerId));
  return manager?.userId === userId;
}

async function requireRoleOrManager(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  employeeId: string,
  resourceType: ResourceType,
  action: PermissionAction,
  errorMessage: string,
): Promise<void> {
  try {
    await requirePermission(db, userId, orgId, resourceType, action);
    return;
  } catch {
    // fall through to the manager check below
  }
  if (!(await isManagerOf(db, userId, orgId, employeeId))) {
    throw new ApiError(403, errorMessage);
  }
}

export function requireEmployeeManageAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string) {
  return requireRoleOrManager(
    db,
    userId,
    orgId,
    employeeId,
    "employee",
    "update",
    "Not authorized to manage this employee's onboarding",
  );
}

export function requireLeaveApproveAccess(db: OrgScopedDb, userId: string, orgId: string, employeeId: string) {
  return requireRoleOrManager(
    db,
    userId,
    orgId,
    employeeId,
    "leave",
    "approve",
    "Not authorized to approve this employee's leave request",
  );
}

// Prompt 5.3 — HR-admin-only (confirmed scope decision: HR Management has
// no employee self-service login path — see below). No self-view
// fallback: compensation:view_sensitive is the only way in.
export function requireCompensationViewAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "compensation", "view_sensitive");
}

// HR Batch 1 — server-side field trimming for employee:read vs
// employee:view_full. Everyone with employee:read (owner/admin/member/
// viewer, Prompt 5.1) sees PM-relevant fields only; view_full (owner/admin,
// migration 0070) additionally unlocks personal/sensitive fields — DOB,
// addresses, cost rate, notes. Trimming happens here, not in the UI, so a
// direct API call from a non-view_full role never receives the fields
// regardless of what the client renders.
type Employee = typeof employees.$inferSelect;
const FULL_ONLY_FIELDS = [
  "personalEmail",
  "dateOfBirth",
  "gender",
  "maritalStatus",
  "nationality",
  "address",
  "city",
  "state",
  "zipCode",
  "costRateHourly",
  "currency",
  "notes",
] as const satisfies readonly (keyof Employee)[];

export function trimEmployeeFields(row: Employee, canViewFull: boolean): Employee {
  if (canViewFull) return row;
  const trimmed: Record<string, unknown> = { ...row };
  for (const field of FULL_ONLY_FIELDS) delete trimmed[field];
  return trimmed as Employee;
}
