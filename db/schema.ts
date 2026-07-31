import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// Neon has no built-in `auth` schema — 0000_auth_compat.sql defines
// auth.uid() and auth.user_org_ids() as Neon-side equivalents of Supabase's
// helpers, driven by a `request.jwt.claim.sub` session var the app sets
// per request. All policies below key off auth.user_org_ids().
const inUserOrgs = sql`org_id in (select * from auth.user_org_ids())`;

export const actorTypeEnum = pgEnum("actor_type", ["human", "ai"]);

// Built-in role names seeded into `permissions` (0009_seed_default_permissions.sql).
// org_memberships.role is plain text, not this enum, so an org admin can
// assign any custom role name — FR-1.3 requires custom roles, which rules
// out a closed Postgres enum for the column itself.
export const BUILT_IN_ROLES = ["owner", "admin", "member", "viewer"] as const;

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    brandingConfig: jsonb("branding_config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("organizations_isolation", {
      for: "all",
      to: authenticatedRole,
      using: sql`id in (select * from auth.user_org_ids())`,
      withCheck: sql`id in (select * from auth.user_org_ids())`,
    }),
  ],
).enableRLS();

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentDepartmentId: uuid("parent_department_id"),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("departments_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("teams_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const orgMemberships = pgTable(
  "org_memberships",
  {
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    // Prompt 3.3 — SCIM deprovisioning ("deactivate a user"). Kept as a
    // nullable timestamp rather than deleting the row outright, same
    // revoke-not-delete reasoning as api_keys.revokedAt / client_portal_
    // access.revokedAt: the membership's history (role, team) survives a
    // deactivation. requirePermission() below treats a deactivated
    // membership as if it doesn't exist.
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    pgPolicy("org_memberships_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    primaryKey({ columns: [table.userId, table.orgId] }),
  ],
).enableRLS();

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id"),
    actorType: actorTypeEnum("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("audit_log_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Work hierarchy (FR-2.x): Goals -> Portfolios -> Projects -> Milestones -> Sprints -> Tasks ---

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
]);
export const sprintStatusEnum = pgEnum("sprint_status", ["planned", "active", "completed"]);
export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const dependencyTypeEnum = pgEnum("dependency_type", ["blocks", "blocked_by"]);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id"),
  },
  () => [
    pgPolicy("goals_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("portfolios_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: projectStatusEnum("status").notNull().default("planning"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // FR-3.x (Prompt 3.2) — simple manual entry, no external finance
    // integration. Nullable: a project has no budget until someone sets
    // one. precision 12/scale 2 matches ordinary currency amounts.
    budgetAllocated: numeric("budget_allocated", { precision: 12, scale: 2, mode: "number" }),
    budgetSpent: numeric("budget_spent", { precision: 12, scale: 2, mode: "number" }),
  },
  () => [
    pgPolicy("projects_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dueDate: date("due_date"),
    // FR-4.x (Prompt 3.1) task 3 — Tier 1 client-approval action. At most
    // one of the two approvedBy* columns is ever set: an internal org
    // member approves via app/api/milestones/[id]/approve, a client
    // approves via the token-authed app/api/portal/[org_slug]/milestones/
    // [id]/approve — both funnel through lib/api/milestoneApproval.ts so
    // the audit_log entry is identical either way.
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id"),
    approvedByClientAccessId: uuid("approved_by_client_access_id").references(() => clientPortalAccess.id, {
      onDelete: "set null",
    }),
  },
  () => [
    pgPolicy("milestones_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: sprintStatusEnum("status").notNull().default("planned"),
  },
  () => [
    pgPolicy("sprints_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sprintId: uuid("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("backlog"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id"),
    estimate: integer("estimate"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("tasks_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// task_dependencies has no org_id column (per spec) — it's a pure edge table
// between two tasks, so isolation is enforced by joining back to tasks
// rather than the usual org_id-in-user_org_ids() check.
const dependencyEndpointsInUserOrgs = sql`
  exists (
    select 1 from tasks t
    where t.id = task_dependencies.task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
  and exists (
    select 1 from tasks t
    where t.id = task_dependencies.depends_on_task_id
      and t.org_id in (select * from auth.user_org_ids())
  )
`;

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: dependencyTypeEnum("type").notNull(),
  },
  (table) => [
    pgPolicy("task_dependencies_isolation", {
      for: "all",
      to: authenticatedRole,
      using: dependencyEndpointsInUserOrgs,
      withCheck: dependencyEndpointsInUserOrgs,
    }),
    primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    check("task_dependencies_no_self_reference", sql`${table.taskId} <> ${table.dependsOnTaskId}`),
  ],
).enableRLS();

// templates.org_id is nullable: null == a global template visible to every
// org. Anyone can read global templates, but only service_role (bypassing
// RLS) can write one — the mutation policy still requires org_id to be in
// the caller's own orgs, same as everywhere else.
export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    structure: jsonb("structure").notNull().default({}),
  },
  () => [
    pgPolicy("templates_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`org_id is null or org_id in (select * from auth.user_org_ids())`,
    }),
    pgPolicy("templates_write", {
      for: "insert",
      to: authenticatedRole,
      withCheck: inUserOrgs,
    }),
    pgPolicy("templates_update", {
      for: "update",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    pgPolicy("templates_delete", {
      for: "delete",
      to: authenticatedRole,
      using: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Permissions (FR-1.3): role -> allowed actions per resource type ---

export const resourceTypeEnum = pgEnum("resource_type", [
  "organization",
  "department",
  "team",
  "goal",
  "project",
  "milestone",
  "sprint",
  "task",
  "task_dependency",
  "project_health_snapshot",
  // FR-3.x (Prompt 3.2) — budget fields live on `projects` itself (no
  // separate row/table to protect), so "budget" only ever needs an
  // "update" grant. "capacity" and "api_key" are real tables below.
  "budget",
  "capacity",
  "api_key",
  // FR-4.x (Prompt 3.1) — client_portal_access grants live under their
  // own resource type ("configure" covers create/update/revoke as one
  // verb, same simplification "budget:update" used in Prompt 3.2).
  // "milestone" already exists above; it just gains the "approve" action.
  "portal",
  // Prompt 3.3 — SSO/SAML config. Named "sso" (a real resourceType, action
  // "configure") rather than the prompt's literal suggested permission
  // name "org:configure_sso" — a resource-specific action string would
  // break the whole point of a shared resourceType x action matrix.
  // Same tightness/shape as "portal" and "api_key": owner/admin only.
  "sso",
  // Prompt 5.1 (HR Management, CLAUDE.md §11a) — employee directory
  // records. Onboarding workflows aren't a separate resourceType: they're
  // gated by employee:update (HR admin) OR a direct manager check against
  // employees.managerId, not a role-permission-grid entry (see
  // lib/api/employees.ts).
  "employee",
  // Prompt 5.2 — attendance_records. Only ever needs "record" (an
  // employee punching their own in/out) — reads ride along on ordinary
  // employee-scoped fetches, no separate "read" grant needed.
  "attendance",
  // Prompt 5.2 — leave_requests + leave_policies. "request" (an employee
  // submitting/self-managing their own request) and "approve" (existing
  // action, reused — same verb milestone approval already uses) are the
  // two real actions; policy CRUD rides on the existing "configure"
  // action (owner/admin only), same shape as "sso"/"portal".
  "leave",
  // Prompt 5.3 — compensation_records. Deliberately its own resourceType,
  // not folded into "employee", so a role can be granted ordinary
  // employee:read (name/title/department — directory-level info) without
  // that also exposing salary. Nothing but "view_sensitive" (+ordinary
  // create/update/delete for HR admin) is ever granted here — no
  // member/viewer default the way most other resource types get.
  "compensation",
  // Prompt 5.4 — the remaining HR Management modules. Consolidated by
  // module rather than by table (performance covers both
  // performance_reviews and okrs; recruitment covers both job_postings
  // and candidates; training covers both training_courses and
  // training_completions; engagement covers both engagement_surveys and
  // survey_responses) — same reasoning as "leave" covering both
  // leave_requests and leave_policies. All reuse the existing
  // create/read/update/delete actions, no new permission_action values
  // needed. Owner/admin only by default, same HR-admin-only precedent
  // confirmed for attendance/leave/compensation in this app (no employee
  // self-service login path for HR Management) — see lib/api/employees.ts
  // and CLAUDE.md §11a's Current Status note.
  "performance",
  "recruitment",
  "hr_case",
  "training",
  "engagement",
  // Company Holidays list (org-wide, one-off dated entries — no
  // recurrence logic). Same HR-admin-only-data-entry default as the rest
  // of HR Management.
  "holiday",
  // Phase 6 (CRM, CLAUDE.md §11a) — Leads, Contacts, Accounts. Unlike HR
  // Management, CRM data is a shared sales-team working set, not
  // admin-restricted: owner/admin/member all get full CRUD (same "things
  // people do day to day" tier as task/task_dependency in
  // 0008_seed_default_permissions.sql), viewer stays read-only.
  "lead",
  "contact",
  "account",
  // Prompt 6.2 — Deals/Pipeline & Activities. Same "shared sales-team
  // working set" tier as lead/contact/account: owner/admin/member full
  // CRUD, viewer read-only.
  "deal",
  "activity",
  // Prompt 6.3 — Sales Forecasts & Campaigns. Same tier as the rest of
  // Phase 6.
  "forecast",
  "campaign",
  // Phase 7 (Communication, CLAUDE.md §11a) — connector framework.
  // "integration", action "configure", rather than the prompt's literal
  // suggested permission name "org:configure_integrations" — a
  // resource-specific action string would break the whole point of a
  // shared resourceType x action matrix (same reasoning as "sso" for
  // Prompt 3.3). Owner/admin only, same tightness as sso/api_key/portal:
  // integration credentials are org-wide, not per-user.
  "integration",
  // Task comments (first collaboration surface). CRUD; delete gated to author
  // or admin in application code, not surfaced as a separate permission.
  "task_comment",
  // HR Batch 1 — onboarding templates/workflows (see PermissionAction's
  // "assign"/"complete_step" below for why this isn't folded into "employee").
  "onboarding",
  // HR Batch 2 Part 3 — payslip_records lifecycle (generate/finalize/
  // mark_paid below). Deliberately its own resourceType rather than
  // folded into "compensation": a role could in principle run payroll
  // generation without holding compensation:update (editing a person's
  // salary record) — same reasoning "leave" got its own type instead of
  // riding on "employee".
  "payroll",
  // HR Batch 3 — Performance Reviews & OKRs restructured to a hybrid
  // self+manager model (distinct from Attendance/Leave's full self-service
  // and Compensation's zero-self-service — see CLAUDE.md §11a). Split out
  // of the old "performance" resourceType into two so a role's view/submit
  // scope for reviews and OKRs can differ (e.g. everyone gets okr:create_own
  // but review:submit_manager is manager-tier only).
  "review",
  "okr",
]);
export const permissionActionEnum = pgEnum("permission_action", [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "configure",
  // Prompt 5.1 — distinct from "delete": terminating an employee sets
  // employment_status to 'terminated' and end_date, the record stays
  // (same revoke-not-delete reasoning as org_memberships.deactivatedAt).
  "terminate",
  // Prompt 5.2 — an employee recording their own attendance or
  // submitting their own leave request isn't "create" in the ordinary
  // permission-grid sense (it's self-scoped, checked against
  // employees.userId in application code, same as onboarding's manager
  // check) — distinct verbs make that self-scoping explicit in the grid
  // rather than overloading "create" to mean two different things.
  "record",
  "request",
  // Prompt 5.3 — separate from "read" specifically so an org could (in
  // principle) grant ordinary employee:read without also exposing
  // compensation; a manager's employee:update grant (they can edit job
  // title, department) still does NOT imply view_sensitive — compensation
  // access is HR-admin-grant-only plus the employee's own record, per the
  // prompt's "not even their manager, unless explicitly granted."
  "view_sensitive",
  // HR Batch 1
  "view_full",
  "assign",
  "complete_step",
  // HR Batch 2 — Attendance self-service (replaces the old owner/admin-only
  // "record" action for attendance specifically; see CLAUDE.md §11a for the
  // reversal of the original no-self-service decision, scoped to this one
  // module only).
  "record_own",
  "view_own",
  "view_all",
  "edit_any",
  // HR Batch 2 — Leave self-service. view_own/view_all are reused from
  // Attendance above (same "see my own"/"see everyone's" shape); only
  // request_own and manage_balances are genuinely new actions.
  "request_own",
  "manage_balances",
  // HR Batch 2 Part 3 — payroll run lifecycle. Admin-only by design (see
  // CLAUDE.md §11a: Payroll & Compensation has zero self-service,
  // deliberately and permanently, unlike Attendance/Leave).
  "generate",
  "finalize",
  "mark_paid",
  // HR Batch 3 — Performance Reviews (hybrid self+manager model). view_own/
  // view_all reused from above; submit_self/submit_manager/view_team are
  // the genuinely new actions this module needs.
  "submit_self",
  "submit_manager",
  "view_team",
  // HR Batch 3 — OKRs. view_own/view_all/view_team reused; create_own/
  // create_team distinguish "anyone can set their own OKRs" from
  // "team-level OKRs need a manager/HR-admin grant."
  "create_own",
  "create_team",
  // HR Batch 3 — Recruitment. "read" is reused for recruitment:view
  // (renamed in the permission grid's action, not a new enum value); these
  // three are genuinely new, finer-grained than the old flat create/update.
  "create_job",
  "manage_candidates",
  "schedule_interview",
  "submit_feedback",
  // HR Batch 4 — HR Cases, Training, Surveys. create_own/view_own/view_all
  // reused from above (self-raise/self-enroll/self-respond vs. HR-admin
  // oversight, same "full self-service + admin resolution" shape as
  // Attendance/Leave). "manage" covers case assignment+resolution, course
  // authoring, and survey authoring — one action per module rather than
  // three separate "manage_cases"/"manage_courses"/"manage_surveys" enum
  // values, since each is already scoped by its own resourceType.
  "manage",
  "enroll_own",
  "view_all_progress",
  "respond",
  "view_results",
  // CRM Batch 1 — lead/account/contact "convert" is deliberately separate
  // from "update": a role can edit a lead's fields without being trusted
  // to execute the one-way conversion into a new account+contact.
  // "assign" already exists (HR Batch 1, onboarding template assignment)
  // and is reused here for lead/account/contact reassignment — same
  // generic-action-reused-across-resourceTypes shape as view_own/view_all.
  "convert",
  // CRM Batch 2 — deal:close is separate from deal:update: closing a deal
  // (won or lost) has financial/reporting implications, same reasoning as
  // lead:convert being separate from lead:update.
  "close",
  // CRM Batch 3 — forecast:set_target is separate from update/create:
  // setting quota targets is a manager/admin action distinct from viewing
  // the (always-computed-live) forecast itself.
  "set_target",
]);

// org_id nullable, same pattern as `templates`: null rows are the built-in
// role defaults (owner/admin/member/viewer) visible to every org. An org
// defining a custom role (any role name not in BUILT_IN_ROLES) adds its own
// org_id-scoped rows here — requirePermission() (lib/api/permissions.ts)
// checks both scopes, so an org-specific grant/deny always coexists with,
// rather than requires editing, the global defaults.
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    resourceType: resourceTypeEnum("resource_type").notNull(),
    action: permissionActionEnum("action").notNull(),
  },
  () => [
    pgPolicy("permissions_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`org_id is null or org_id in (select * from auth.user_org_ids())`,
    }),
    pgPolicy("permissions_write", {
      for: "insert",
      to: authenticatedRole,
      withCheck: inUserOrgs,
    }),
    pgPolicy("permissions_update", {
      for: "update",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    pgPolicy("permissions_delete", {
      for: "delete",
      to: authenticatedRole,
      using: inUserOrgs,
    }),
  ],
).enableRLS();

// --- AI health monitoring (FR-8.x subset), Tier 0 — read-only signal ---
// A snapshot is an immutable point-in-time record: computed signals (task/
// sprint counts, overdue/blocked tallies) plus a Gemini-written plain-
// language summary. Nothing here ever writes to goals/projects/milestones/
// sprints/tasks — see app/api/ai/project-health/route.ts.
export const projectHealthSnapshots = pgTable(
  "project_health_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    signals: jsonb("signals").notNull().default({}),
    aiSummary: text("ai_summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("project_health_snapshots_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Agent job queue (Prompt 2.1) ---
// CLAUDE.md §5/§6: five composable agents (Planner/Monitor/Analyst/Writer/
// Communicator), coordinated by a Railway worker polling this table via
// `SELECT ... FOR UPDATE SKIP LOCKED` (workers/agent-worker.ts) — not
// called inline from a Next.js request. API routes insert a row here and
// poll it for a result instead of calling Gemini directly.
export const agentTypeEnum = pgEnum("agent_type", [
  "planner",
  "monitor",
  "analyst",
  "writer",
  "communicator",
]);
// Mirrors CLAUDE.md §4's four autonomy tiers exactly (tier_0 = Suggest
// Only ... tier_3 = Full Autonomy) — every job is stamped with the tier
// the acting agent ran at, independent of the job's pass/fail outcome.
export const autonomyTierEnum = pgEnum("autonomy_tier", ["tier_0", "tier_1", "tier_2", "tier_3"]);
export const agentJobStatusEnum = pgEnum("agent_job_status", ["pending", "processing", "done", "failed"]);

export const agentJobs = pgTable(
  "agent_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentType: agentTypeEnum("agent_type").notNull(),
    // Free text, not an enum — mirrors audit_log.action's convention
    // (e.g. "create_project_draft", "project_health_scan") so adding a new
    // job type never needs a migration, only a new registry entry
    // (lib/agents/registry.ts).
    jobType: text("job_type").notNull(),
    tier: autonomyTierEnum("tier").notNull().default("tier_0"),
    status: agentJobStatusEnum("status").notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id"),
    input: jsonb("input").notNull().default({}),
    output: jsonb("output"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("agent_jobs_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Resource planning & budgeting (FR-3.x, Prompt 3.2) ---

// One row per person per sprint — "how many points/hours they're available
// for," set manually by a PM (no capacity-forecasting AI here, this is
// Tier 0/no-AI per the prompt). Workload is never stored: it's always
// computed live from tasks.estimate at read time (see app/api/capacity/
// route.ts), so it can never drift from the actual assignments.
export const sprintCapacities = pgTable(
  "sprint_capacities",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sprintId: uuid("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    capacity: integer("capacity").notNull(),
  },
  (table) => [
    pgPolicy("sprint_capacities_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
    primaryKey({ columns: [table.sprintId, table.userId] }),
  ],
).enableRLS();

// Machine-auth credentials for the read-only finance export
// (app/api/v1/finance/projects/route.ts) — external accounting/ERP tools
// have no Supabase user session, so they can't use the Bearer-JWT path
// every other route uses. Only `keyHash` (sha256 of the raw key) is ever
// stored; the raw key is shown once at creation and never persisted.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("api_keys_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- Client portals (FR-4.x, Prompt 3.1) ---

// One row = one client's access to one project, identified by a bearer
// token in the portal URL rather than a Supabase Auth account — client
// contacts aren't org members and shouldn't need one just to view a
// project. If a client needs multiple projects they get multiple grants
// (multiple links); no separate "client identity" table, kept deliberately
// simple. Same "machine auth via a hashed secret, not a user JWT" shape as
// api_keys (Prompt 3.2) — see lib/api/portalAccess.ts.
export const clientPortalAccess = pgTable(
  "client_portal_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    // Field-level visibility (task 1: "configurable visibility per
    // field") — an array of field names hidden from this client. Only
    // "budget" is a real switch today (the one field Prompt 3.2 actually
    // added); the column is jsonb/array-shaped, not a single boolean, so
    // hiding more fields later is a UI/read-path change, not a migration.
    hiddenFields: jsonb("hidden_fields").notNull().default(["budget"]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("client_portal_access_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// --- SSO/SAML configuration (Prompt 3.3) ---

export const ssoProviderEnum = pgEnum("sso_provider", ["saml"]);

// One row per org (unique orgId). Storing IdP metadata even though the
// login flow itself can't go live yet — see the "requires Supabase Team
// plan" note on `enabled` below — so an admin's setup work isn't lost and
// the moment the plan is upgraded, wiring the flow is a small change, not
// a data-model change too.
export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    orgId: uuid("org_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: ssoProviderEnum("provider").notNull().default("saml"),
    idpEntityId: text("idp_entity_id"),
    idpSsoUrl: text("idp_sso_url"),
    idpCertificate: text("idp_certificate"),
    // Always false in this codebase today — Supabase Auth's SAML SSO is a
    // Team-plan feature ($599/mo), not available on the Free/Pro tiers
    // this project runs on (CLAUDE.md §2: no paid infra without a flagged
    // phase-gate decision). The config UI writes everything above but
    // refuses to set this true; flip it only after confirming the
    // Supabase project has actually been upgraded, then wire the real
    // Supabase `auth.sso` provider registration on top of this row.
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("sso_configurations_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Employee Directory & Onboarding (Prompt 5.1, CLAUDE.md §11a) ---

// CRM Batch 1 — "lost" added as a terminal status alongside "converted"
// (leads.lostReason is only meaningful once this exists).
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "unqualified", "converted", "lost"]);
// CRM Batch 2 — "discovery" and "contract_sent" added between prospecting
// and negotiation/won, matching the pipeline's Kanban columns.
export const dealStageEnum = pgEnum("deal_stage", ["prospecting", "discovery", "proposal", "negotiation", "contract_sent", "won", "lost"]);
export const activityRelatedTypeEnum = pgEnum("activity_related_type", ["lead", "contact", "account", "deal"]);
// CRM Batch 1 — "email"/"status_change"/"conversion" added for the
// richer CRM timeline (conversion specifically logs lead->account/contact).
export const activityTypeEnum = pgEnum("activity_type", ["call", "meeting", "task", "note", "email", "status_change", "conversion"]);
// CRM Batch 1 — account type/status. Kept as enums (unlike lead/campaign
// "source"/"type", which stay free text) since these drive UI badge
// coloring and KPI bucketing, a closed fixed set rather than open-ended.
export const accountTypeEnum = pgEnum("account_type", ["prospect", "customer", "partner", "vendor", "other"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "inactive", "churned"]);
// CRM Batch 3 — "draft"/"paused" added alongside the pre-existing
// "planned"/"cancelled" (0 rows existed, kept rather than dropped, same
// dead-label tolerance as leadStatusEnum's history) so campaigns.status
// matches the new spec's draft/active/paused/completed vocabulary.
export const campaignStatusEnum = pgEnum("campaign_status", ["planned", "draft", "active", "paused", "completed", "cancelled"]);
export const forecastPeriodTypeEnum = pgEnum("forecast_period_type", ["monthly", "quarterly", "annual"]);
export const integrationProviderEnum = pgEnum("integration_provider", ["slack", "gmail", "zoom"]);
export const integrationStatusEnum = pgEnum("integration_status", ["connected", "disconnected", "error"]);

export const employmentStatusEnum = pgEnum("employment_status", [
  "active",
  "onboarding",
  "terminated",
  // HR Batch 1 — added alongside the employees table extension. New values
  // on an existing enum need their own migration (Postgres can't use a
  // value in the same transaction that adds it), so these are introduced
  // in 0068 and used starting 0069, same two-step pattern as every other
  // enum extension in this file (e.g. "task_comment" on resource_type).
  "on_leave",
  "notice_period",
]);
export const onboardingStatusEnum = pgEnum("onboarding_status", ["not_started", "in_progress", "complete"]);
// HR Batch 1 — Employee Directory "Work Info" step.
export const employmentTypeEnum = pgEnum("employment_type", ["full_time", "part_time", "contract", "intern", "consultant"]);

// user_id is nullable and unreferenced (no FK, same as org_memberships.
// userId — Neon has no local `auth.users` table to reference) because not
// every employee has app login; a record for someone who never gets a
// Centr8 OS account is still valid.
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    managerId: uuid("manager_id"),
    employmentStatus: employmentStatusEnum("employment_status").notNull().default("onboarding"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // Personal info (HR admin data-entry UI, "New Employee" multi-step
    // form) — all nullable, none of it required to create a bare-minimum
    // record. No photo/document storage: this app has no file/blob
    // storage in the stack (CLAUDE.md §2); flagged rather than silently
    // added.
    email: text("email"),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth"),
    gender: text("gender"),
    maritalStatus: text("marital_status"),
    nationality: text("nationality"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    // HR Batch 1 (Employee Directory + Onboarding) — extending this table
    // rather than building a parallel one on `people` (the PM Team
    // Directory's resourcing entity). Migrating employees -> people would
    // require retargeting 9 FKs across already-built HR Batch 2-4 modules
    // (attendance, leave, compensation, performance, recruitment, cases,
    // training, engagement) — out of scope for this batch, confirmed with
    // Urvil. `people` stays untouched, PM keeps working exactly as before.
    employeeCode: text("employee_code"),
    personalEmail: text("personal_email"),
    country: text("country").default("India"),
    location: text("location"),
    employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
    availableHoursPerWeek: integer("available_hours_per_week").notNull().default(40),
    roles: jsonb("roles").notNull().default([]),
    skills: jsonb("skills").notNull().default([]),
    costRateHourly: numeric("cost_rate_hourly", { precision: 10, scale: 2, mode: "number" }),
    currency: text("currency").default("INR"),
    // HR-admin-only field (same "no employee self-service" boundary as
    // compensation below) — never returned unless the caller has
    // employee:view_full.
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("employees_org_code_unique").on(t.orgId, t.employeeCode),
    pgPolicy("employees_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// One workflow per employee. `steps` is a jsonb checklist
// ({label, done}[]) rather than its own child table — onboarding steps
// are always viewed/edited as one whole list, never queried individually,
// so a normalized table would only add joins with no real benefit.
export const onboardingWorkflows = pgTable(
  "onboarding_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    // Each step object: { step_id, title, description, category, owner_role,
    // days_after_start, status: 'pending'|'in_progress'|'completed'|'skipped',
    // completed_by, completed_at, notes }. Cloned from the template's
    // structure.steps at assignment time so editing a template later
    // doesn't retroactively change an in-flight employee's checklist.
    steps: jsonb("steps").notNull().default([]),
    status: onboardingStatusEnum("status").notNull().default("not_started"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("onboarding_workflows_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Attendance, Time Tracking & Leave Management (Prompt 5.2,
// restructured for self-service in HR Batch 2 — CLAUDE.md §11a) ---

// "present"/"remote" are pre-Batch-2 leftovers — Postgres can't drop enum
// values without recreating the type, and nothing references them anymore
// (the 2 rows that used them were deleted in migration 0072), so they're
// harmless dead labels rather than something worth a type-recreation
// migration to clean up.
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "half_day",
  "remote",
  // HR Batch 2 additions
  "checked_in",
  "checked_out",
  "on_leave",
  "holiday",
  "weekend",
]);
export const leaveRequestStatusEnum = pgEnum("leave_request_status", [
  "pending",
  "approved",
  "rejected",
  // HR Batch 2 — self-service cancellation (an employee can withdraw their
  // own still-pending request).
  "cancelled",
]);

// One row per employee per day. HR Batch 2 — self-service: an employee
// checks themself in/out (lib/api/attendance.ts's requireAttendanceSelfAccess
// enforces record_own + that employeeId resolves to the caller's own
// employees.userId row), OR an HR admin with attendance:edit_any creates a
// manual entry / edits any row (is_manual_entry + manual_entry_reason +
// edited_by/edited_at trail preserve the distinction — see CLAUDE.md §11a).
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    checkInTime: timestamp("check_in_time", { withTimezone: true }),
    checkOutTime: timestamp("check_out_time", { withTimezone: true }),
    totalMinutes: integer("total_minutes"),
    status: attendanceStatusEnum("status").notNull().default("checked_in"),
    checkInNote: text("check_in_note"),
    checkOutNote: text("check_out_note"),
    location: text("location"),
    locationDetail: text("location_detail"),
    // Captured server-side from request headers at check-in — never trusted
    // from the client body.
    ipAddress: text("ip_address"),
    deviceInfo: text("device_info"),
    isManualEntry: boolean("is_manual_entry").notNull().default(false),
    manualEntryReason: text("manual_entry_reason"),
    // No local FK target for actor ids anywhere in this schema (Neon has no
    // real auth.users table — Supabase Auth owns that) — same unreferenced-
    // uuid convention as orgMemberships.userId / compensationRecords.createdByUserId.
    editedBy: uuid("edited_by"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attendance_records_org_employee_date_unique").on(t.orgId, t.employeeId, t.workDate),
    pgPolicy("attendance_records_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// One row per org — check-in/out policy config (workday hours, weekend
// days, late-arrival threshold). Singleton-per-org, so org_id is the PK
// rather than a separate uuid id, same pattern as sso_configurations.
export const attendanceSettings = pgTable(
  "attendance_settings",
  {
    orgId: uuid("org_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workdayStartTime: time("workday_start_time").notNull().default("09:00"),
    workdayEndTime: time("workday_end_time").notNull().default("18:00"),
    workdayHoursTarget: numeric("workday_hours_target", { precision: 4, scale: 2, mode: "number" }).notNull().default(8.0),
    minHoursForFullDay: numeric("min_hours_for_full_day", { precision: 4, scale: 2, mode: "number" }).notNull().default(7.0),
    minHoursForHalfDay: numeric("min_hours_for_half_day", { precision: 4, scale: 2, mode: "number" }).notNull().default(4.0),
    weekendDays: jsonb("weekend_days").notNull().default(["saturday", "sunday"]),
    requireLocation: boolean("require_location").notNull().default(false),
    requireNoteOnLateCheckin: boolean("require_note_on_late_checkin").notNull().default(false),
    lateCheckinThresholdMinutes: integer("late_checkin_threshold_minutes").notNull().default(15),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  () => [
    pgPolicy("attendance_settings_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// HR Batch 2 — Leave Management restructured for self-service (CLAUDE.md
// §11a). Replaces Prompt 5.2's shape in place: leave_policies used to
// double as "the type" (a policy was just a name + days/year); now a
// leave_type is the category employees pick from (Annual/Sick/Casual/...)
// and a leave_policy is the allotment rule attached to it — separated so
// the same type can have different policies per department/employment
// type later (applies_to) without duplicating the type's color/approval/
// paid-ness metadata.
export const leaveTypes = pgTable(
  "leave_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // DESIGN_SYSTEM.md token hex values, not arbitrary colors — swatches/
    // bars render this directly, so it has to already match a token.
    color: text("color").notNull().default("#2E62F0"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    isPaid: boolean("is_paid").notNull().default(true),
    maxConsecutiveDays: integer("max_consecutive_days"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("leave_types_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// applies_to is a simple string filter ('all' | 'department:<id>' |
// 'employment_type:<value>') rather than a join table — Batch 2 only
// needs coarse targeting; a real eligibility-rules engine is future work.
// accrual_method: only 'annual_lump_sum' has real logic (lazy-init a
// leave_balances row with the full annual_allotment_days up front);
// 'monthly_accrual' is accepted but not yet computed differently — TODO
// once a real accrual scheduler exists.
export const leavePolicies = pgTable(
  "leave_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    appliesTo: text("applies_to").notNull().default("all"),
    annualAllotmentDays: numeric("annual_allotment_days", { precision: 5, scale: 2, mode: "number" }).notNull(),
    accrualMethod: text("accrual_method").notNull().default("annual_lump_sum"),
    carryForwardMaxDays: numeric("carry_forward_max_days", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    effectiveFrom: date("effective_from").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("leave_policies_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// One row per employee/leave_type/year — lazily created on that
// employee's first request against a type (see lib/api/leave.ts's
// getOrCreateBalance) rather than pre-provisioned for every employee on
// policy creation, so an employee who never takes that leave type never
// accumulates rows that need annual rollover maintenance.
export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    allottedDays: numeric("allotted_days", { precision: 5, scale: 2, mode: "number" }).notNull(),
    carriedForwardDays: numeric("carried_forward_days", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    usedDays: numeric("used_days", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    pendingDays: numeric("pending_days", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leave_balances_org_employee_type_year_unique").on(t.orgId, t.employeeId, t.leaveTypeId, t.year),
    pgPolicy("leave_balances_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    // Weekday-exclusive count (excludes the org's attendance_settings.weekend_days)
    // computed server-side at creation — never trusted from the client, same
    // discipline as attendance's ip/device capture.
    totalDays: numeric("total_days", { precision: 5, scale: 2, mode: "number" }).notNull(),
    isHalfDay: boolean("is_half_day").notNull().default(false),
    halfDayPeriod: text("half_day_period"),
    reason: text("reason"),
    status: leaveRequestStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    // No local FK target — same unreferenced-uuid convention as
    // attendance_records.edited_by (Neon has no real auth.users table).
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
  },
  (t) => [
    check("leave_requests_end_after_start", sql`${t.endDate} >= ${t.startDate}`),
    pgPolicy("leave_requests_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Payroll & Compensation (Prompt 5.3, extended in HR Batch 2 Part 3
// for payslip generation — CLAUDE.md §11a) ---
//
// Structured record-keeping only — NOT tax withholding, statutory
// compliance calculations, or bank disbursement (region-specific
// compliance logic is permanently out of scope; see the UI's visible
// scope note on the Compensation tab and /hr/payroll). Highly sensitive:
// gated by compensation:view_sensitive (HR admin, owner/admin only) OR
// the employee's own record — never a manager by default, per the
// prompt's explicit "not even their manager, unless explicitly granted."
// Zero self-service, unlike Attendance/Leave — this boundary is
// deliberate and permanent, not a "not yet built" gap (see CLAUDE.md).
export const compensationRecords = pgTable(
  "compensation_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    baseSalary: numeric("base_salary", { precision: 12, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    // HR Batch 2 — only 'monthly' has real payroll-generation math (see
    // lib/api/payroll.ts's prorate function); 'biweekly'/'weekly'/'annual'
    // are accepted and stored but generation treats anything non-monthly
    // as a flat-rate period — TODO once a real per-frequency payroll
    // calendar exists.
    payFrequency: text("pay_frequency").notNull().default("monthly"),
    effectiveDate: date("effective_date").notNull(),
    bonus: jsonb("bonus"),
    benefits: jsonb("benefits"),
    // HR Batch 1 additions — same table, no new "compensation_history"
    // table (extends existing rather than duplicating, same reasoning as
    // the employees table decision above).
    endDate: date("end_date"),
    reason: text("reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid("created_by_user_id"),
    // HR Batch 2 — non-statutory manual deductions only (e.g. loan
    // repayment) — never tax/PF/ESI, same jsonb-array shape as bonus/benefits.
    deductions: jsonb("deductions"),
  },
  () => [
    pgPolicy("compensation_records_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Record-keeping payslip snapshots, generated from the applicable
// compensation_records row for a given period — not real payroll
// processing (no tax/statutory withholding, no bank disbursement). One
// row per employee per exact period (unique constraint below) so
// re-running generation for the same period is a no-op per employee
// rather than a duplicate.
export const payslipStatusEnum = pgEnum("payslip_status", ["draft", "finalized", "paid"]);

export const payslipRecords = pgTable(
  "payslip_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    compensationRecordId: uuid("compensation_record_id").references(() => compensationRecords.id, { onDelete: "set null" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    grossAmount: numeric("gross_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    totalDeductions: numeric("total_deductions", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    // No tax calculation anywhere in this app — net_amount is purely
    // gross minus whatever manual deductions are configured on the
    // compensation record, never a tax/statutory computation.
    netAmount: numeric("net_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    status: payslipStatusEnum("status").notNull().default("draft"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    generatedBy: uuid("generated_by"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("payslip_records_org_employee_period_unique").on(t.orgId, t.employeeId, t.periodStart, t.periodEnd),
    pgPolicy("payslip_records_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Performance Reviews & OKRs, Recruitment, HR Cases, Training,
// Engagement (Prompt 5.4) — plain CRUD/workflows, no AI dependency here
// (AI-assisted job posting drafts / review summarization are separate
// follow-up prompts once the LLM provider decision is finalized). Same
// HR-admin-only data-entry model as Attendance/Leave/Compensation: no
// employee self-service login path for any of these five modules.

// HR Batch 3 — restructured for the hybrid self+manager review model
// (CLAUDE.md §11a: distinct from Attendance/Leave's full self-service and
// Compensation's zero-self-service — a third pattern). "draft"/"submitted"
// are pre-Batch-3 leftovers (0 real rows existed, but same
// can't-drop-enum-values reasoning as Attendance/Leave's dead labels).
export const performanceReviewStatusEnum = pgEnum("performance_review_status", [
  "draft",
  "submitted",
  "completed",
  "not_started",
  "self_assessment_pending",
  "manager_assessment_pending",
]);
export const reviewCycleStatusEnum = pgEnum("review_cycle_status", ["draft", "active", "closed"]);
export const finalRatingEnum = pgEnum("final_rating", ["exceeds", "meets", "needs_improvement", "unsatisfactory"]);
export const okrStatusEnum = pgEnum("okr_status", ["active", "completed", "archived"]);

export const jobPostingStatusEnum = pgEnum("job_posting_status", ["draft", "open", "on_hold", "closed", "filled"]);
export const candidateStageEnum = pgEnum("candidate_stage", [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]);
export const interviewTypeEnum = pgEnum("interview_type", ["video", "phone", "in_person"]);
export const interviewStatusEnum = pgEnum("interview_status", ["scheduled", "completed", "cancelled", "no_show"]);
export const interviewRecommendationEnum = pgEnum("interview_recommendation", ["strong_yes", "yes", "no", "strong_no"]);

// HR Batch 4 — restructured for genuine self-service: any employee can
// raise a case, add a comment, or enroll/respond; HR admin (hr_case:manage
// / training:manage / survey:manage) owns categories, courses, surveys,
// and resolution workflow. See CLAUDE.md §11a for the full three-module
// writeup, including why survey anonymity is enforced by never storing
// employee_id on an anonymous response row (not by a boolean flag).
export const hrCaseStatusEnum = pgEnum("hr_case_status", [
  "open",
  "in_progress",
  "waiting_on_employee",
  "resolved",
  "closed",
]);
export const hrCasePriorityEnum = pgEnum("hr_case_priority", ["low", "normal", "high", "urgent"]);

export const hrCaseCategories = pgTable(
  "hr_case_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    defaultAssigneeId: uuid("default_assignee_id").references(() => employees.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("hr_case_categories_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const hrCases = pgTable(
  "hr_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => hrCaseCategories.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    priority: hrCasePriorityEnum("priority").notNull().default("normal"),
    status: hrCaseStatusEnum("status").notNull().default("open"),
    assignedTo: uuid("assigned_to").references(() => employees.id, { onDelete: "set null" }),
    isConfidential: boolean("is_confidential").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  () => [
    pgPolicy("hr_cases_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const hrCaseComments = pgTable(
  "hr_case_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => hrCases.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    comment: text("comment").notNull(),
    isInternalNote: boolean("is_internal_note").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("hr_case_comments_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const trainingContentTypeEnum = pgEnum("training_content_type", ["link", "video", "document", "external"]);
export const trainingEnrollmentStatusEnum = pgEnum("training_enrollment_status", [
  "enrolled",
  "in_progress",
  "completed",
]);

export const trainingCourses = pgTable(
  "training_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    contentType: trainingContentTypeEnum("content_type").notNull().default("link"),
    contentUrl: text("content_url"),
    durationMinutes: integer("duration_minutes"),
    requiredForRoles: jsonb("required_for_roles").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("training_courses_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const trainingEnrollments = pgTable(
  "training_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    status: trainingEnrollmentStatusEnum("status").notNull().default("enrolled"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    progressPercent: integer("progress_percent").notNull().default(0),
  },
  (t) => [
    uniqueIndex("training_enrollments_course_employee_unique").on(t.courseId, t.employeeId),
    pgPolicy("training_enrollments_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const surveyQuestionTypeEnum = pgEnum("survey_question_type", ["rating_1_5", "text", "multiple_choice"]);
export const surveyStatusEnum = pgEnum("survey_status", ["draft", "active", "closed"]);

export const engagementSurveys = pgTable(
  "engagement_surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    questions: jsonb("questions").notNull().default([]),
    isAnonymous: boolean("is_anonymous").notNull().default(true),
    status: surveyStatusEnum("status").notNull().default("draft"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("engagement_surveys_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// employeeId is NULL for every response to an is_anonymous=true survey —
// not a boolean flag alongside a populated FK. There is no code path that
// can write both employeeId and an answer to the same row for an
// anonymous survey (see lib/api/surveys.ts submitResponse), so no query
// against this table can ever join an anonymous answer back to a person.
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => engagementSurveys.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    answers: jsonb("answers").notNull().default({}),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("survey_responses_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Tracks which employee has responded to which survey, WITHOUT joining to
// survey_responses.answers — this is what prevents a duplicate submission
// on an anonymous survey without ever letting a query recover "employee X
// said Y". Never select this table alongside surveyResponses.answers.
export const surveyRespondents = pgTable(
  "survey_respondents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => engagementSurveys.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    respondedAt: timestamp("responded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("survey_respondents_survey_employee_unique").on(t.surveyId, t.employeeId),
    pgPolicy("survey_respondents_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Org-level review period definition — a cycle groups every employee's
// review for that quarter/year/probation window. No performance_reviews
// row exists without a cycle_id (unlike the pre-Batch-3 flat "period"
// text field, which had no structured lifecycle at all).
export const reviewCycles = pgTable(
  "review_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cycleType: text("cycle_type").notNull().default("quarterly"),
    selfAssessmentOpenDate: date("self_assessment_open_date"),
    selfAssessmentDueDate: date("self_assessment_due_date"),
    managerAssessmentDueDate: date("manager_assessment_due_date"),
    status: reviewCycleStatusEnum("status").notNull().default("draft"),
    appliesTo: text("applies_to").notNull().default("all"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("review_cycles_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Hybrid self+manager model: self_assessment is written by the employee
// (review:submit_self + ownership check), manager_assessment + final_rating
// by their manager (review:submit_manager + isManagerOf check) — two
// distinct jsonb blobs rather than one shared "ratings" field specifically
// so RLS/application-layer checks can gate them independently (an employee
// can never write manager_assessment even by accident, since the two
// self-assessment/manager-assessment PATCH routes are entirely separate
// endpoints with separate permission checks — see app/api/reviews/[id]/*).
export const performanceReviews = pgTable(
  "performance_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => reviewCycles.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").references(() => employees.id, { onDelete: "set null" }),
    selfAssessment: jsonb("self_assessment").notNull().default({}),
    managerAssessment: jsonb("manager_assessment").notNull().default({}),
    finalRating: finalRatingEnum("final_rating"),
    // Pre-Batch-3 leftover fields — "period" is superseded by cycle_id
    // (the cycle carries the period name), "ratings"/"comments" by the
    // self/manager assessment split above. Left in place rather than
    // dropped: harmless unused columns, same reasoning as the dead enum
    // labels above, and a drop-column migration buys nothing since there's
    // no data in them to lose either way.
    period: text("period"),
    ratings: jsonb("ratings").default({}),
    comments: text("comments"),
    status: performanceReviewStatusEnum("status").notNull().default("not_started"),
    selfSubmittedAt: timestamp("self_submitted_at", { withTimezone: true }),
    managerSubmittedAt: timestamp("manager_submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("performance_reviews_cycle_employee_unique").on(t.cycleId, t.employeeId),
    pgPolicy("performance_reviews_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// employeeId and teamName are both nullable — an OKR belongs to one or the
// other (an individual's or a team's objective). teamName is freetext
// (not a teamId FK) per the Batch 3 spec — team_id stays as a pre-Batch-3
// leftover column, unused by new code, same "harmless unused column"
// reasoning as performance_reviews' period/ratings/comments above.
export const okrs = pgTable(
  "okrs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    teamName: text("team_name"),
    cycleId: uuid("cycle_id").references(() => reviewCycles.id, { onDelete: "set null" }),
    objective: text("objective").notNull(),
    keyResults: jsonb("key_results").notNull().default([]),
    period: text("period").notNull(),
    status: okrStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("okrs_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const jobPostings = pgTable(
  "job_postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    employmentType: text("employment_type").notNull().default("full_time"),
    location: text("location"),
    status: jobPostingStatusEnum("status").notNull().default("draft"),
    description: text("description"),
    requirements: text("requirements"),
    salaryRangeMin: numeric("salary_range_min", { precision: 12, scale: 2, mode: "number" }),
    salaryRangeMax: numeric("salary_range_max", { precision: 12, scale: 2, mode: "number" }),
    currency: text("currency").notNull().default("INR"),
    hiringManagerId: uuid("hiring_manager_id").references(() => employees.id, { onDelete: "set null" }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("job_postings_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    // DB column stays "name" (pre-Batch-3, zero rows to migrate) — mapped
    // to fullName at the Drizzle field level so the API/UI surface matches
    // the Batch 3 spec without a pointless rename-column migration.
    fullName: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    resumeUrl: text("resume_url"),
    source: text("source"),
    stage: candidateStageEnum("stage").notNull().default("applied"),
    rating: integer("rating"),
    notes: text("notes"),
    rejectedReason: text("rejected_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("candidates_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// No candidate-facing portal in this phase (internal staff data entry
// only, per the Batch 3 spec) — interviewer_id is the assignment
// submit_feedback checks against (only the assigned interviewer can write
// feedback/recommendation for their own interview).
export const interviewSchedules = pgTable(
  "interview_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    interviewerId: uuid("interviewer_id").references(() => employees.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    interviewType: interviewTypeEnum("interview_type").notNull().default("video"),
    status: interviewStatusEnum("status").notNull().default("scheduled"),
    feedback: text("feedback"),
    recommendation: interviewRecommendationEnum("recommendation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("interview_schedules_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("holidays_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Task comments — first collaboration surface. authorUserId is bare uuid
// (same pattern as tasks.assigneeId / goals.ownerId — no local auth.users to
// reference). RLS scoped by inUserOrgs so members of the same org see the
// same thread; permissions gate mutations (task_comment:create/update/delete).
export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("task_comments_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Per-user account preferences (theme, density, date/time format, notification
// prefs). Keyed by (userId, orgId) since a user in multiple orgs may have
// different preferences per workspace, same pattern as org_memberships.
// Auth is Supabase-owned (no local users FK to point at), so userId is a
// bare uuid — same pattern as tasks.assigneeId / goals.ownerId. RLS scopes
// by the caller's own userId via auth.uid(), so a user can never see another
// user's preferences even inside the same org.
export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id").notNull(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    jobTitle: text("job_title"),
    department: text("department"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    timezone: text("timezone").default("UTC"),
    language: text("language").default("en"),
    theme: text("theme").notNull().default("system"),
    density: text("density").notNull().default("comfortable"),
    defaultLandingPage: text("default_landing_page").notNull().default("dashboard"),
    timeFormat: text("time_format").notNull().default("24h"),
    dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
    weekStartsOn: text("week_starts_on").notNull().default("monday"),
    notifyEmail: jsonb("notify_email").notNull().default({}),
    notifyInapp: jsonb("notify_inapp").notNull().default({}),
    notifyDigest: text("notify_digest").notNull().default("realtime"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.orgId] }),
    pgPolicy("user_preferences_owner", {
      for: "all",
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
  ],
).enableRLS();

// Project ↔ people link — persists the wizard's Step 3 members plus who
// leads the project. Composite PK (projectId, personId) means a person
// appears at most once on a project. hoursPerWeek/access are per-project
// overrides of the person's defaults from the `people` row.
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role"),
    hoursPerWeek: integer("hours_per_week"),
    access: text("access").notNull().default("Editor"),
    isLead: boolean("is_lead").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.personId] }),
    pgPolicy("project_members_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// People directory — deliberately named "people" (not "team_members" or
// "employees") because it's the shared source of truth that HR (Phase 5.1)
// will extend later rather than duplicating. Kept minimal: HR-specific
// fields (DOB, salary, employment type, manager, attendance links) belong on
// a future `employees` extension, not here. isActive is a soft-delete flag —
// people rows may be referenced by projects, so we don't hard-delete.
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    workEmail: text("work_email").notNull(),
    jobTitle: text("job_title"),
    avatarUrl: text("avatar_url"),
    // Free-text for now; becomes an FK to a `departments` table when HR
    // Phase 5.1 builds it.
    department: text("department"),
    availableHoursPerWeek: integer("available_hours_per_week").notNull().default(40),
    roles: jsonb("roles").notNull().default([]),
    skills: jsonb("skills").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid("created_by_user_id"),
  },
  (t) => [
    uniqueIndex("people_org_email_unique").on(t.orgId, t.workEmail),
    pgPolicy("people_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Phase 6 (CRM, CLAUDE.md §11a) — Leads, Contacts & Accounts, modeled on
// Zoho CRM's standard modules. ownerId is a bare uuid with no FK, same as
// goals.ownerId/tasks.assigneeId — Neon has no local `auth.users` table to
// reference. accounts is defined first since contacts/leads reference it.
// CRM Batch 1 — extended in place with the full Zoho-style field set.
// ownerId stays a bare uuid (no FK) — same as goals.ownerId/tasks.assigneeId,
// Neon has no local auth.users table to reference. parentAccountId is
// self-referencing with no FK enforcement, same TODO-later precedent as
// employees.managerId.
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    industry: text("industry"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    country: text("country").default("India"),
    postalCode: text("postal_code"),
    type: accountTypeEnum("type").notNull().default("prospect"),
    status: accountStatusEnum("status").notNull().default("active"),
    annualRevenue: numeric("annual_revenue", { precision: 15, scale: 2, mode: "number" }),
    currency: text("currency").notNull().default("INR"),
    employeeCountRange: text("employee_count_range"),
    ownerId: uuid("owner_id"),
    parentAccountId: uuid("parent_account_id"),
    tags: jsonb("tags").notNull().default([]),
    customFields: jsonb("custom_fields").notNull().default({}),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("accounts_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// fullName/jobTitle rename the DB columns (name/title) at the ORM level
// only, same "field name vs DB column name divergence" pattern as
// candidates.fullName (HR Batch 3) — 0 rows existed, no migration needed
// to actually rename the column.
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    fullName: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    jobTitle: text("title"),
    department: text("department"),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    mailingAddress: text("mailing_address"),
    city: text("city"),
    state: text("state"),
    country: text("country").default("India"),
    ownerId: uuid("owner_id"),
    source: text("source"),
    convertedFromLeadId: uuid("converted_from_lead_id"),
    tags: jsonb("tags").notNull().default([]),
    customFields: jsonb("custom_fields").notNull().default({}),
    notes: text("notes"),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("contacts_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// convertedAccountId/convertedContactId are set by the explicit "convert"
// action (lib/api/crm.ts) — never automatic — and exist purely
// for traceability (so a converted lead still shows what it became).
// fullName/companyName rename name/company at the ORM level only, same
// pattern as contacts.fullName above.
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fullName: text("name").notNull(),
    companyName: text("company"),
    email: text("email"),
    phone: text("phone"),
    jobTitle: text("job_title"),
    source: text("source").default("manual"),
    sourceDetail: text("source_detail"),
    status: leadStatusEnum("status").notNull().default("new"),
    score: integer("score"),
    scoreReasoning: text("score_reasoning"),
    ownerId: uuid("owner_id"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedAccountId: uuid("converted_account_id").references(() => accounts.id, { onDelete: "set null" }),
    convertedContactId: uuid("converted_contact_id").references(() => contacts.id, { onDelete: "set null" }),
    lostReason: text("lost_reason"),
    tags: jsonb("tags").notNull().default([]),
    customFields: jsonb("custom_fields").notNull().default({}),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    // Prompt 6.3 — which campaign this lead came from, for ROI visibility.
    // A single FK (not the prompt's jsonb/join-table options) since a lead
    // has exactly one originating campaign in practice — same shape as
    // contacts.accountId.
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  },
  () => [
    pgPolicy("leads_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// CRM Batch 2 — extended in place with the full pipeline field set.
// accountId/contactId (renamed primaryContactId at the field level, DB
// column stays "contact_id") are now nullable — a deal can exist before
// an account is locked in, same "not every deal needs everything up
// front" reasoning as leads. stageChangedAt/probability drive the
// Kanban's stale-badge and forecast math; both are only ever written by
// the transactional stage-change path in lib/api/crm.ts, never a plain
// field edit, so they stay trustworthy for velocity reporting.
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    primaryContactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id"),
    stage: dealStageEnum("stage").notNull().default("prospecting"),
    probability: integer("probability").default(10),
    value: numeric("value", { precision: 15, scale: 2, mode: "number" }),
    currency: text("currency").notNull().default("INR"),
    recurringRevenue: numeric("recurring_revenue", { precision: 15, scale: 2, mode: "number" }),
    recurringFrequency: text("recurring_frequency"),
    expectedCloseDate: date("expected_close_date"),
    actualCloseDate: date("actual_close_date"),
    source: text("source"),
    convertedFromLeadId: uuid("converted_from_lead_id"),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    lostReason: text("lost_reason"),
    wonNotes: text("won_notes"),
    nextStep: text("next_step"),
    nextStepDueDate: date("next_step_due_date"),
    tags: jsonb("tags").notNull().default([]),
    customFields: jsonb("custom_fields").notNull().default({}),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("deals_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const dealStageHistory = pgTable(
  "deal_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    fromStage: dealStageEnum("from_stage"),
    toStage: dealStageEnum("to_stage").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    changedBy: uuid("changed_by"),
    durationInPreviousStageMinutes: integer("duration_in_previous_stage_minutes"),
  },
  () => [
    pgPolicy("deal_stage_history_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// relatedId is a bare uuid with no FK — it polymorphically points at
// whichever table relatedType names (lead/contact/account/deal), and
// Postgres FKs can't target more than one table. Isolation still holds
// because every write goes through withOrgContext/requirePermission with
// org_id supplied explicitly, same as every other org-scoped table.
// CRM Batch 1 — extended in place with subject/description/outcome/
// duration/performedBy so this doubles as the spec's "crm_activities"
// timeline; dueDate/completed are pre-Batch-1 leftovers (0 rows existed,
// kept nullable rather than dropped, same dead-column tolerance as
// performance_reviews' legacy fields from HR Batch 3).
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    relatedType: activityRelatedTypeEnum("related_type").notNull(),
    relatedId: uuid("related_id").notNull(),
    type: activityTypeEnum("type").notNull(),
    subject: text("subject"),
    description: text("description"),
    outcome: text("outcome"),
    activityDate: timestamp("activity_date", { withTimezone: true }).defaultNow(),
    durationMinutes: integer("duration_minutes"),
    performedBy: uuid("performed_by"),
    notes: text("notes"),
    dueDate: date("due_date"),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("activities_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// CRM Batch 3 — extended in place with the full campaign field set.
// "type"/"channel" stay free text (same treatment as leads.source) —
// open-ended, not a fixed workflow. Metrics (leads/deals/revenue/ROI) are
// never stored here — always computed live from leads.campaignId /
// deals.campaignId at read time (lib/api/crm.ts's campaignMetrics), same
// "no stale snapshot" reasoning forecasts already had.
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").default("other"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    description: text("description"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    budgetAllocated: numeric("budget_allocated", { precision: 12, scale: 2, mode: "number" }),
    budgetSpent: numeric("budget_spent", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    targetAudience: text("target_audience"),
    channel: text("channel"),
    ownerId: uuid("owner_id"),
    tags: jsonb("tags").notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  () => [
    pgPolicy("campaigns_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// CRM Batch 3 — replaces the old flat `forecasts` table (period + bare
// target_value, no period_type/range/owner) with forecast_targets. Still
// deliberately stores ONLY the target — the forecast itself (pipeline/
// weighted/won/gap) is always computed live from `deals` at read time
// (lib/api/crm.ts's computeForecast), never snapshotted, so it can never
// go stale. unique(org_id, period, owner_id): a non-null owner_id gives
// each rep at most one target per period. NOTE: Postgres treats every
// NULL as distinct for uniqueness purposes, so this does NOT actually
// stop two org-wide (owner_id IS NULL) targets for the same period from
// coexisting — enforcing "at most one org-wide target per period" would
// need a partial unique index (`WHERE owner_id IS NULL`). Not added yet;
// the API layer (lib/api/crm.ts) is responsible for not creating a
// duplicate org-wide target until that's added.
export const forecastTargets = pgTable(
  "forecast_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    periodType: forecastPeriodTypeEnum("period_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    targetValue: numeric("target_value", { precision: 15, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    ownerId: uuid("owner_id"),
    department: text("department"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    uniqueIndex("forecast_targets_org_period_owner_unique").on(t.orgId, t.period, t.ownerId),
    pgPolicy("forecast_targets_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Phase 7 (Communication pillar, CLAUDE.md §11a) — connector framework.
// One row per org+provider. config holds provider-specific OAuth tokens
// and metadata (e.g. Slack's access_token/team_id/team_name/bot_user_id)
// — never returned to the client as-is; GET /api/integrations strips
// secrets before responding (lib/api/integrations.ts). connectedByUserId
// is a bare uuid, no FK, same as every other "who did this" field in this
// app (leads.ownerId, tasks.assigneeId, ...).
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    config: jsonb("config").notNull().default({}),
    connectedByUserId: uuid("connected_by_user_id"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    status: integrationStatusEnum("status").notNull().default("disconnected"),
  },
  () => [
    pgPolicy("integrations_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Project detail Tasks tab redesign — Files view. Metadata only; the actual
// bytes live in Supabase Storage (private bucket, service-role access only
// — see lib/api/storage.ts). No new resourceType/permission: attachment
// create/delete rides on the existing task:update grant, list on
// task:read, same "rides along" pattern as attendance/leave reads on
// employee reads.
export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type"),
    uploadedByUserId: uuid("uploaded_by_user_id"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("task_attachments_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();
