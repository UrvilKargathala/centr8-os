import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { employees, people, tasks } from "@/db/schema";
import { ApiError } from "./helpers";

// Shared by app/api/team/route.ts (client-side filtered refetch) and
// app/(app)/team/page.tsx (server-rendered initial load) — the Team page's
// role/department/search filters are applied client-side against the full
// list (see the page's `filtered` useMemo), so the initial server fetch
// just needs every person, active or not, same as the page's own `loadAll`.
export function listAllPeople(db: OrgScopedDb, orgId: string) {
  return db.select().from(people).where(eq(people.orgId, orgId)).orderBy(people.fullName);
}

// app/(app)/tasks/page.tsx's assignee picker / display needs — active
// people only, same as its client fetch's `active=true` query param.
export function listActivePeople(db: OrgScopedDb, orgId: string) {
  return db
    .select({ id: people.id, fullName: people.fullName, jobTitle: people.jobTitle })
    .from(people)
    .where(and(eq(people.orgId, orgId), eq(people.isActive, true)))
    .orderBy(people.fullName);
}

// Minimal projection for the Team page's per-person capacity bar — a
// dedicated query rather than reusing /api/tasks' GET handler, which joins
// in attachment counts and other fields the capacity calc doesn't need.
export async function listOpenTaskEstimates(db: OrgScopedDb, orgId: string) {
  const rows = await db
    .select({ assigneeId: tasks.assigneeId, estimate: tasks.estimate })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), ne(tasks.status, "done"), ne(tasks.status, "cancelled")));

  const est: Record<string, number> = {};
  for (const t of rows) {
    if (t.assigneeId) est[t.assigneeId] = (est[t.assigneeId] ?? 0) + (t.estimate ?? 0);
  }
  return est;
}

// app/(app)/capacity/page.tsx's data need: every person (any status —
// utilization is computed against all of them, not just active) plus open
// tasks (todo/in_progress/in_review — excludes backlog and done/cancelled).
// The page previously called a client-only "/api/people" route that was
// never actually implemented (confirmed: no app/api/people directory
// exists) — this real query replaces that 404, which silently made the
// page always render zero capacity.
export function listCapacityData(db: OrgScopedDb, orgId: string) {
  return Promise.all([
    db.select().from(people).where(eq(people.orgId, orgId)),
    db
      .select({ id: tasks.id, title: tasks.title, assigneeId: tasks.assigneeId, status: tasks.status, estimate: tasks.estimate })
      .from(tasks)
      .where(and(eq(tasks.orgId, orgId), inArray(tasks.status, ["todo", "in_progress", "in_review"]))),
  ]);
}

// Shared by app/api/team/[id]/route.ts (GET) and
// app/(app)/team/[id]/page.tsx (server-rendered initial load).
export async function getPerson(db: OrgScopedDb, id: string) {
  const [row] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Person not found");

  // Optional bridge to the employees table (see db/schema.ts's
  // people.linkedEmployeeId comment) — resolve the name here so the detail
  // page can show "also see: HR record" without a second round trip.
  const linkedEmployee = row.linkedEmployeeId
    ? (await db.select({ id: employees.id, fullName: employees.fullName }).from(employees).where(eq(employees.id, row.linkedEmployeeId)).limit(1))[0]
    : null;

  return { ...row, linkedEmployee: linkedEmployee ?? null };
}

// Shared by app/api/team/[id]/stats/route.ts and
// app/(app)/team/[id]/page.tsx (server-rendered initial load).
export async function getPersonStats(db: OrgScopedDb, personId: string) {
  const assigned = eq(tasks.assigneeId, personId);

  const monthly = await db
    .select({
      month: sql<string>`to_char(${tasks.updatedAt}, 'YYYY-MM')`.as("month"),
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(tasks)
    .where(and(assigned, eq(tasks.status, "done")))
    .groupBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM')`);

  const daily = await db
    .select({
      day: sql<string>`to_char(${tasks.updatedAt}, 'YYYY-MM-DD')`.as("day"),
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(tasks)
    .where(and(assigned, eq(tasks.status, "done")))
    .groupBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM-DD')`);

  const [utilization] = await db
    .select({
      totalEstimate: sql<number>`coalesce(sum(${tasks.estimate}), 0)::int`.as("total_estimate"),
      openCount: sql<number>`count(*)::int`.as("open_count"),
    })
    .from(tasks)
    .where(and(assigned, ne(tasks.status, "done"), ne(tasks.status, "cancelled")));

  const recentTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(assigned)
    .orderBy(desc(tasks.updatedAt))
    .limit(10);

  return {
    monthly,
    daily,
    utilization: utilization ?? { totalEstimate: 0, openCount: 0 },
    recentTasks,
  };
}
