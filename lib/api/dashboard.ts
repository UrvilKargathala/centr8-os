// Global cross-pillar dashboard (/dashboard) — extracted out of the route
// handler so it's directly testable, same "route is a thin HTTP wrapper
// around a lib function" pattern as lib/api/crm.ts / lib/api/aiAssistant.ts.
import { and, desc, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import {
  accounts,
  attendanceRecords,
  auditLog,
  activities as crmActivities,
  deals,
  employees,
  generatedDocuments,
  hrCases,
  leads,
  leaveRequests,
  people,
  projects,
  sprintPlanProposals,
  sprints,
  tasks,
} from "@/db/schema";
import { hasPermission } from "./permissions";
import { callsMissedToday, gmailUnread, nextMeeting, slackTotalUnread } from "@/lib/mock/communication";

const OPEN_DEAL_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// Real period-over-period % change, or null when the prior period has
// nothing to compare against (a fabricated "+0%"/"+100%" would be worse
// than no pill at all).
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function completedTrendPercent(taskRows: (typeof import("@/db/schema").tasks.$inferSelect)[]) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const doneThisWeek = taskRows.filter((t) => t.status === "done" && now - new Date(t.updatedAt).getTime() < weekMs).length;
  const doneLastWeek = taskRows.filter((t) => {
    if (t.status !== "done") return false;
    const age = now - new Date(t.updatedAt).getTime();
    return age >= weekMs && age < weekMs * 2;
  }).length;
  return pctChange(doneThisWeek, doneLastWeek);
}

// Every section here is gated on the same resourceType:action the section's
// own pillar page already requires to view its data — a dashboard summary
// must never expose more than the destination page would. A denied section
// resolves to `null`, not a zeroed-out block or a 403 on the whole
// endpoint, so the UI can render "no access" per-block.
export async function loadProjectsSection(db: OrgScopedDb, userId: string, orgId: string) {
  if (!(await hasPermission(db, userId, orgId, "project", "read"))) return null;
  const canReadTasks = await hasPermission(db, userId, orgId, "task", "read");
  const [projectRows, taskRows, sprintRows, peopleRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.orgId, orgId)),
    canReadTasks ? db.select().from(tasks).where(eq(tasks.orgId, orgId)) : Promise.resolve([]),
    (await hasPermission(db, userId, orgId, "sprint", "read")) ? db.select().from(sprints).where(eq(sprints.orgId, orgId)) : Promise.resolve([]),
    canReadTasks ? db.select().from(people).where(eq(people.orgId, orgId)) : Promise.resolve([]),
  ]);

  const now = new Date();
  const overdueTasks = taskRows.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done" && t.status !== "cancelled");
  const blockedByProject = new Map<string, number>();
  for (const t of taskRows) if (t.status === "in_review") blockedByProject.set(t.projectId, (blockedByProject.get(t.projectId) ?? 0) + 1);
  const atRiskProjects = projectRows.filter((p) => p.status === "active" && (blockedByProject.get(p.id) ?? 0) >= 2);

  const activeSprints = sprintRows.filter((s) => s.status === "active");
  const sprintProgress = activeSprints.map((s) => {
    const sprintTasks = taskRows.filter((t) => t.sprintId === s.id);
    if (sprintTasks.length === 0) return 0;
    return (sprintTasks.filter((t) => t.status === "done").length / sprintTasks.length) * 100;
  });
  const avgProgress = sprintProgress.length ? sprintProgress.reduce((s, n) => s + n, 0) / sprintProgress.length : 0;

  const projectsWithProgress = projectRows
    .filter((p) => p.status === "active")
    .slice(0, 5)
    .map((p) => {
      const pt = taskRows.filter((t) => t.projectId === p.id);
      const done = pt.filter((t) => t.status === "done").length;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        at_risk: (blockedByProject.get(p.id) ?? 0) >= 2,
        task_progress: { done, total: pt.length },
        remaining: pt.length - done,
        end_date: p.endDate,
      };
    });

  // Top 5 open tasks, soonest due date first (nulls last) — real rows, not
  // just counts, for a "recent tasks" table. assigneeId/projectId are bare
  // uuids (no FK, same as every other "who/what" reference in this schema)
  // resolved here since the UI has no other way to get a name for them.
  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));
  const personNameById = new Map(peopleRows.map((person) => [person.id, person.fullName]));
  const recentTasksList = taskRows
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return +new Date(a.dueDate) - +new Date(b.dueDate);
    })
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      project_name: projectNameById.get(t.projectId) ?? "Unknown project",
      assignee_name: t.assigneeId ? (personNameById.get(t.assigneeId) ?? "Unknown") : null,
      due_date: t.dueDate,
      status: t.status,
    }));

  return {
    projects: {
      total: projectRows.length,
      active: projectRows.filter((p) => p.status === "active").length,
      at_risk: atRiskProjects.length,
      completed: projectRows.filter((p) => p.status === "completed").length,
    },
    tasks: {
      total: taskRows.length,
      pending: taskRows.filter((t) => t.status === "todo" || t.status === "backlog").length,
      in_progress: taskRows.filter((t) => t.status === "in_progress").length,
      in_review: taskRows.filter((t) => t.status === "in_review").length,
      completed: taskRows.filter((t) => t.status === "done").length,
      overdue: overdueTasks.length,
      // Real week-over-week comparison (this week's completions vs the
      // week before), not a fabricated number — null when there's nothing
      // in the prior window to compare against, per the dashboard's
      // no-fabricated-numbers rule (CLAUDE.md HR dashboard precedent).
      completed_trend_percent: completedTrendPercent(taskRows),
    },
    sprints: { active_count: activeSprints.length, avg_progress_percent: Math.round(avgProgress) },
    active_projects_list: projectsWithProgress,
    recent_tasks_list: recentTasksList,
  };
}

