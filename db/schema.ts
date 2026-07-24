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

export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "unqualified", "converted"]);
export const dealStageEnum = pgEnum("deal_stage", ["prospecting", "proposal", "negotiation", "won", "lost"]);
export const activityRelatedTypeEnum = pgEnum("activity_related_type", ["lead", "contact", "account", "deal"]);
export const activityTypeEnum = pgEnum("activity_type", ["call", "meeting", "task", "note"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["planned", "active", "completed", "cancelled"]);
export const integrationProviderEnum = pgEnum("integration_provider", ["slack", "gmail", "zoom"]);
export const integrationStatusEnum = pgEnum("integration_status", ["connected", "disconnected", "error"]);

export const employmentStatusEnum = pgEnum("employment_status", ["active", "onboarding", "terminated"]);
export const onboardingStatusEnum = pgEnum("onboarding_status", ["not_started", "in_progress", "complete"]);

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
  },
  () => [
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
    steps: jsonb("steps").notNull().default([]),
    status: onboardingStatusEnum("status").notNull().default("not_started"),
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


// --- HR: Attendance, Time Tracking & Leave Management (Prompt 5.2) ---

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "half_day", "remote"]);
export const leaveRequestStatusEnum = pgEnum("leave_request_status", ["pending", "approved", "rejected"]);

