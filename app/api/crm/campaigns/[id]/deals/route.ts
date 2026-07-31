import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { campaigns } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { computeCampaignMetrics } from "@/lib/api/crm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [campaign] = await db.select({ orgId: campaigns.orgId }).from(campaigns).where(eq(campaigns.id, id));
      if (!campaign) return undefined;
      await requirePermission(db, userId, campaign.orgId, "campaign", "read");
      const metrics = await computeCampaignMetrics(db, campaign.orgId, id);
      return metrics.deals;
    });
    if (result === undefined) throw new ApiError(404, "Campaign not found");

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