export async function loadHrSection(db: OrgScopedDb, userId: string, orgId: string) {
  if (!(await hasPermission(db, userId, orgId, "employee", "read"))) return null;
  const canViewAllAttendance = await hasPermission(db, userId, orgId, "attendance", "view_all");
  const canViewAllLeave = await hasPermission(db, userId, orgId, "leave", "view_all");
  // hr_case has no "read" action (CLAUDE.md HR Batch 4: create_own/view_own
  // for the raiser, "manage" for admin oversight) — the dashboard's
  // org-wide open-case count is oversight, so it's gated on "manage".
  const canViewHrCases = await hasPermission(db, userId, orgId, "hr_case", "manage");

  const today = todayISO();
  const [employeeRows, attendanceToday, leaveRows, hrCaseRows] = await Promise.all([
    db.select().from(employees).where(eq(employees.orgId, orgId)),
    canViewAllAttendance
      ? db.select().from(attendanceRecords).where(and(eq(attendanceRecords.orgId, orgId), eq(attendanceRecords.workDate, today)))
      : Promise.resolve(null),
    canViewAllLeave ? db.select().from(leaveRequests).where(eq(leaveRequests.orgId, orgId)) : Promise.resolve(null),
    canViewHrCases ? db.select().from(hrCases).where(eq(hrCases.orgId, orgId)) : Promise.resolve(null),
  ]);

  const activeEmployees = employeeRows.filter((e) => e.employmentStatus === "active");
  const checkedInToday = attendanceToday?.filter((a) => a.checkInTime).length ?? null;
  const attendanceRate = attendanceToday && activeEmployees.length > 0 ? Math.round(((checkedInToday ?? 0) / activeEmployees.length) * 100) : null;

  const pendingLeave = leaveRows?.filter((l) => l.status === "pending").length ?? null;
  const onLeaveToday = leaveRows?.filter((l) => l.status === "approved" && l.startDate <= today && l.endDate >= today).length ?? null;
  const approvedToday = leaveRows?.filter((l) => l.status === "approved" && l.reviewedAt && new Date(l.reviewedAt).toISOString().slice(0, 10) === today).length ?? null;

  const openCases = hrCaseRows?.filter((c) => c.status === "open" || c.status === "in_progress" || c.status === "waiting_on_employee").length ?? null;

  return {
    employees: {
      total: employeeRows.length,
      active: activeEmployees.length,
      onboarding: employeeRows.filter((e) => e.employmentStatus === "onboarding").length,
      on_leave: employeeRows.filter((e) => e.employmentStatus === "on_leave").length,
      notice_period: employeeRows.filter((e) => e.employmentStatus === "notice_period").length,
    },
    attendance: {
      checked_in_today: checkedInToday,
      checked_out_today: attendanceToday?.filter((a) => a.checkOutTime).length ?? null,
      absent_today: attendanceToday ? Math.max(activeEmployees.length - attendanceToday.length, 0) : null,
      late_today: attendanceToday?.filter((a) => a.status === "half_day").length ?? null,
      attendance_rate_percent: attendanceRate,
    },
    leave: { pending_requests: pendingLeave, approved_today: approvedToday, on_leave_today: onLeaveToday },
    open_hr_cases: openCases,
  };
}

