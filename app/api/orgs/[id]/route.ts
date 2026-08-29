import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { updateOrgName } from "@/lib/api/orgs";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new ApiError(400, "name is required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, id, "organization", "update");
      await updateOrgName(db, id, name);
    });

    return NextResponse.json({ data: { id, name } });
  } catch (err) {
    return handleApiError(err);
  }
}
