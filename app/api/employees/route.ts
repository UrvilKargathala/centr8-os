import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission, requirePermission } from "@/lib/api/permissions";
import { trimEmployeeFields } from "@/lib/api/employees";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    // "mine" — used to resolve the caller's own employee record for
    // self-service actions (attendance check-in, leave requests), so the
    // UI doesn't need to already know its own employee id.
    const mine = req.nextUrl.searchParams.get("mine") === "true";

    const { rows, canViewFull } = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "employee", "read");
      const canViewFull = await hasPermission(db, userId, orgId, "employee", "view_full");
      const rows = await db
        .select()
        .from(employees)
        .where(mine ? and(eq(employees.orgId, orgId), eq(employees.userId, userId)) : eq(employees.orgId, orgId));
      return { rows, canViewFull };
    });

    return NextResponse.json({ data: rows.map((r) => trimEmployeeFields(r, canViewFull)) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.full_name) {
      throw new ApiError(400, "org_id and full_name are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "employee", "create");
      return db
        .insert(employees)
        .values({
          orgId: body.org_id,
          userId: body.user_id ?? null,
          fullName: body.full_name,
          jobTitle: body.job_title ?? null,
          departmentId: body.department_id ?? null,
          teamId: body.team_id ?? null,
          managerId: body.manager_id ?? null,
          employmentStatus: body.employment_status ?? undefined,
          startDate: body.start_date ?? null,
          endDate: body.end_date ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          dateOfBirth: body.date_of_birth ?? null,
          gender: body.gender ?? null,
          maritalStatus: body.marital_status ?? null,
          nationality: body.nationality ?? null,
          address: body.address ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          zipCode: body.zip_code ?? null,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
