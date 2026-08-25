import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { campaigns } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getCampaignDetail, requireCampaignUpdateAccess } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, (db) => getCampaignDetail(db, userId, id));
    if (!result) throw new ApiError(404, "Campaign not found");

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: campaigns.orgId }).from(campaigns).where(eq(campaigns.id, id));
      if (!existing) return undefined;
      await requireCampaignUpdateAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(campaigns)
        .set({
          name: body.name ?? undefined,
          type: body.type ?? undefined,
          status: body.status ?? undefined,
          description: body.description === undefined ? undefined : body.description,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
          budgetAllocated: body.budget_allocated === undefined ? undefined : body.budget_allocated,
          budgetSpent: body.budget_spent === undefined ? undefined : body.budget_spent,
          currency: body.currency ?? undefined,
          targetAudience: body.target_audience === undefined ? undefined : body.target_audience,
          channel: body.channel === undefined ? undefined : body.channel,
          ownerId: body.owner_id === undefined ? undefined : body.owner_id,
          tags: body.tags ?? undefined,
          notes: body.notes === undefined ? undefined : body.notes,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Campaign not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
