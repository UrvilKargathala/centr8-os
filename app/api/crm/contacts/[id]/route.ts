import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts, activities, contacts } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
      if (!contact) return undefined;
      await requirePermission(db, userId, contact.orgId, "contact", "read");
      const [account, timeline] = await Promise.all([
        contact.accountId ? db.select().from(accounts).where(eq(accounts.id, contact.accountId)).then((r) => r[0] ?? null) : Promise.resolve(null),
        db.select().from(activities).where(eq(activities.relatedId, id)).orderBy(desc(activities.activityDate)),
      ]);
      return { contact, account, activities: timeline.filter((a) => a.relatedType === "contact") };
    });
    if (!result) throw new ApiError(404, "Contact not found");

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
      const [existing] = await db.select({ orgId: contacts.orgId }).from(contacts).where(eq(contacts.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "contact", "update");

      const [updated] = await db
        .update(contacts)
        .set({
          accountId: body.account_id === undefined ? undefined : body.account_id,
          fullName: body.full_name ?? undefined,
          email: body.email === undefined ? undefined : body.email,
          phone: body.phone === undefined ? undefined : body.phone,
          mobile: body.mobile === undefined ? undefined : body.mobile,
          jobTitle: body.job_title === undefined ? undefined : body.job_title,
          department: body.department === undefined ? undefined : body.department,
          isPrimaryContact: body.is_primary_contact === undefined ? undefined : body.is_primary_contact,
          isDecisionMaker: body.is_decision_maker === undefined ? undefined : body.is_decision_maker,
          mailingAddress: body.mailing_address === undefined ? undefined : body.mailing_address,
          city: body.city === undefined ? undefined : body.city,
          state: body.state === undefined ? undefined : body.state,
          country: body.country ?? undefined,
          tags: body.tags ?? undefined,
          customFields: body.custom_fields ?? undefined,
          notes: body.notes === undefined ? undefined : body.notes,
          lastContactedAt: body.last_contacted_at === undefined ? undefined : body.last_contacted_at ? new Date(body.last_contacted_at) : null,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Contact not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
