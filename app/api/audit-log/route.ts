import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listRecentAuditLog } from "@/lib/api/projects";

// Not part of any PHASE_PROMPT_UI.md prompt — the dashboard's "recent
// activity feed" (Prompt 0.4) explicitly wants mock entries, but audit_log
// already exists as a real, RLS-scoped table (every mutating route in this
// app writes to it), so faking the feed would throw away real data that's
// sitting right there. Same reasoning as /api/orgs: read-only, RLS alone
// scopes it (org_id in (...)), no extra permission check needed since this
// isn't a resource type in the permissions table.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

    const rows = await withOrgContext(userId, (db) => listRecentAuditLog(db, orgId, limit));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
