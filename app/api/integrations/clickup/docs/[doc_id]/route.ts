import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpDocPages, withConnectedClickUp } from "@/lib/api/clickup";

type Params = { params: Promise<{ doc_id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { doc_id } = await params;
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const pages = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token) => fetchClickUpDocPages(teamId, doc_id, token));
    });

    return NextResponse.json({ data: pages });
  } catch (err) {
    return handleApiError(err);
  }
}
