import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listMyGrants } from "@/lib/api/permissions";

// Prompt 1.4 task 4: the UI needs to hide/disable actions a role can't
// perform, sourced from the same table-driven `permissions` data
// requirePermission() (lib/api/permissions.ts) enforces server-side —
// not a hardcoded role name check, so a custom role or an org-specific
// override (both of which `permissions` already supports) is reflected in
// the UI too, not just enforced silently on the backend.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, (db) => listMyGrants(db, userId, orgId));
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