// One row per employee per day, created by self-check-in (lib/api/attendance.ts
// enforces the caller can only ever write their own employees.userId row —
// there's no admin "record attendance for someone else" path, same
// self-scoping as leave_requests below).
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
    date: date("date").notNull(),
    checkIn: timestamp("check_in", { withTimezone: true }),
    checkOut: timestamp("check_out", { withTimezone: true }),
    status: attendanceStatusEnum("status").notNull().default("present"),
  },
  () => [
    pgPolicy("attendance_records_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// Org-level policy definitions (e.g. "PTO", 15 days/year). accrualRule is
// jsonb rather than a fixed set of columns — accrual schemes (annual grant,
// monthly accrual, tenure-based) vary enough that a rigid schema would
// need a migration per new scheme; today's balance math (lib/api/leave.ts)
// only reads daysPerYear and treats accrualRule as opaque/display-only
// until a real accrual engine is needed.
export const leavePolicies = pgTable(
  "leave_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    daysPerYear: integer("days_per_year").notNull(),
    accrualRule: jsonb("accrual_rule").notNull().default({}),
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
    policyId: uuid("policy_id")
      .notNull()
      .references(() => leavePolicies.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: leaveRequestStatusEnum("status").notNull().default("pending"),
    approvedBy: uuid("approved_by"),
  },
  () => [
    pgPolicy("leave_requests_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();


// --- HR: Payroll & Compensation (Prompt 5.3) ---
//
// Structured record-keeping only — NOT tax withholding, statutory
// compliance calculations, or bank disbursement (region-specific
// compliance logic is out of scope; see the UI's visible scope note in
// app/(app)/hr/compensation). Highly sensitive: gated by
// compensation:view_sensitive (HR admin, owner/admin only) OR the
// employee's own record — never a manager by default, per the prompt's
// explicit "not even their manager, unless explicitly granted."
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
    effectiveDate: date("effective_date").notNull(),
    bonus: jsonb("bonus"),
    benefits: jsonb("benefits"),
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


// --- HR: Performance Reviews & OKRs, Recruitment, HR Cases, Training,
// Engagement (Prompt 5.4) — plain CRUD/workflows, no AI dependency here
// (AI-assisted job posting drafts / review summarization are separate
// follow-up prompts once the LLM provider decision is finalized). Same
// HR-admin-only data-entry model as Attendance/Leave/Compensation: no
// employee self-service login path for any of these five modules.

export const performanceReviewStatusEnum = pgEnum("performance_review_status", [
  "draft",
  "submitted",
  "completed",
]);
export const jobPostingStatusEnum = pgEnum("job_posting_status", ["draft", "open", "closed"]);
export const candidateStageEnum = pgEnum("candidate_stage", [
  "applied",
  "interview",
  "offer",
  "hired",
  "rejected",
]);
export const hrCaseStatusEnum = pgEnum("hr_case_status", ["open", "in_progress", "resolved", "closed"]);

export const performanceReviews = pgTable(
  "performance_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").references(() => employees.id, { onDelete: "set null" }),
    period: text("period").notNull(),
    ratings: jsonb("ratings").notNull().default({}),
    comments: text("comments"),
    status: performanceReviewStatusEnum("status").notNull().default("draft"),
  },
  () => [
    pgPolicy("performance_reviews_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

// employeeId and teamId are both nullable — an OKR belongs to one or the
// other (an individual's or a team's objective), never enforced at the DB
// level since this app has no CHECK-constraint precedent elsewhere either.
export const okrs = pgTable(
  "okrs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    objective: text("objective").notNull(),
    keyResults: jsonb("key_results").notNull().default([]),
    period: text("period").notNull(),
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
    status: jobPostingStatusEnum("status").notNull().default("draft"),
    description: text("description"),
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
    name: text("name").notNull(),
    email: text("email"),
    stage: candidateStageEnum("stage").notNull().default("applied"),
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
    category: text("category").notNull(),
    description: text("description"),
    status: hrCaseStatusEnum("status").notNull().default("open"),
    assignedTo: uuid("assigned_to").references(() => employees.id, { onDelete: "set null" }),
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

export const trainingCourses = pgTable(
  "training_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").notNull().default({}),
    requiredForRole: text("required_for_role"),
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

export const trainingCompletions = pgTable(
  "training_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("training_completions_isolation", {
      for: "all",
      to: authenticatedRole,
      using: inUserOrgs,
      withCheck: inUserOrgs,
    }),
  ],
).enableRLS();

export const engagementSurveys = pgTable(
  "engagement_surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    questions: jsonb("questions").notNull().default([]),
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

// employeeId nullable — an anonymous response records no employee at all
// rather than a real id with `anonymous: true` stapled on, so an
// accidental read path can't de-anonymize it by joining on employeeId.
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
    anonymous: boolean("anonymous").notNull().default(false),
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
    ownerId: uuid("owner_id"),
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

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    title: text("title"),
    ownerId: uuid("owner_id"),
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
// action (lib/api/leadConversion.ts) — never automatic — and exist purely
// for traceability (so a converted lead still shows what it became).
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    source: text("source"),
    status: leadStatusEnum("status").notNull().default("new"),
    ownerId: uuid("owner_id"),
    convertedAccountId: uuid("converted_account_id").references(() => accounts.id, { onDelete: "set null" }),
    convertedContactId: uuid("converted_contact_id").references(() => contacts.id, { onDelete: "set null" }),
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

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    value: numeric("value", { precision: 12, scale: 2, mode: "number" }),
    currency: text("currency").notNull().default("USD"),
    stage: dealStageEnum("stage").notNull().default("prospecting"),
    ownerId: uuid("owner_id"),
    expectedCloseDate: date("expected_close_date"),
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

// relatedId is a bare uuid with no FK — it polymorphically points at
// whichever table relatedType names (lead/contact/account/deal), and
// Postgres FKs can't target more than one table. Isolation still holds
// because every write goes through withOrgContext/requirePermission with
// org_id supplied explicitly, same as every other org-scoped table.
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

// Prompt 6.3 — campaigns. "type" is free text (email/event/ad/webinar/...)
// same treatment as leads.source, not an enum — open-ended, not a fixed
// workflow. Attribution is leads.campaignId (see above), not a jsonb
// array or join table.
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type"),
    status: campaignStatusEnum("status").notNull().default("planned"),
    startDate: date("start_date"),
    endDate: date("end_date"),
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

// Prompt 6.3 — forecasts. Deliberately stores only the target (quota) per
// period; the "computed rollup" (actual pipeline value by stage) is never
// stored here — it's queried live from `deals` grouped by
// expected_close_date/stage at read time, per the prompt's explicit "no AI
// needed... not a prediction" framing. period is free text (e.g. "2026-Q3"
// or "2026-07") rather than a date, since a forecast period is a bucket
// label, not a single point in time.
export const forecasts = pgTable(
  "forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    targetValue: numeric("target_value", { precision: 12, scale: 2, mode: "number" }),
  },
  () => [
    pgPolicy("forecasts_isolation", {
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
