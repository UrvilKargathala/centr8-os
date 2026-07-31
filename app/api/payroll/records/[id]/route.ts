import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { payslipRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Adjusting deductions/notes before finalizing — only while still a draft.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(payslipRecords).where(eq(payslipRecords.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "compensation", "update");
      if (existing.status !== "draft") throw new ApiError(409, "Only a draft record can be edited");

      const deductions = body.total_deductions ?? existing.totalDeductions;
      const gross = body.gross_amount ?? existing.grossAmount;
      const net = Math.round((gross - deductions) * 100) / 100;

      const [updated] = await db
        .update(payslipRecords)
        .set({
          grossAmount: gross,
          totalDeductions: deductions,
          netAmount: net,
          notes: body.notes === undefined ? undefined : body.notes,
        })
        .where(eq(payslipRecords.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Payslip record not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
