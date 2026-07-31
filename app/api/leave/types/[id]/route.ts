import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveTypes } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireLeaveConfigureAccess } from "@/lib/api/leave";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: leaveTypes.orgId }).from(leaveTypes).where(eq(leaveTypes.id, id));
      if (!existing) return undefined;
      await requireLeaveConfigureAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(leaveTypes)
        .set({
          name: body.name ?? undefined,
          description: body.description === undefined ? undefined : body.description,
          color: body.color ?? undefined,
          requiresApproval: body.requires_approval ?? undefined,
          isPaid: body.is_paid ?? undefined,
          maxConsecutiveDays: body.max_consecutive_days === undefined ? undefined : body.max_consecutive_days,
          isActive: body.is_active ?? undefined,
        })
        .where(eq(leaveTypes.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Leave type not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
