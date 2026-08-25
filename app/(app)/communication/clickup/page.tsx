import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { fetchClickUpAllLists, fetchClickUpTasks, withConnectedClickUp, type ClickUpConfig } from "@/lib/api/clickup";
import { requirePermission } from "@/lib/api/permissions";
import { ClickUpPageClient, type ClickUpInitialData } from "./ClickUpPageClient";

// Seeds the default "Tasks" tab (connection status, selected-list metadata,
// list picker options, task list). Docs tab loads lazily on switch,
// unchanged.
export default async function ClickUpPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ClickUpPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      const [row] = await db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "clickup")));
      if (!row || row.status !== "connected") {
        return { connected: false, selectedListId: null, selectedListName: null, listOptions: [], tasks: [] } as ClickUpInitialData;
      }

      const config = row.config as ClickUpConfig;
      const [listOptions, tasks] = await withConnectedClickUp(db, orgId, (teamId, token) =>
        Promise.all([fetchClickUpAllLists(teamId, token), fetchClickUpTasks(teamId, token, config.selected_list_id)]),
      );

      return {
        connected: true,
        selectedListId: config.selected_list_id ?? null,
        selectedListName: config.selected_list_name ?? null,
        listOptions,
        tasks,
      } as ClickUpInitialData;
    });

    return <ClickUpPageClient initial={initial} />;
  } catch {
    return <ClickUpPageClient />;
  }
}
