import { and, eq, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import {
  resourceForecastEntries,
  projects,
  people,
  employees,
  leaveRequests,
  timeEntries,
} from "@/db/schema";

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().slice(0, 10);
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(start: string, end: string): string[] {
  const weeks: string[] = [];
  let cur = start;
  while (cur <= end) {
    weeks.push(cur);
    cur = addWeeks(cur, 1);
  }
  return weeks;
}

export async function getActiveProjects(db: OrgScopedDb, orgId: string) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
    })
    .from(projects)
    .where(
      and(
        eq(projects.orgId, orgId),
        inArray(projects.status, ["planning", "active", "on_hold"]),
      ),
    )
    .orderBy(asc(projects.name));
}

export async function upsertForecastEntry(
  db: OrgScopedDb,
  orgId: string,
  data: {
    projectId: string;
    personId: string;
    weekStart: string;
    plannedHours: number;
    isBillable: boolean;
    createdBy: string;
  },
) {
  const [existing] = await db
    .select({ id: resourceForecastEntries.id })
    .from(resourceForecastEntries)
    .where(
      and(
        eq(resourceForecastEntries.orgId, orgId),
        eq(resourceForecastEntries.projectId, data.projectId),
        eq(resourceForecastEntries.personId, data.personId),
        eq(resourceForecastEntries.weekStart, data.weekStart),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(resourceForecastEntries)
      .set({
        plannedHours: String(data.plannedHours),
        isBillable: data.isBillable,
        updatedAt: new Date(),
      })
      .where(eq(resourceForecastEntries.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(resourceForecastEntries)
    .values({
      orgId,
      projectId: data.projectId,
      personId: data.personId,
      weekStart: data.weekStart,
      plannedHours: String(data.plannedHours),
      isBillable: data.isBillable,
      createdBy: data.createdBy,
    })
    .returning();
  return inserted;
}

export async function getByProject(
  db: OrgScopedDb,
  orgId: string,
  weekStart: string,
  weeksCount: number,
  projectId?: string,
) {
  const weekEnd = addWeeks(weekStart, weeksCount - 1);
  const conditions = [
    eq(resourceForecastEntries.orgId, orgId),
    gte(resourceForecastEntries.weekStart, weekStart),
    lte(resourceForecastEntries.weekStart, weekEnd),
  ];
  if (projectId) conditions.push(eq(resourceForecastEntries.projectId, projectId));

  const rows = await db
    .select({
      id: resourceForecastEntries.id,
      projectId: resourceForecastEntries.projectId,
      projectName: projects.name,
      personId: resourceForecastEntries.personId,
      personName: people.fullName,
      role: people.jobTitle,
      department: people.department,
      weekStart: resourceForecastEntries.weekStart,
      plannedHours: resourceForecastEntries.plannedHours,
      isBillable: resourceForecastEntries.isBillable,
    })
    .from(resourceForecastEntries)
    .leftJoin(projects, eq(resourceForecastEntries.projectId, projects.id))
    .leftJoin(people, eq(resourceForecastEntries.personId, people.id))
    .where(and(...conditions))
    .orderBy(asc(projects.name), asc(people.fullName), asc(resourceForecastEntries.weekStart));

  const grouped: Record<
    string,
    {
      projectId: string;
      projectName: string;
      resources: Record<
        string,
        {
          personId: string;
          personName: string;
          role: string | null;
          department: string | null;
          weeks: Record<string, { id: string; plannedHours: string; isBillable: boolean }>;
        }
      >;
    }
  > = {};

  for (const r of rows) {
    if (!grouped[r.projectId]) {
      grouped[r.projectId] = {
        projectId: r.projectId,
        projectName: r.projectName ?? "",
        resources: {},
      };
    }
    const proj = grouped[r.projectId];
    if (!proj.resources[r.personId]) {
      proj.resources[r.personId] = {
        personId: r.personId,
        personName: r.personName ?? "",
        role: r.role,
        department: r.department,
        weeks: {},
      };
    }
    proj.resources[r.personId].weeks[r.weekStart] = {
      id: r.id,
      plannedHours: r.plannedHours,
      isBillable: r.isBillable,
    };
  }

  return Object.values(grouped).map((p) => ({
    ...p,
    resources: Object.values(p.resources),
  }));
}

async function getApprovedLeaveByWeek(
  db: OrgScopedDb,
  orgId: string,
  weekStart: string,
  weekEnd: string,
): Promise<Map<string, Map<string, number>>> {
  // leave_requests is on employees.id, forecast is on people.id
  // Bridge: people.userId = employees.userId
  const leaveRows = await db
    .select({
      personId: people.id,
      availableHours: people.availableHoursPerWeek,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      totalDays: leaveRequests.totalDays,
      isHalfDay: leaveRequests.isHalfDay,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .innerJoin(
      people,
      and(eq(people.userId, employees.userId), eq(people.orgId, orgId)),
    )
    .where(
      and(
        eq(leaveRequests.orgId, orgId),
        eq(leaveRequests.status, "approved"),
        lte(leaveRequests.startDate, weekEnd),
        gte(leaveRequests.endDate, weekStart),
      ),
    );

  // Map<personId, Map<weekStart, leaveHours>>
  const result = new Map<string, Map<string, number>>();
  const dailyHours = (avail: number) => avail / 5;

  for (const lr of leaveRows) {
    const dh = dailyHours(lr.availableHours);
    const leaveStart = new Date(lr.startDate);
    const leaveEnd = new Date(lr.endDate);

    let cur = new Date(weekStart);
    const end = new Date(weekEnd);
    end.setDate(end.getDate() + 6);

    while (cur <= end) {
      if (cur >= leaveStart && cur <= leaveEnd) {
        const dow = cur.getDay();
        if (dow >= 1 && dow <= 5) {
          const ws = mondayOf(cur);
          if (ws >= weekStart && ws <= weekEnd) {
            if (!result.has(lr.personId)) result.set(lr.personId, new Map());
            const personMap = result.get(lr.personId)!;
            const prev = personMap.get(ws) ?? 0;
            const hrs = lr.isHalfDay ? dh / 2 : dh;
            personMap.set(ws, prev + hrs);
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return result;
}

export async function getWorkload(
  db: OrgScopedDb,
  orgId: string,
  weekStart: string,
  weeksCount: number,
) {
  const weekEnd = addWeeks(weekStart, weeksCount - 1);
  const weeks = weeksBetween(weekStart, weekEnd);

  const allPeople = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      role: people.jobTitle,
      department: people.department,
      availableHoursPerWeek: people.availableHoursPerWeek,
    })
    .from(people)
    .where(and(eq(people.orgId, orgId), eq(people.isActive, true)))
    .orderBy(asc(people.fullName));

  const allocRows = await db
    .select({
      personId: resourceForecastEntries.personId,
      weekStart: resourceForecastEntries.weekStart,
      totalPlanned: sql<string>`sum(${resourceForecastEntries.plannedHours})`,
    })
    .from(resourceForecastEntries)
    .where(
      and(
        eq(resourceForecastEntries.orgId, orgId),
        gte(resourceForecastEntries.weekStart, weekStart),
        lte(resourceForecastEntries.weekStart, weekEnd),
      ),
    )
    .groupBy(resourceForecastEntries.personId, resourceForecastEntries.weekStart);

  const allocMap = new Map<string, Map<string, number>>();
  for (const r of allocRows) {
    if (!allocMap.has(r.personId)) allocMap.set(r.personId, new Map());
    allocMap.get(r.personId)!.set(r.weekStart, parseFloat(r.totalPlanned || "0"));
  }

  const leaveMap = await getApprovedLeaveByWeek(db, orgId, weekStart, weekEnd);

  return allPeople.map((p) => ({
    personId: p.id,
    personName: p.fullName,
    role: p.role,
    department: p.department,
    availableHoursPerWeek: p.availableHoursPerWeek,
    weeks: weeks.map((ws) => {
      const planned = allocMap.get(p.id)?.get(ws) ?? 0;
      const leaveHours = leaveMap.get(p.id)?.get(ws) ?? 0;
      const available = Math.max(0, p.availableHoursPerWeek - leaveHours);
      const utilization = available > 0 ? Math.round((planned / available) * 100) : 0;
      return {
        weekStart: ws,
        plannedHours: planned,
        leaveHours,
        availableHours: available,
        utilizationPercent: utilization,
      };
    }),
  }));
}

export async function getSummary(
  db: OrgScopedDb,
  orgId: string,
  periodStart: string,
  periodEnd: string,
) {
  const totalPeople = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(people)
    .where(and(eq(people.orgId, orgId), eq(people.isActive, true)));

  const totalResources = totalPeople[0]?.count ?? 0;

  // Outsourced = employees with contract/consultant type, bridged to people
  const outsourcedRows = await db
    .select({ count: sql<number>`count(distinct ${people.id})::int` })
    .from(people)
    .innerJoin(
      employees,
      and(eq(people.userId, employees.userId), eq(people.orgId, employees.orgId)),
    )
    .where(
      and(
        eq(people.orgId, orgId),
        eq(people.isActive, true),
        inArray(employees.employmentType, ["contract", "consultant"]),
      ),
    );
  const outsourcedCount = outsourcedRows[0]?.count ?? 0;

  // Weeks in period
  const wsStart = mondayOf(new Date(periodStart));
  const wsEnd = mondayOf(new Date(periodEnd));
  const weeks = weeksBetween(wsStart, wsEnd);
  const weeksCount = weeks.length || 1;

  // Planned hours in period
  const [plannedRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${resourceForecastEntries.plannedHours}), '0')`,
      billable: sql<string>`coalesce(sum(case when ${resourceForecastEntries.isBillable} then ${resourceForecastEntries.plannedHours} else 0 end), '0')`,
    })
    .from(resourceForecastEntries)
    .where(
      and(
        eq(resourceForecastEntries.orgId, orgId),
        gte(resourceForecastEntries.weekStart, wsStart),
        lte(resourceForecastEntries.weekStart, wsEnd),
      ),
    );

  const forecastedHours = parseFloat(plannedRow?.total ?? "0");

  // Actual hours from time_entries
  const [actualRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${timeEntries.hours}), '0')`,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.orgId, orgId),
        gte(timeEntries.date, periodStart),
        lte(timeEntries.date, periodEnd),
      ),
    );
  const actualHours = parseFloat(actualRow?.total ?? "0");
  const variance = forecastedHours > 0
    ? Math.round(((actualHours - forecastedHours) / forecastedHours) * 100)
    : 0;

  // Utilization: total planned / total capacity across all people across all weeks
  const totalCapacity = totalResources * 40 * weeksCount;
  const currentUtilization = totalCapacity > 0
    ? Math.round((forecastedHours / totalCapacity) * 100)
    : 0;

  // Over-utilized: people with >100% utilization in any week
  const workload = await getWorkload(db, orgId, wsStart, weeksCount);
  let overUtilized = 0;
  for (const p of workload) {
    if (p.weeks.some((w) => w.utilizationPercent > 100)) overUtilized++;
  }

  // Top projects by resource count
  const topProjects = await db
    .select({
      projectId: resourceForecastEntries.projectId,
      projectName: projects.name,
      resourceCount: sql<number>`count(distinct ${resourceForecastEntries.personId})::int`,
    })
    .from(resourceForecastEntries)
    .leftJoin(projects, eq(resourceForecastEntries.projectId, projects.id))
    .where(
      and(
        eq(resourceForecastEntries.orgId, orgId),
        gte(resourceForecastEntries.weekStart, wsStart),
        lte(resourceForecastEntries.weekStart, wsEnd),
      ),
    )
    .groupBy(resourceForecastEntries.projectId, projects.name)
    .orderBy(desc(sql`count(distinct ${resourceForecastEntries.personId})`))
    .limit(5);

  return {
    totalResources,
    currentUtilization,
    outsourcedCount,
    overUtilizedCount: overUtilized,
    topProjects,
    forecastedVsActual: {
      forecastedHours,
      actualHours,
      variancePercent: variance,
    },
    resourceWarningsCount: overUtilized,
    workload,
  };
}

export async function getUtilizationByDepartment(
  db: OrgScopedDb,
  orgId: string,
  year: number,
) {
  const months: { month: string; department: string; billableHours: number; nonBillableHours: number; leaveHours: number; unallocatedHours: number }[] = [];

  const allPeople = await db
    .select({
      id: people.id,
      department: people.department,
      availableHoursPerWeek: people.availableHoursPerWeek,
    })
    .from(people)
    .where(and(eq(people.orgId, orgId), eq(people.isActive, true)));

  const deptCapacity = new Map<string, number>();
  for (const p of allPeople) {
    const dept = p.department || "Unassigned";
    deptCapacity.set(dept, (deptCapacity.get(dept) ?? 0) + p.availableHoursPerWeek);
  }

  for (let m = 0; m < 12; m++) {
    const monthStart = `${year}-${String(m + 1).padStart(2, "0")}-01`;
    const nextMonth = m === 11 ? `${year + 1}-01-01` : `${year}-${String(m + 2).padStart(2, "0")}-01`;
    const monthLabel = new Date(year, m).toLocaleString("en", { month: "short" });
    const weeksInMonth = 4.33;

    const forecasts = await db
      .select({
        personId: resourceForecastEntries.personId,
        billable: sql<string>`coalesce(sum(case when ${resourceForecastEntries.isBillable} then ${resourceForecastEntries.plannedHours} else 0 end), '0')`,
        nonBillable: sql<string>`coalesce(sum(case when not ${resourceForecastEntries.isBillable} then ${resourceForecastEntries.plannedHours} else 0 end), '0')`,
      })
      .from(resourceForecastEntries)
      .where(
        and(
          eq(resourceForecastEntries.orgId, orgId),
          gte(resourceForecastEntries.weekStart, monthStart),
          sql`${resourceForecastEntries.weekStart} < ${nextMonth}`,
        ),
      )
      .groupBy(resourceForecastEntries.personId);

    const personDept = new Map<string, string>();
    for (const p of allPeople) personDept.set(p.id, p.department || "Unassigned");

    const deptBillable = new Map<string, number>();
    const deptNonBillable = new Map<string, number>();

    for (const f of forecasts) {
      const dept = personDept.get(f.personId) ?? "Unassigned";
      deptBillable.set(dept, (deptBillable.get(dept) ?? 0) + parseFloat(f.billable));
      deptNonBillable.set(dept, (deptNonBillable.get(dept) ?? 0) + parseFloat(f.nonBillable));
    }

    for (const [dept, weeklyCapacity] of deptCapacity) {
      const monthlyCapacity = weeklyCapacity * weeksInMonth;
      const billable = deptBillable.get(dept) ?? 0;
      const nonBillable = deptNonBillable.get(dept) ?? 0;
      const unallocated = Math.max(0, monthlyCapacity - billable - nonBillable);

      months.push({
        month: monthLabel,
        department: dept,
        billableHours: Math.round(billable),
        nonBillableHours: Math.round(nonBillable),
        leaveHours: 0,
        unallocatedHours: Math.round(unallocated),
      });
    }
  }

  return months;
}
