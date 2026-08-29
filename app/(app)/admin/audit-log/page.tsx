import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listRecentAuditLog } from "@/lib/api/projects";
import AuditLogPageClient, { type AuditEntry } from "./AuditLogPageClient";

export default async function AuditLogPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <AuditLogPageClient />;

  try {
    const initial = await withOrgContext(userId, (db) => listRecentAuditLog(db, orgId, 50));
    return <AuditLogPageClient initial={initial as unknown as AuditEntry[]} />;
  } catch {
    return <AuditLogPageClient />;
  }
}
