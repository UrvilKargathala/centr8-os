import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { payslipRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePayrollMarkPaidAccess } from "@/lib/api/payroll";

type Params = { params: Promise<{ id: string }> };

// finalized -> paid only — cannot mark a draft as paid, skipping the
// finalize step (status transitions are strictly draft -> finalized -> paid).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(payslipRecords).where(eq(payslipRecords.id, id));
      if (!existing) return undefined;
      await requirePayrollMarkPaidAccess(db, userId, existing.orgId);
      if (existing.status !== "finalized") throw new ApiError(409, "Only a finalized record can be marked paid");

      const [updated] = await db.update(payslipRecords).set({ status: "paid", paidAt: new Date() }).where(eq(payslipRecords.id, id)).returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Payslip record not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
