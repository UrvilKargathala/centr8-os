import { and, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { people, projects, tasks, timeEntries, timesheetSubmissions } from "@/db/schema";
import { requirePermission } from "./permissions";

export async function resolveOwnPersonId(
  db: OrgScopedDb,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.orgId, orgId), eq(people.userId, userId)))
    .limit(1);
  return row?.id ?? null;
}

export async function listTimeEntries(
  db: OrgScopedDb,
  orgId: string,
  filters: {
    personId?: string;
    projectId?: string;
    taskId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
) {
  const conditions = [eq(timeEntries.orgId, orgId)];
  if (filters.personId) conditions.push(eq(timeEntries.personId, filters.personId));
  if (filters.projectId) conditions.push(eq(timeEntries.projectId, filters.projectId));
  if (filters.taskId) conditions.push(eq(timeEntries.taskId, filters.taskId!));
  if (filters.startDate) conditions.push(gte(timeEntries.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(timeEntries.date, filters.endDate));

  return db
    .select({
      id: timeEntries.id,
      orgId: timeEntries.orgId,
      taskId: timeEntries.taskId,
      projectId: timeEntries.projectId,
      personId: timeEntries.personId,
      date: timeEntries.date,
      hours: timeEntries.hours,
      description: timeEntries.description,
      isBillable: timeEntries.isBillable,
      createdAt: timeEntries.createdAt,
      updatedAt: timeEntries.updatedAt,
      createdBy: timeEntries.createdBy,
      personName: people.fullName,
      projectName: projects.name,
      taskTitle: tasks.title,
    })
    .from(timeEntries)
    .leftJoin(people, eq(timeEntries.personId, people.id))
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(desc(timeEntries.date), desc(timeEntries.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
}

export async function getTimeEntrySummary(
  db: OrgScopedDb,
  orgId: string,
  filters: {
    personId?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
  },
) {
  const conditions = [eq(timeEntries.orgId, orgId)];
  if (filters.personId) conditions.push(eq(timeEntries.personId, filters.personId));
  if (filters.projectId) conditions.push(eq(timeEntries.projectId, filters.projectId));
  if (filters.startDate) conditions.push(gte(timeEntries.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(timeEntries.date, filters.endDate));

  const [totals] = await db
    .select({
      totalHours: sum(timeEntries.hours),
      billableHours: sql<string>`SUM(CASE WHEN ${timeEntries.isBillable} THEN ${timeEntries.hours} ELSE 0 END)`,
      entryCount: sql<number>`count(*)::int`,
    })
    .from(timeEntries)
    .where(and(...conditions));

  const byProject = await db
    .select({
      projectId: timeEntries.projectId,
      projectName: projects.name,
      totalHours: sum(timeEntries.hours),
    })
    .from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(...conditions))
    .groupBy(timeEntries.projectId, projects.name);

  const byDate = await db
    .select({
      date: timeEntries.date,
      totalHours: sum(timeEntries.hours),
    })
    .from(timeEntries)
    .where(and(...conditions))
    .groupBy(timeEntries.date)
    .orderBy(timeEntries.date);

  return {
    totalHours: totals?.totalHours ?? "0",
    billableHours: totals?.billableHours ?? "0",
    entryCount: totals?.entryCount ?? 0,
    byProject,
    byDate,
  };
}

// Shared by app/(app)/projects/time-tracking/page.tsx (server-rendered
// initial load, default "My" tab / current week) — mirrors the page's own
// client loadData() for mine=true: entries + summary + this week's
// submission status, all for the caller's own person row.
export async function getMyTimeTrackingWeek(db: OrgScopedDb, userId: string, orgId: string, startDate: string, endDate: string) {
  await requirePermission(db, userId, orgId, "time", "view_own");
  const personId = await resolveOwnPersonId(db, userId, orgId);
  if (!personId) {
    return { entries: [], summary: { totalHours: "0", billableHours: "0", entryCount: 0, byProject: [], byDate: [] }, submission: null };
  }

  const [entries, summary, [submission]] = await Promise.all([
    listTimeEntries(db, orgId, { personId, startDate, endDate, limit: 200, offset: 0 }),
    getTimeEntrySummary(db, orgId, { personId, startDate, endDate }),
    db
      .select()
      .from(timesheetSubmissions)
      .where(and(eq(timesheetSubmissions.orgId, orgId), eq(timesheetSubmissions.personId, personId), eq(timesheetSubmissions.weekStart, startDate)))
      .limit(1),
  ]);

  return { entries, summary, submission: submission ?? null };
}
