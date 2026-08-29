import { cache } from "react";
import { cookies } from "next/headers";
import { withOrgContext } from "@/db/withOrgContext";
import { listMyOrgs, type OrgSummary } from "@/lib/api/orgs";
import { listMyGrants } from "@/lib/api/permissions";

export const ORG_COOKIE = "centr8-selected-org-id";

// Cached per-request: layout.tsx calls this first, then every page.tsx calls
// it again — without cache(), each call opens a separate Neon pool connection
// (BEGIN + SET ROLE + queries + COMMIT). With cache(), the second call is free.
export const getCurrentOrg = cache(async (
  userId: string,
): Promise<{ orgId: string | null; orgs: OrgSummary[]; grants: { resourceType: string; action: string }[] }> => {
  const cookieStore = await cookies();
  const stored = cookieStore.get(ORG_COOKIE)?.value;

  return withOrgContext(userId, async (db) => {
    const orgs = await listMyOrgs(db, userId);
    const orgId = orgs.find((o) => o.id === stored)?.id ?? orgs[0]?.id ?? null;
    const grants = orgId ? await listMyGrants(db, userId, orgId) : [];
    return { orgId, orgs, grants };
  });
});
