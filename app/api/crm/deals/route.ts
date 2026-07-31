import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, ilike, lte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { dealStageHistory, deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId, STAGE_PROBABILITY } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const stage = params.get("stage");
    const ownerId = params.get("owner_id");
    const accountId = params.get("account_id");
    const valueMin = params.get("value_min");
    const valueMax = params.get("value_max");
    const closeBefore = params.get("expected_close_before");
    const closeAfter = params.get("expected_close_after");
    const source = params.get("source");
    const search = params.get("search");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "deal", "read");
      const conditions = [eq(deals.orgId, orgId)];
      if (stage) conditions.push(eq(deals.stage, stage as (typeof deals.stage.enumValues)[number]));
      if (ownerId) conditions.push(eq(deals.ownerId, ownerId));
      if (accountId) conditions.push(eq(deals.accountId, accountId));
      if (valueMin) conditions.push(gte(deals.value, Number(valueMin)));
      if (valueMax) conditions.push(lte(deals.value, Number(valueMax)));
      if (closeBefore) conditions.push(lte(deals.expectedCloseDate, closeBefore));
      if (closeAfter) conditions.push(gte(deals.expectedCloseDate, closeAfter));
      if (source) conditions.push(eq(deals.source, source));
      if (search) conditions.push(ilike(deals.name, `%${search}%`));
      return db.select().from(deals).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.name) throw new ApiError(400, "org_id and name are required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "deal", "create");
      const employeeId = await resolveOwnEmployeeId(db, userId, body.org_id);
      const stage = body.stage ?? "prospecting";

      const [deal] = await db
        .insert(deals)
        .values({
          orgId: body.org_id,
          name: body.name,
          accountId: body.account_id ?? null,
          primaryContactId: body.primary_contact_id ?? null,
          ownerId: body.owner_id ?? null,
          stage,
          probability: body.probability ?? STAGE_PROBABILITY[stage] ?? 10,
          value: body.value ?? null,
          currency: body.currency ?? undefined,
          recurringRevenue: body.recurring_revenue ?? null,
          recurringFrequency: body.recurring_frequency ?? null,
          expectedCloseDate: body.expected_close_date ?? null,
          source: body.source ?? null,
          campaignId: body.campaign_id ?? null,
          nextStep: body.next_step ?? null,
          nextStepDueDate: body.next_step_due_date ?? null,
          tags: body.tags ?? [],
          customFields: body.custom_fields ?? {},
          notes: body.notes ?? null,
          createdBy: userId,
        })
        .returning();

      await db.insert(dealStageHistory).values({
        orgId: body.org_id,
        dealId: deal.id,
        fromStage: null,
        toStage: stage,
        changedBy: employeeId,
      });

      return deal;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
