import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { monthlyPeriods } from "@/lib/api/payroll";

// Computed, not stored — current + previous 12 months. Anyone who can see
// sensitive compensation data can see what periods exist (no separate
// payroll:view — generation/finalize/mark_paid are the real gates).
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, (db) => requirePermission(db, userId, orgId, "compensation", "view_sensitive"));

    return NextResponse.json({ data: monthlyPeriods() });
  } catch (err) {
    return handleApiError(err);
  }
}
