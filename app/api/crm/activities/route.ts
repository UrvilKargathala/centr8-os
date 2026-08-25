import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { withOrgContext, type OrgScopedDb } from "@/db/withOrgContext";
import { accounts, activities, contacts, deals, leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listAllActivities } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const relatedType = params.get("related_type");
    const relatedId = params.get("related_id");
    const activityType = params.get("activity_type");
    const performedBy = params.get("performed_by");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");

    if (!relatedType && !relatedId && !activityType && !performedBy && !dateFrom && !dateTo) {
      const data = await withOrgContext(userId, (db) => listAllActivities(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "activity", "read");
      const conditions = [eq(activities.orgId, orgId)];
      if (relatedType) conditions.push(eq(activities.relatedType, relatedType as (typeof activities.relatedType.enumValues)[number]));
      if (relatedId) conditions.push(eq(activities.relatedId, relatedId));
      if (activityType) conditions.push(eq(activities.type, activityType as (typeof activities.type.enumValues)[number]));
      if (performedBy) conditions.push(eq(activities.performedBy, performedBy));
      if (dateFrom) conditions.push(gte(activities.activityDate, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(activities.activityDate, new Date(dateTo)));
      return db.select().from(activities).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

async function relatedRecordExists(
  db: OrgScopedDb,
  orgId: string,
  relatedType: string,
  relatedId: string,
): Promise<boolean> {
  if (relatedType === "lead") {
    const [row] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, relatedId), eq(leads.orgId, orgId)));
    return Boolean(row);
  }
  if (relatedType === "account") {
    const [row] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, relatedId), eq(accounts.orgId, orgId)));
    return Boolean(row);
  }
  if (relatedType === "contact") {
    const [row] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, relatedId), eq(contacts.orgId, orgId)));
    return Boolean(row);
  }
  if (relatedType === "deal") {
    const [row] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.id, relatedId), eq(deals.orgId, orgId)));
    return Boolean(row);
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.related_type || !body.related_id || !body.activity_type) {
      throw new ApiError(400, "org_id, related_type, related_id, and activity_type are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "activity", "create");
      const exists = await relatedRecordExists(db, body.org_id, body.related_type, body.related_id);
      if (!exists) throw new ApiError(400, "related_id does not exist for the given related_type");

      return db
        .insert(activities)
        .values({
          orgId: body.org_id,
          relatedType: body.related_type,
          relatedId: body.related_id,
          type: body.activity_type,
          subject: body.subject ?? null,
          description: body.description ?? null,
          outcome: body.outcome ?? null,
          activityDate: body.activity_date ? new Date(body.activity_date) : new Date(),
          durationMinutes: body.duration_minutes ?? null,
          performedBy: body.performed_by ?? null,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
