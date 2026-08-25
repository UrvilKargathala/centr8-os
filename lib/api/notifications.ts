import { and, desc, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { notifications } from "@/db/schema";

// Shared by app/api/notifications/route.ts (GET) and
// app/(app)/notifications/page.tsx (server-rendered initial load, first page).
export function listNotifications(db: OrgScopedDb, orgId: string, opts: { unreadOnly?: boolean; limit: number; offset: number }) {
  const conditions = [eq(notifications.orgId, orgId)];
  if (opts.unreadOnly) conditions.push(eq(notifications.isRead, false));
  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
}
