import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { activities, leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [lead] = await db.select().from(leads).where(eq(leads.id, id));
      if (!lead) return undefined;
      await requirePermission(db, userId, lead.orgId, "lead", "read");
      const timeline = await db
        .select()
        .from(activities)
        .where(eq(activities.relatedId, id))
        .orderBy(desc(activities.activityDate));
      return { lead, activities: timeline.filter((a) => a.relatedType === "lead") };
    });
    if (!result) throw new ApiError(404, "Lead not found");

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
      const [existing] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "lead", "update");

      const [updated] = await db
        .update(leads)
        .set({
          fullName: body.full_name ?? undefined,
          companyName: body.company_name === undefined ? undefined : body.company_name,
          email: body.email === undefined ? undefined : body.email,
          phone: body.phone === undefined ? undefined : body.phone,
          jobTitle: body.job_title === undefined ? undefined : body.job_title,
          source: body.source ?? undefined,
          sourceDetail: body.source_detail === undefined ? undefined : body.source_detail,
          status: body.status ?? undefined,
          score: body.score === undefined ? undefined : body.score,
          scoreReasoning: body.score_reasoning === undefined ? undefined : body.score_reasoning,
          lostReason: body.lost_reason === undefined ? undefined : body.lost_reason,
          tags: body.tags ?? undefined,
          customFields: body.custom_fields ?? undefined,
          notes: body.notes === undefined ? undefined : body.notes,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Lead not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

// Soft delete — marks the lead lost rather than removing the row.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "lead", "delete");

      const [updated] = await db
        .update(leads)
        .set({ status: "lost", lostReason: body.lost_reason ?? null, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Lead not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
