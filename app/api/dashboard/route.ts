import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { loadDashboard } from "@/lib/api/dashboard";

// Global cross-pillar dashboard (/dashboard). Requires any authenticated
// user — no dedicated resourceType: each section inside loadDashboard()
// gates itself on the same permission its own pillar page already
// requires, resolving to null (not a 403) when denied. See
// lib/api/dashboard.ts for the section-by-section logic.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, (db) => loadDashboard(db, userId, orgId));
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
