import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { dealStageHistory, deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [deal] = await db.select({ orgId: deals.orgId }).from(deals).where(eq(deals.id, id));
      if (!deal) return undefined;
      await requirePermission(db, userId, deal.orgId, "deal", "read");
      const history = await db.select().from(dealStageHistory).where(eq(dealStageHistory.dealId, id)).orderBy(asc(dealStageHistory.changedAt));
      return { deal_id: id, history };
    });
    if (!result) throw new ApiError(404, "Deal not found");

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
