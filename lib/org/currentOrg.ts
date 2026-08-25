import { cookies } from "next/headers";
import { withOrgContext } from "@/db/withOrgContext";
import { listMyOrgs, type OrgSummary } from "@/lib/api/orgs";
import { listMyGrants } from "@/lib/api/permissions";

export const ORG_COOKIE = "centr8-selected-org-id";

// Server-side counterpart to OrgContext's client cookie write — reads the
// same cookie so a Server Component can resolve "which org" without a
// client round trip. Falls back to the user's first org on a first-ever
// visit (no cookie set yet), same fallback OrgContext used with localStorage.
// Also seeds the permission grant list (lib/api/permissions.ts, same data
// app/api/permissions returns) so useOrg()'s can() has real answers from
// first paint instead of defaulting to false until the client fetch lands —
// without this, a server-rendered page whose gate checks can() (e.g. the
// CRM Leads page) can briefly render an incorrect "no access" message.
export async function getCurrentOrg(
  userId: string,
): Promise<{ orgId: string | null; orgs: OrgSummary[]; grants: { resourceType: string; action: string }[] }> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(ORG_COOKIE)?.value;

  // One withOrgContext call (one pooled connection/transaction) instead of
  // two — this runs on every fresh navigation into the app, so the second
  // round-trip was pure added latency, especially felt against Neon's
  // network round-trip time in local dev.
  return withOrgContext(userId, async (db) => {
    const orgs = await listMyOrgs(db, userId);
    const orgId = orgs.find((o) => o.id === stored)?.id ?? orgs[0]?.id ?? null;
    const grants = orgId ? await listMyGrants(db, userId, orgId) : [];
    return { orgId, orgs, grants };
  });
}