export async function loadCrmSection(db: OrgScopedDb, userId: string, orgId: string) {
  if (!(await hasPermission(db, userId, orgId, "lead", "read"))) return null;
  const canViewDeals = await hasPermission(db, userId, orgId, "deal", "read");
  const canViewAccounts = await hasPermission(db, userId, orgId, "account", "read");

  const monthStart = startOfMonthISO();
  const [leadRows, dealRows, accountRows] = await Promise.all([
    db.select().from(leads).where(eq(leads.orgId, orgId)),
    canViewDeals ? db.select().from(deals).where(eq(deals.orgId, orgId)) : Promise.resolve(null),
    canViewAccounts ? db.select().from(accounts).where(eq(accounts.orgId, orgId)) : Promise.resolve(null),
  ]);

  const newThisMonth = leadRows.filter((l) => new Date(l.createdAt).toISOString().slice(0, 10) >= monthStart).length;
  const converted = leadRows.filter((l) => l.status === "converted").length;
  const conversionRate = leadRows.length > 0 ? Math.round((converted / leadRows.length) * 100) : 0;

  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let openPipelineValue = 0;
  let weightedPipelineValue = 0;
  let closingThisMonth = 0;
  let winRate = 0;
  let byStage: Record<string, number> = {};
  let valueTrendPercent: number | null = null;
  if (dealRows) {
    const openDeals = dealRows.filter((d) => (OPEN_DEAL_STAGES as readonly string[]).includes(d.stage));
    openPipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
    weightedPipelineValue = openDeals.reduce((s, d) => s + (Number(d.value ?? 0) * (d.probability ?? 0)) / 100, 0);
    closingThisMonth = openDeals.filter((d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= monthEnd).length;
    const won = dealRows.filter((d) => d.stage === "won").length;
    const lost = dealRows.filter((d) => d.stage === "lost").length;
    winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    byStage = Object.fromEntries(OPEN_DEAL_STAGES.map((s) => [s, openDeals.filter((d) => d.stage === s).length]));

    // Real month-over-month comparison — value of deals created this
    // calendar month vs the one before, not a fabricated number.
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const valueThisMonth = dealRows.filter((d) => new Date(d.createdAt) >= new Date(monthStart)).reduce((s, d) => s + Number(d.value ?? 0), 0);
    const valueLastMonth = dealRows
      .filter((d) => new Date(d.createdAt) >= lastMonthStart && new Date(d.createdAt) <= lastMonthEnd)
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    valueTrendPercent = pctChange(valueThisMonth, valueLastMonth);
  }

  return {
    leads: { total: leadRows.length, new_this_month: newThisMonth, qualified: leadRows.filter((l) => l.status === "qualified").length, conversion_rate_percent: conversionRate },
    deals: dealRows
      ? {
          open_pipeline_value: Math.round(openPipelineValue),
          weighted_pipeline_value: Math.round(weightedPipelineValue),
          deals_to_close_this_month: closingThisMonth,
          win_rate_percent: winRate,
          value_trend_percent: valueTrendPercent,
          by_stage: byStage,
        }
      : null,
    accounts: accountRows
      ? { total: accountRows.length, customers: accountRows.filter((a) => a.type === "customer").length, prospects: accountRows.filter((a) => a.type === "prospect").length }
      : null,
  };
}

export async function loadAiSection(db: OrgScopedDb, userId: string, orgId: string) {
  const canSprintPlans = await hasPermission(db, userId, orgId, "sprint_plan", "read");
  const canDocuments = await hasPermission(db, userId, orgId, "document", "read");
  const [pendingPlans, draftDocs] = await Promise.all([
    canSprintPlans
      ? db.select().from(sprintPlanProposals).where(and(eq(sprintPlanProposals.orgId, orgId), eq(sprintPlanProposals.status, "pending")))
      : Promise.resolve(null),
    canDocuments ? db.select().from(generatedDocuments).where(and(eq(generatedDocuments.orgId, orgId), eq(generatedDocuments.status, "draft"))) : Promise.resolve(null),
  ]);
  return {
    pending_sprint_plans: pendingPlans?.length ?? null,
    documents_in_draft: draftDocs?.length ?? null,
  };
}

// Cross-pillar timeline. audit_log covers human/AI actions on PM+HR+admin
// resources; crm_activities covers the CRM timeline (leads/contacts/
// accounts/deals) which never wrote to audit_log — merging both is the only
// way to get one real feed rather than two separate half-feeds. No
// permission gate: same reasoning as executive dashboards elsewhere in this
// app — every row is already org-scoped by RLS, and entity-level access is
// re-checked wherever a feed item is clicked through to.
export async function loadActivityFeed(db: OrgScopedDb, orgId: string) {
  const [auditRows, crmRows] = await Promise.all([
    db.select().from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(desc(auditLog.createdAt)).limit(15),
    db.select().from(crmActivities).where(eq(crmActivities.orgId, orgId)).orderBy(desc(crmActivities.createdAt)).limit(15),
  ]);

  const fromAudit = auditRows.map((a) => ({
    type: a.action,
    pillar: a.targetType.startsWith("sprint_plan") || a.targetType === "document" ? "ai" : a.targetType.startsWith("employee") || a.targetType.startsWith("leave") ? "hr" : "pm",
    title: a.action.replace(/_/g, " "),
    description: a.targetType.replace(/_/g, " "),
    actor_name: a.actorType === "ai" ? "AI" : "Someone",
    timestamp: a.createdAt,
    linked_entity_type: a.targetType,
    linked_entity_id: a.targetId,
  }));
  const fromCrm = crmRows.map((c) => ({
    type: c.type,
    pillar: "crm",
    title: c.subject || `${c.type} on ${c.relatedType}`,
    description: c.description ?? "",
    actor_name: "Someone",
    timestamp: c.createdAt,
    linked_entity_type: c.relatedType,
    linked_entity_id: c.relatedId,
  }));

  return [...fromAudit, ...fromCrm].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 15);
}

