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
  | "integration"
  | "task_comment"
  // HR Batch 1 — onboarding templates/workflows aren't shaped like "read
  // an onboarding row" (there's no single onboarding entity a role reads);
  // they're "configure a template" / "assign a template to someone" /
  // "check off a step", so this gets its own resourceType with the
  // dedicated actions below rather than overloading employee:*.
  | "onboarding"
  // HR Batch 2 Part 3 — payslip_records lifecycle, kept separate from
  // "compensation" (see db/schema.ts's resourceTypeEnum comment).
  | "payroll"
  // HR Batch 3 — Performance Reviews & OKRs hybrid self+manager model,
  // split out of the old "performance" (see db/schema.ts's comment).
  | "review"
  | "okr"
  // AI Assistant build-out — Sprint Plans (Tier 1 approve-to-act) and
  // Documents (draft -> reviewed -> finalized). "Ask AI" and
  // "Recommendations" need no resourceType here (see db/schema.ts).
  | "sprint_plan"
  | "document"
  | "time"
  | "resource_forecast";

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
  | "view_sensitive"
  // HR Batch 1
  | "view_full"
  | "assign"
  | "complete_step"
  // HR Batch 2 — attendance self-service (replaces the old "record")
  | "record_own"
  | "view_own"
  | "view_all"
  | "edit_any"
  // HR Batch 2 — leave self-service (replaces the old "request")
  | "request_own"
  | "manage_balances"
  // HR Batch 2 Part 3 — payroll run lifecycle, admin-only by design.
  | "generate"
  | "finalize"
  | "mark_paid"
  // HR Batch 3 — Performance Reviews. view_own/view_all reused from
  // Attendance/Leave above.
  | "submit_self"
  | "submit_manager"
  | "view_team"
  // HR Batch 3 — OKRs. view_own/view_team/view_all reused.
  | "create_own"
  | "create_team"
  // HR Batch 3 — Recruitment (finer-grained than the old flat create/update).
  | "create_job"
  | "manage_candidates"
  | "schedule_interview"
  | "submit_feedback"
  // HR Batch 4 — HR Cases, Training, Surveys.
  | "manage"
  | "enroll_own"
  | "view_all_progress"
  | "respond"
  | "view_results"
  // CRM Batch 1 ("assign" reused from HR Batch 1)
  | "convert"
  // CRM Batch 2
  | "close"
  // CRM Batch 3
  | "set_target"
  | "log_own"
  | "submit";

// Non-throwing check — for response shaping (e.g. trimming fields to a
// "basic" subset when the caller lacks a *:view_full grant) rather than
// gating the request itself. Use requirePermission below for the latter.
export async function hasPermission(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
  resourceType: ResourceType,
  action: PermissionAction,
): Promise<boolean> {
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
  if (!membership) return false;

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

  return Boolean(grant);
}

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

  if (!(await hasPermission(db, userId, orgId, resourceType, action))) {
    throw new ApiError(403, `Role '${membership.role}' cannot ${action} ${resourceType}`);
  }
}
