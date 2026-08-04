import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Mirrors app/api/integrations/gmail/connect/route.ts's shape, but the
// Google Meet OAuth flow itself isn't wired yet (CLAUDE.md §11a: Video
// integration lands in Phase 7) — so this always takes the same
// errorRedirect path gmail/connect takes when its client credentials
// aren't configured, rather than a 404 when the UI's Connect button is
// clicked.
export async function GET(req: NextRequest) {
  const errorRedirect = (message: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("google-meet", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, (db) => requirePermission(db, userId, orgId, "integration", "configure"));

    return errorRedirect("Google Meet scheduling lands with the real connector — the UI wiring is Phase 7.");
  } catch (err) {
    if (err instanceof ApiError) return errorRedirect(err.message);
    return handleApiError(err);
  }
}