export async function loadDashboard(db: OrgScopedDb, userId: string, orgId: string) {
  const [pm, hr, crm, ai, recentActivity] = await Promise.all([
    loadProjectsSection(db, userId, orgId),
    loadHrSection(db, userId, orgId),
    loadCrmSection(db, userId, orgId),
    loadAiSection(db, userId, orgId),
    loadActivityFeed(db, orgId),
  ]);

  return {
    projects: pm?.projects ?? null,
    tasks: pm?.tasks ?? null,
    sprints: pm?.sprints ?? null,
    active_projects_list: pm?.active_projects_list ?? null,
    recent_tasks_list: pm?.recent_tasks_list ?? null,
    employees: hr?.employees ?? null,
    attendance: hr?.attendance ?? null,
    leave: hr?.leave ?? null,
    open_hr_cases: hr?.open_hr_cases ?? null,
    leads: crm?.leads ?? null,
    deals: crm?.deals ?? null,
    accounts: crm?.accounts ?? null,
    // Mock — no real connector wired yet (CLAUDE.md §11a: Communication is
    // integration-only). Never gated by permission: it's the same fixture
    // data everyone with Communication sidebar access already sees.
    communication: {
      unread_messages: slackTotalUnread(),
      unread_emails: gmailUnread(),
      upcoming_meetings: nextMeeting() ? 1 : 0,
      missed_calls: callsMissedToday(),
    },
    ai,
    recent_activity: recentActivity,
  };
}
