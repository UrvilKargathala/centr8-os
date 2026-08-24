import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { listMyOrgs } from "@/lib/api/orgs";
import { handleApiError, requireUserId } from "@/lib/api/helpers";

// Not part of any PHASE_PROMPT_UI.md prompt — mock data never needed a way
// to discover "which orgs is this user in," since it just assumed one. Real
// data does: this is the org-switcher's data source and what the app shell
// uses to pick a default org on first load. RLS alone scopes the result
// (organizations_isolation / org_memberships_isolation), no extra
// permission check needed for a plain "list my own memberships" read.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const rows = await withOrgContext(userId, (db) => listMyOrgs(db, userId));
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
