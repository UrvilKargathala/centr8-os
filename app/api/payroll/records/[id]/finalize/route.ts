import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { payslipRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePayrollFinalizeAccess } from "@/lib/api/payroll";

type Params = { params: Promise<{ id: string }> };

// draft -> finalized only — cannot skip straight to paid, cannot
// re-finalize an already-finalized/paid record.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(payslipRecords).where(eq(payslipRecords.id, id));
      if (!existing) return undefined;
      await requirePayrollFinalizeAccess(db, userId, existing.orgId);
      if (existing.status !== "draft") throw new ApiError(409, "Only a draft record can be finalized");

      const [updated] = await db.update(payslipRecords).set({ status: "finalized" }).where(eq(payslipRecords.id, id)).returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Payslip record not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
