import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leavePolicies } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireLeaveConfigureAccess } from "@/lib/api/leave";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "view_own");
      return db.select().from(leavePolicies).where(eq(leavePolicies.orgId, orgId));
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
    if (!body.org_id || !body.leave_type_id || !body.name || body.annual_allotment_days == null || !body.effective_from) {
      throw new ApiError(400, "org_id, leave_type_id, name, annual_allotment_days, and effective_from are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requireLeaveConfigureAccess(db, userId, body.org_id);
      return db
        .insert(leavePolicies)
        .values({
          orgId: body.org_id,
          leaveTypeId: body.leave_type_id,
          name: body.name,
          appliesTo: body.applies_to ?? undefined,
          annualAllotmentDays: body.annual_allotment_days,
          accrualMethod: body.accrual_method ?? undefined,
          carryForwardMaxDays: body.carry_forward_max_days ?? undefined,
          effectiveFrom: body.effective_from,
          isActive: body.is_active ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
