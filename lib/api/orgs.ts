import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { orgMemberships, organizations } from "@/db/schema";

export type OrgSummary = { id: string; name: string; slug: string; role: string };

// Shared by app/api/orgs/route.ts and app/(app)/layout.tsx (server-rendered
// org seed) so the query lives in one place — RLS alone scopes the result to
// the caller's own memberships, no extra permission check needed.
export function listMyOrgs(db: OrgScopedDb, userId: string): Promise<OrgSummary[]> {
  return db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: orgMemberships.role })
    .from(orgMemberships)
    .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
    .where(eq(orgMemberships.userId, userId));
}
