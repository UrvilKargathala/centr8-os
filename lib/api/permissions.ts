// FR-1.3 permission enforcement: table-driven, not per-route role checks.
// `permissions` (db/schema.ts) maps role -> allowed actions per resource
// type, with org_id nullable so org_id-null rows are the built-in role
// defaults (seeded in db/migrations/0008_seed_default_permissions.sql) and
// org_id-scoped rows let an org define its own custom roles or overrides.
import { and, eq, isNull, or } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { orgMemberships, permissions } from "@/db/schema";
import { ApiError } from "./helpers";

export type ResourceType =
  | "organization"
  | "department"
  | "team"
  | "goal"
  | "project"
  | "milestone"
  | "sprint"
  | "task"
  | "task_dependency"
  | "project_health_snapshot"
  | "budget"
  | "capacity"
  | "api_key"
  | "portal"
  | "sso"
  | "employee"
  | "attendance"
  | "leave"
  | "compensation"
  | "performance"
  | "recruitment"
  | "hr_case"
  | "training"
  | "engagement"
  | "holiday"
  | "lead"
  | "contact"
  | "account"
  | "deal"
  | "activity"
  | "forecast"
  | "campaign"
  | "integration";

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "configure"
  | "terminate"
  | "record"
  | "request"
  | "view_sensitive";

// Call inside the same withOrgContext(userId, ...) transaction the mutation
// itself runs in, right after the target resource's orgId is known.
export async function requirePermission(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  resourceType: ResourceType,
  action: PermissionAction,
): Promise<void> {
  const [membership] = await db
    .select({ role: orgMemberships.role })
    .from(orgMemberships)
    .where(
      and(
        eq(orgMemberships.userId, userId),
        eq(orgMemberships.orgId, orgId),
        isNull(orgMemberships.deactivatedAt),
      ),
    );

  if (!membership) {
    throw new ApiError(403, "Not a member of this organization");
  }

  const [grant] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(
      and(
        or(eq(permissions.orgId, orgId), isNull(permissions.orgId)),
        eq(permissions.role, membership.role),
        eq(permissions.resourceType, resourceType),
        eq(permissions.action, action),
      ),
    )
    .limit(1);

  if (!grant) {
    throw new ApiError(403, `Role '${membership.role}' cannot ${action} ${resourceType}`);
  }
}
