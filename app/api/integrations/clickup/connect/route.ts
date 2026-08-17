import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { connectClickUp } from "@/lib/api/clickup";
import { toPublicIntegration } from "@/lib/api/integrations";

// Personal API Token, not OAuth — validated synchronously against ClickUp's
// own /team endpoint before anything is written. A rejected token never
// touches the row (connectClickUp's validateClickUpToken call throws
// before the upsert).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.api_token) throw new ApiError(400, "org_id and api_token are required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "configure");
      return connectClickUp(db, body.org_id, userId, body.api_token);
    });

    return NextResponse.json({ data: toPublicIntegration(row) });
  } catch (err) {
    return handleApiError(err);
  }
}
