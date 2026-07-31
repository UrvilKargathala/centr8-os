import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { hrCases } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/hrCases";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "hr_case", "view_own");
      const ownId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!ownId) return [];
      return db.select().from(hrCases).where(and(eq(hrCases.orgId, orgId), eq(hrCases.employeeId, ownId)));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
