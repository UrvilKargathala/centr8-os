import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { disconnectGoogleMeet } from "@/lib/api/googleMeet";

// A dedicated route, unlike ClickUp's disconnect (which reuses the generic
// DELETE /api/integrations/[id]) — Google actually has a revoke endpoint to
// call (a Personal API Token has nothing equivalent to revoke), so
// disconnecting here is a real API call, not just a DB clear.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "configure");
      return disconnectGoogleMeet(db, body.org_id);
    });

    return NextResponse.json({ data: { disconnected: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
