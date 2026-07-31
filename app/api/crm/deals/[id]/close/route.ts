import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { closeDeal, requireDealCloseAccess, resolveOwnEmployeeId } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (body.outcome !== "won" && body.outcome !== "lost") throw new ApiError(400, "outcome must be 'won' or 'lost'");

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: deals.orgId }).from(deals).where(eq(deals.id, id));
      if (!existing) throw new ApiError(404, "Deal not found");
      await requireDealCloseAccess(db, userId, existing.orgId);
      const employeeId = await resolveOwnEmployeeId(db, userId, existing.orgId);
      return closeDeal(db, existing.orgId, id, body.outcome, employeeId, body.lost_reason ?? null, body.won_notes ?? null);
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
