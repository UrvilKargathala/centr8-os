import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts, activities, contacts, dealStageHistory, deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { changeDealStage, resolveOwnEmployeeId } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [deal] = await db.select().from(deals).where(eq(deals.id, id));
      if (!deal) return undefined;
      await requirePermission(db, userId, deal.orgId, "deal", "read");

      const [account, contact, stageHistory, timeline] = await Promise.all([
        deal.accountId ? db.select().from(accounts).where(eq(accounts.id, deal.accountId)).then((r) => r[0] ?? null) : Promise.resolve(null),
        deal.primaryContactId ? db.select().from(contacts).where(eq(contacts.id, deal.primaryContactId)).then((r) => r[0] ?? null) : Promise.resolve(null),
        db.select().from(dealStageHistory).where(eq(dealStageHistory.dealId, id)).orderBy(desc(dealStageHistory.changedAt)),
        db.select().from(activities).where(eq(activities.relatedId, id)).orderBy(desc(activities.activityDate)),
      ]);

      return { deal, account, contact, stageHistory, activities: timeline.filter((a) => a.relatedType === "deal") };
    });
    if (!result) throw new ApiError(404, "Deal not found");

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
      const [existing] = await db.select().from(deals).where(eq(deals.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "deal", "update");

      const stageChanged = body.stage !== undefined && body.stage !== existing.stage;
      if (stageChanged) {
        const employeeId = await resolveOwnEmployeeId(db, userId, existing.orgId);
        await changeDealStage(db, existing.orgId, id, body.stage, employeeId, body.probability);
      }

      const [updated] = await db
        .update(deals)
        .set({
          name: body.name ?? undefined,
          accountId: body.account_id === undefined ? undefined : body.account_id,
          primaryContactId: body.primary_contact_id === undefined ? undefined : body.primary_contact_id,
          value: body.value === undefined ? undefined : body.value,
          currency: body.currency ?? undefined,
          recurringRevenue: body.recurring_revenue === undefined ? undefined : body.recurring_revenue,
          recurringFrequency: body.recurring_frequency === undefined ? undefined : body.recurring_frequency,
          probability: stageChanged ? undefined : body.probability === undefined ? undefined : body.probability,
          expectedCloseDate: body.expected_close_date === undefined ? undefined : body.expected_close_date,
          source: body.source === undefined ? undefined : body.source,
          campaignId: body.campaign_id === undefined ? undefined : body.campaign_id,
          nextStep: body.next_step === undefined ? undefined : body.next_step,
          nextStepDueDate: body.next_step_due_date === undefined ? undefined : body.next_step_due_date,
          tags: body.tags ?? undefined,
          customFields: body.custom_fields ?? undefined,
          notes: body.notes === undefined ? undefined : body.notes,
          updatedAt: new Date(),
        })
        .where(eq(deals.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Deal not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: deals.orgId }).from(deals).where(eq(deals.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "deal", "delete");
      const [deleted] = await db.delete(deals).where(eq(deals.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Deal not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
