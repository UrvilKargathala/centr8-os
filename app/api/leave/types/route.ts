import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveTypes } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireLeaveConfigureAccess } from "@/lib/api/leave";

// Every employee needs to see leave types to file a request — reading
// isn't gated behind leave:configure, same reasoning the old
// leave-policies GET route used ("every org member needs to see policy
// names... isn't gated behind leave:configure").
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "view_own");
      return db.select().from(leaveTypes).where(eq(leaveTypes.orgId, orgId));
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
      await requireLeaveConfigureAccess(db, userId, body.org_id);
      return db
        .insert(leaveTypes)
        .values({
          orgId: body.org_id,
          name: body.name,
          description: body.description ?? null,
          color: body.color ?? undefined,
          requiresApproval: body.requires_approval ?? undefined,
          isPaid: body.is_paid ?? undefined,
          maxConsecutiveDays: body.max_consecutive_days ?? null,
          isActive: body.is_active ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
