import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { compensationRecords, employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireCompensationViewAccess } from "@/lib/api/employees";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// compensation:view_sensitive is owner/admin-only with no self/manager
// fallback (lib/api/employees.ts) — this check runs before any row is
// read, so hitting this route directly without the grant 403s regardless
// of what the UI would have hidden.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const rows = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;
      await requireCompensationViewAccess(db, userId, existing.orgId);
      return db
        .select()
        .from(compensationRecords)
        .where(eq(compensationRecords.employeeId, id))
        .orderBy(desc(compensationRecords.effectiveDate));
    });
    if (!rows) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.base_salary || !body.effective_date) {
      throw new ApiError(400, "base_salary and effective_date are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "compensation", "create");

      // Only one "active" (end_date null) record per employee at a time —
      // close out whichever one is currently open to the day before this
      // new record's effective_date, so history never overlaps.
      const [currentActive] = await db
        .select({ id: compensationRecords.id })
        .from(compensationRecords)
        .where(and(eq(compensationRecords.employeeId, id), isNull(compensationRecords.endDate)));
      if (currentActive) {
        const dayBefore = new Date(`${body.effective_date}T00:00:00Z`);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        await db
          .update(compensationRecords)
          .set({ endDate: dayBefore.toISOString().slice(0, 10) })
          .where(eq(compensationRecords.id, currentActive.id));
      }

      const [created] = await db
        .insert(compensationRecords)
        .values({
          orgId: existing.orgId,
          employeeId: id,
          baseSalary: body.base_salary,
          currency: body.currency ?? undefined,
          payFrequency: body.pay_frequency ?? undefined,
          effectiveDate: body.effective_date,
          endDate: body.end_date ?? null,
          bonus: body.bonus ?? null,
          benefits: body.benefits ?? null,
          deductions: body.deductions ?? null,
          reason: body.reason ?? null,
          notes: body.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      return created;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
