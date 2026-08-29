import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { listMyOrgs, createOrg } from "@/lib/api/orgs";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

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

// Any authenticated user may create their own new org and becomes its
// owner — distinct from joining an *existing* org, which stays invite-only
// (CLAUDE.md §11a) via POST /api/org-members.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new ApiError(400, "name is required");

    const org = await createOrg(userId, name);
    return NextResponse.json({ data: org }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
