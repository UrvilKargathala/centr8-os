import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { contacts } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const accountId = params.get("account_id");
    const ownerId = params.get("owner_id");
    const isDecisionMaker = params.get("is_decision_maker");
    const search = params.get("search");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "contact", "read");
      const conditions = [eq(contacts.orgId, orgId)];
      if (accountId) conditions.push(eq(contacts.accountId, accountId));
      if (ownerId) conditions.push(eq(contacts.ownerId, ownerId));
      if (isDecisionMaker) conditions.push(eq(contacts.isDecisionMaker, isDecisionMaker === "true"));
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(or(ilike(contacts.fullName, pattern), ilike(contacts.email, pattern), ilike(contacts.phone, pattern))!);
      }
      return db.select().from(contacts).where(and(...conditions));
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
      await requirePermission(db, userId, body.org_id, "contact", "create");
      return db
        .insert(contacts)
        .values({
          orgId: body.org_id,
          accountId: body.account_id ?? null,
          fullName: body.full_name,
          email: body.email ?? null,
          phone: body.phone ?? null,
          mobile: body.mobile ?? null,
          jobTitle: body.job_title ?? null,
          department: body.department ?? null,
          isPrimaryContact: body.is_primary_contact ?? undefined,
          isDecisionMaker: body.is_decision_maker ?? undefined,
          mailingAddress: body.mailing_address ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          country: body.country ?? undefined,
          ownerId: body.owner_id ?? null,
          source: body.source ?? "manual",
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
