import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listAllLeads } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const status = params.get("status");
    const source = params.get("source");
    const ownerId = params.get("owner_id");
    const scoreMin = params.get("score_min");
    const scoreMax = params.get("score_max");
    const search = params.get("search");

    if (!status && !source && !ownerId && !scoreMin && !scoreMax && !search) {
      const data = await withOrgContext(userId, (db) => listAllLeads(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "lead", "read");
      const conditions = [eq(leads.orgId, orgId)];
      if (status) conditions.push(eq(leads.status, status as (typeof leads.status.enumValues)[number]));
      if (source) conditions.push(eq(leads.source, source));
      if (ownerId) conditions.push(eq(leads.ownerId, ownerId));
      if (scoreMin) conditions.push(gte(leads.score, Number(scoreMin)));
      if (scoreMax) conditions.push(lte(leads.score, Number(scoreMax)));
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(or(ilike(leads.fullName, pattern), ilike(leads.email, pattern), ilike(leads.companyName, pattern))!);
      }
      return db.select().from(leads).where(and(...conditions));
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
    if (!body.org_id || !body.full_name) throw new ApiError(400, "org_id and full_name are required");

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "lead", "create");
      return db
        .insert(leads)
        .values({
          orgId: body.org_id,
          fullName: body.full_name,
          companyName: body.company_name ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          jobTitle: body.job_title ?? null,
          source: body.source ?? undefined,
          sourceDetail: body.source_detail ?? null,
          status: body.status ?? undefined,
          score: body.score ?? null,
          scoreReasoning: body.score_reasoning ?? null,
          ownerId: body.owner_id ?? null,
          campaignId: body.campaign_id ?? null,
          tags: body.tags ?? [],
          customFields: body.custom_fields ?? {},
          notes: body.notes ?? null,
          createdBy: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
