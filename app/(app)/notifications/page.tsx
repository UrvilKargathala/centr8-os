import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listNotifications } from "@/lib/api/notifications";
import NotificationsPageClient, { type NotificationsInitialData } from "./NotificationsPageClient";

const PAGE_SIZE = 20;

export default async function NotificationsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <NotificationsPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const items = await listNotifications(db, orgId, { limit: PAGE_SIZE, offset: 0 });
      return { items, hasMore: items.length === PAGE_SIZE } as unknown as NotificationsInitialData;
    });
    return <NotificationsPageClient initial={initial} />;
  } catch {
    return <NotificationsPageClient />;
  }
}
