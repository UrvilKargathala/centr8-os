import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, okrs } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission } from "@/lib/api/permissions";
import { requireOkrCreateAccess, requireOkrViewAccess, resolveOwnEmployeeId } from "@/lib/api/reviews";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    const period = req.nextUrl.searchParams.get("period");

    const rows = await withOrgContext(userId, async (db) => {
      if (employeeId) {
        await requireOkrViewAccess(db, userId, orgId, employeeId);
        const conditions = [eq(okrs.orgId, orgId), eq(okrs.employeeId, employeeId)];
        if (period) conditions.push(eq(okrs.period, period));
        return db.select().from(okrs).where(and(...conditions));
      }

      if (await hasPermission(db, userId, orgId, "okr", "view_all")) {
        const conditions = [eq(okrs.orgId, orgId)];
        if (period) conditions.push(eq(okrs.period, period));
        return db.select().from(okrs).where(and(...conditions));
      }

      if (await hasPermission(db, userId, orgId, "okr", "view_team")) {
        const ownId = await resolveOwnEmployeeId(db, userId, orgId);
        const reports = ownId ? await db.select({ id: employees.id }).from(employees).where(eq(employees.managerId, ownId)) : [];
        const ids = [ownId, ...reports.map((r) => r.id)].filter((v): v is string => Boolean(v));
        if (ids.length === 0) return [];
        const conditions = [eq(okrs.orgId, orgId), or(...ids.map((id) => eq(okrs.employeeId, id)))!];
        if (period) conditions.push(eq(okrs.period, period));
        return db.select().from(okrs).where(and(...conditions));
      }

      await requireOkrViewAccess(db, userId, orgId, null); // will 403 unless view_own applies below
      const ownId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!ownId) return [];
      const conditions = [eq(okrs.orgId, orgId), eq(okrs.employeeId, ownId)];
      if (period) conditions.push(eq(okrs.period, period));
      return db.select().from(okrs).where(and(...conditions));
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
    if (!body.org_id || !body.objective || !body.period || (!body.employee_id && !body.team_name)) {
      throw new ApiError(400, "org_id, objective, period, and employee_id or team_name are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requireOkrCreateAccess(db, userId, body.org_id, body.employee_id ?? null);
      return db
        .insert(okrs)
        .values({
          orgId: body.org_id,
          employeeId: body.employee_id ?? null,
          teamName: body.team_name ?? null,
          cycleId: body.cycle_id ?? null,
          objective: body.objective,
          keyResults: body.key_results ?? [],
          period: body.period,
          status: body.status ?? undefined,
          createdBy: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
