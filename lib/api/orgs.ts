import { eq } from "drizzle-orm";
import { db as rootDb } from "@/db";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { orgMemberships, organizations } from "@/db/schema";

export type OrgSummary = { id: string; name: string; slug: string; role: string };
export type OrgDetail = { id: string; name: string; slug: string; createdAt: string };

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

export function getOrgDetail(db: OrgScopedDb, orgId: string): Promise<OrgDetail | null> {
  return db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .then((rows) => (rows[0] as unknown as OrgDetail) ?? null);
}

export async function updateOrgName(db: OrgScopedDb, orgId: string, name: string): Promise<void> {
  await db.update(organizations).set({ name }).where(eq(organizations.id, orgId));
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org";
}

// A brand-new org has no org_memberships row yet, so organizations_isolation's
// WITH CHECK (id in auth.user_org_ids(), which reads org_memberships) would
// reject the insert on the normal RLS-scoped connection — chicken-and-egg.
// Uses the plain BYPASSRLS db (db/index.ts) for both inserts instead, same
// as the SCIM/portal provisioning routes that already need to create rows
// before the caller has a membership to be scoped by.
export async function createOrg(userId: string, name: string): Promise<OrgSummary> {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [existing] = await rootDb.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  const [org] = await rootDb.insert(organizations).values({ name, slug }).returning();
  await rootDb.insert(orgMemberships).values({ userId, orgId: org.id, role: "owner" });
  return { id: org.id, name: org.name, slug: org.slug, role: "owner" };
}
