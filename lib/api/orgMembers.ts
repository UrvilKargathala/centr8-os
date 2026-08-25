import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { orgMemberships } from "@/db/schema";
import { requirePermission } from "./permissions";
import { supabaseAdminClient } from "./supabaseAdmin";

// Shared by app/api/org-members/route.ts (GET) and
// app/(app)/admin/members/page.tsx (server-rendered initial load).
export async function listOrgMembers(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "organization", "update");
  const rows = await db.select().from(orgMemberships).where(eq(orgMemberships.orgId, orgId));

  const supabase = supabaseAdminClient();
  return Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.auth.admin.getUserById(row.userId);
      return {
        userId: row.userId,
        email: data.user?.email ?? null,
        role: row.role,
        deactivatedAt: row.deactivatedAt,
      };
    }),
  );
}
