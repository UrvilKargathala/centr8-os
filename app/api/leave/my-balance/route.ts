import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getMyLeaveBalances } from "@/lib/api/leave";

// Current year's balance across every active leave type — lazily
// initializes a leave_balances row per type on first read, same as leave
// creation does, so this reflects the true remaining-days picture even
// before the employee has ever requested that type.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

    const data = await withOrgContext(userId, (db) => getMyLeaveBalances(db, userId, orgId, year));
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
