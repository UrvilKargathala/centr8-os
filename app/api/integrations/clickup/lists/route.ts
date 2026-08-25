import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpAllLists, setClickUpSelectedList, withConnectedClickUp } from "@/lib/api/clickup";
import { toPublicIntegration } from "@/lib/api/integrations";

// GET — every list across every space, for the picker dropdown.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const lists = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token) => fetchClickUpAllLists(teamId, token));
    });

    return NextResponse.json({ data: lists });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST — persist the chosen list. Same tier as connect/disconnect
// (integration:configure), since this changes what data flows into the org.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.list_id || !body.list_name) {
      throw new ApiError(400, "org_id, list_id and list_name are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "configure");
      return setClickUpSelectedList(db, body.org_id, body.list_id, body.list_name);
    });

    return NextResponse.json({ data: toPublicIntegration(row) });
  } catch (err) {
    return handleApiError(err);
  }
}
