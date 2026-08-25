import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getAccountDetail } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, (db) => getAccountDetail(db, userId, id));
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
