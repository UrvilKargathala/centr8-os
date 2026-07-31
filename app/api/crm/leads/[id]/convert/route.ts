import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { convertLead, requireLeadConvertAccess, resolveOwnEmployeeId } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const result = await withOrgContext(userId, async (db) => {
      const [lead] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!lead) throw new ApiError(404, "Lead not found");
      await requireLeadConvertAccess(db, userId, lead.orgId);
      const employeeId = await resolveOwnEmployeeId(db, userId, lead.orgId);
      return convertLead(db, lead.orgId, employeeId, id, {
        createDeal: body.create_deal ?? true,
        dealName: body.deal_name ?? undefined,
        dealValue: body.deal_value ?? null,
      });
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
