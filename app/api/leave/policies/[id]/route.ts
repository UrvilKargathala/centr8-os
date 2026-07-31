import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leavePolicies } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireLeaveConfigureAccess } from "@/lib/api/leave";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: leavePolicies.orgId }).from(leavePolicies).where(eq(leavePolicies.id, id));
      if (!existing) return undefined;
      await requireLeaveConfigureAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(leavePolicies)
        .set({
          name: body.name ?? undefined,
          appliesTo: body.applies_to ?? undefined,
          annualAllotmentDays: body.annual_allotment_days ?? undefined,
          accrualMethod: body.accrual_method ?? undefined,
          carryForwardMaxDays: body.carry_forward_max_days ?? undefined,
          effectiveFrom: body.effective_from ?? undefined,
          isActive: body.is_active ?? undefined,
        })
        .where(eq(leavePolicies.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Leave policy not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
