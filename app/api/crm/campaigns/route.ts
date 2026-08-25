import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, ilike, lte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { campaigns } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listAllCampaigns, requireCampaignCreateAccess } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const status = params.get("status");
    const type = params.get("type");
    const ownerId = params.get("owner_id");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    const search = params.get("search");

    if (!status && !type && !ownerId && !dateFrom && !dateTo && !search) {
      const data = await withOrgContext(userId, (db) => listAllCampaigns(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "campaign", "read");
      const conditions = [eq(campaigns.orgId, orgId)];
      if (status) conditions.push(eq(campaigns.status, status as (typeof campaigns.status.enumValues)[number]));
      if (type) conditions.push(eq(campaigns.type, type));
      if (ownerId) conditions.push(eq(campaigns.ownerId, ownerId));
      if (dateFrom) conditions.push(gte(campaigns.startDate, dateFrom));
      if (dateTo) conditions.push(lte(campaigns.endDate, dateTo));
      if (search) conditions.push(ilike(campaigns.name, `%${search}%`));
      return db.select().from(campaigns).where(and(...conditions));
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
      await requireCampaignCreateAccess(db, userId, body.org_id);
      const [created] = await db
        .insert(campaigns)
        .values({
          orgId: body.org_id,
          name: body.name,
          type: body.type ?? undefined,
          status: body.status ?? undefined,
          description: body.description ?? null,
          startDate: body.start_date ?? null,
          endDate: body.end_date ?? null,
          budgetAllocated: body.budget_allocated ?? null,
          budgetSpent: body.budget_spent ?? undefined,
          currency: body.currency ?? undefined,
          targetAudience: body.target_audience ?? null,
          channel: body.channel ?? null,
          ownerId: body.owner_id ?? null,
          tags: body.tags ?? [],
          notes: body.notes ?? null,
          createdBy: userId,
        })
        .returning();
      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
