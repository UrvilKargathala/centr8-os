import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getEmployeeDetail } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, (db) => getEmployeeDetail(db, userId, id));
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

// employment_status -> 'terminated' is gated by "employee:terminate"
// (distinct from ordinary field edits), same reasoning as milestone
// approval getting its own "approve" action rather than riding on
// "update" — terminating someone is a materially different action from
// editing their job title.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    const terminating = body.employment_status === "terminated";

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ orgId: employees.orgId, userId: employees.userId })
        .from(employees)
        .where(eq(employees.id, id));
      if (!existing) return undefined;

      const editingOtherFields = Object.keys(body).some((k) => k !== "user_id");
      if (editingOtherFields) {
        await requirePermission(db, userId, existing.orgId, "employee", terminating ? "terminate" : "update");
      }

      // Self-service linking — an unlinked (userId null) record can be
      // claimed by the caller as "this is me," so attendance/leave
      // self-service has something to act on without an admin needing to
      // know anyone's raw auth user id. Once linked, only employee:update
      // (checked above) can move it, not another self-claim.
      let userIdUpdate: string | undefined;
      if (body.user_id !== undefined) {
        if (!editingOtherFields) {
          if (existing.userId !== null) throw new ApiError(409, "This employee record is already linked to an account");
          if (body.user_id !== userId) throw new ApiError(403, "You can only link your own account");
        }
        userIdUpdate = body.user_id;
      }

      const [updated] = await db
        .update(employees)
        .set({
          userId: userIdUpdate,
          fullName: body.full_name ?? undefined,
          jobTitle: body.job_title === undefined ? undefined : body.job_title,
          departmentId: body.department_id === undefined ? undefined : body.department_id,
          teamId: body.team_id === undefined ? undefined : body.team_id,
          managerId: body.manager_id === undefined ? undefined : body.manager_id,
          employmentStatus: body.employment_status ?? undefined,
          startDate: body.start_date === undefined ? undefined : body.start_date,
          endDate: body.end_date === undefined ? undefined : body.end_date,
          email: body.email === undefined ? undefined : body.email,
          phone: body.phone === undefined ? undefined : body.phone,
          dateOfBirth: body.date_of_birth === undefined ? undefined : body.date_of_birth,
          gender: body.gender === undefined ? undefined : body.gender,
          maritalStatus: body.marital_status === undefined ? undefined : body.marital_status,
          nationality: body.nationality === undefined ? undefined : body.nationality,
          address: body.address === undefined ? undefined : body.address,
          city: body.city === undefined ? undefined : body.city,
          state: body.state === undefined ? undefined : body.state,
          zipCode: body.zip_code === undefined ? undefined : body.zip_code,
          // HR Batch 1 fields
          employeeCode: body.employee_code === undefined ? undefined : body.employee_code,
          personalEmail: body.personal_email === undefined ? undefined : body.personal_email,
          country: body.country === undefined ? undefined : body.country,
          location: body.location === undefined ? undefined : body.location,
          employmentType: body.employment_type ?? undefined,
          availableHoursPerWeek: body.available_hours_per_week === undefined ? undefined : body.available_hours_per_week,
          roles: body.roles === undefined ? undefined : body.roles,
          skills: body.skills === undefined ? undefined : body.skills,
          costRateHourly: body.cost_rate_hourly === undefined ? undefined : body.cost_rate_hourly,
          currency: body.currency === undefined ? undefined : body.currency,
          notes: body.notes === undefined ? undefined : body.notes,
        })
        .where(eq(employees.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "employee", "delete");

      const [deleted] = await db.delete(employees).where(eq(employees.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
