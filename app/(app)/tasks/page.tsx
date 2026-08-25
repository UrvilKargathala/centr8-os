import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getTaskCounts, listTasksFiltered } from "@/lib/api/tasks";
import { listProjectNames } from "@/lib/api/projects";
import { listActivePeople } from "@/lib/api/team";
import { TasksPageClient, type TasksInitialData } from "./TasksPageClient";

// Mirrors TasksPageClient's tabToParams() so the initial server-rendered
// data matches whatever tab/filters are already in the URL (bookmarked or
// shared links land on the right filtered set, not "all" then a flash).
function tabFilters(tab: string | undefined): { status?: string; overdueOnly?: boolean } {
  if (tab === "overdue") return { overdueOnly: true };
  const map: Record<string, string> = { pending: "todo", in_progress: "in_progress", in_review: "in_review", completed: "done" };
  return tab && map[tab] ? { status: map[tab] } : {};
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <TasksPageClient />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = {
    orgId,
    ...tabFilters(one(sp.tab)),
    project: one(sp.project),
    priority: one(sp.priority),
    assigneeId: one(sp.assignee),
    q: one(sp.q),
  };

  const [rows, counts, projects, people] = await withOrgContext(userId, (db) =>
    Promise.all([listTasksFiltered(db, filters), getTaskCounts(db, orgId), listProjectNames(db, orgId), listActivePeople(db, orgId)]),
  );

  const initial: TasksInitialData = {
    rows: rows as unknown as TasksInitialData["rows"],
    counts,
    projects,
    people: people as unknown as TasksInitialData["people"],
  };

  return <TasksPageClient initial={initial} />;
}
