import { and, eq, inArray, ne } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { people, tasks } from "@/db/schema";

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
