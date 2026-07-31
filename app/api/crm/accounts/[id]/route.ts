import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts, activities, contacts, deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
      if (!account) return undefined;
      await requirePermission(db, userId, account.orgId, "account", "read");
      const [linkedContacts, accountDeals] = await Promise.all([
        db.select().from(contacts).where(eq(contacts.accountId, id)),
        db.select().from(deals).where(eq(deals.accountId, id)),
      ]);

      // Rolls up activities logged directly on the account AND activities
      // logged on any of the account's deals (joined through
      // deals.accountId, since activities has no direct account link for
      // deal-related entries) — a common CRM expectation: "show me
      // everything that happened with this account."
      const dealIds = accountDeals.map((d) => d.id);
      const relatedIds = [id, ...dealIds];
      const timeline = await db
        .select()
        .from(activities)
        .where(inArray(activities.relatedId, relatedIds))
        .orderBy(desc(activities.activityDate));
      const relevantActivities = timeline.filter(
        (a) => (a.relatedType === "account" && a.relatedId === id) || (a.relatedType === "deal" && dealIds.includes(a.relatedId)),
      );

      return { account, contacts: linkedContacts, deals: accountDeals, activities: relevantActivities };
    });
    if (!result) throw new ApiError(404, "Account not found");

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
      const [existing] = await db.select({ orgId: accounts.orgId }).from(accounts).where(eq(accounts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "account", "update");

      const [updated] = await db
        .update(accounts)
        .set({
          name: body.name ?? undefined,
          industry: body.industry === undefined ? undefined : body.industry,
          website: body.website === undefined ? undefined : body.website,
          phone: body.phone === undefined ? undefined : body.phone,
          email: body.email === undefined ? undefined : body.email,
          addressLine1: body.address_line1 === undefined ? undefined : body.address_line1,
          addressLine2: body.address_line2 === undefined ? undefined : body.address_line2,
          city: body.city === undefined ? undefined : body.city,
          state: body.state === undefined ? undefined : body.state,
          country: body.country ?? undefined,
          postalCode: body.postal_code === undefined ? undefined : body.postal_code,
          type: body.type ?? undefined,
          status: body.status ?? undefined,
          annualRevenue: body.annual_revenue === undefined ? undefined : body.annual_revenue,
          currency: body.currency ?? undefined,
          employeeCountRange: body.employee_count_range === undefined ? undefined : body.employee_count_range,
          parentAccountId: body.parent_account_id === undefined ? undefined : body.parent_account_id,
          tags: body.tags ?? undefined,
          customFields: body.custom_fields ?? undefined,
          notes: body.notes === undefined ? undefined : body.notes,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Account not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
