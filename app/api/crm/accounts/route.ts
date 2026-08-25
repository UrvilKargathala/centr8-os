import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listAllAccounts } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const type = params.get("type");
    const status = params.get("status");
    const industry = params.get("industry");
    const ownerId = params.get("owner_id");
    const search = params.get("search");

    if (!type && !status && !industry && !ownerId && !search) {
      const data = await withOrgContext(userId, (db) => listAllAccounts(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "account", "read");
      const conditions = [eq(accounts.orgId, orgId)];
      if (type) conditions.push(eq(accounts.type, type as (typeof accounts.type.enumValues)[number]));
      if (status) conditions.push(eq(accounts.status, status as (typeof accounts.status.enumValues)[number]));
      if (industry) conditions.push(eq(accounts.industry, industry));
      if (ownerId) conditions.push(eq(accounts.ownerId, ownerId));
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(or(ilike(accounts.name, pattern), ilike(accounts.website, pattern))!);
      }
      return db.select().from(accounts).where(and(...conditions));
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

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "account", "create");
      return db
        .insert(accounts)
        .values({
          orgId: body.org_id,
          name: body.name,
          industry: body.industry ?? null,
          website: body.website ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          addressLine1: body.address_line1 ?? null,
          addressLine2: body.address_line2 ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          country: body.country ?? undefined,
          postalCode: body.postal_code ?? null,
          type: body.type ?? undefined,
          status: body.status ?? undefined,
          annualRevenue: body.annual_revenue ?? null,
          currency: body.currency ?? undefined,
          employeeCountRange: body.employee_count_range ?? null,
          ownerId: body.owner_id ?? null,
          parentAccountId: body.parent_account_id ?? null,
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
