import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { people } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

async function loadPerson(userId: string, id: string) {
  const row = await withOrgContext(userId, (db) =>
    db.select().from(people).where(eq(people.id, id)).limit(1),
  );
  if (!row[0]) throw new ApiError(404, "Person not found");
  return row[0];
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const row = await loadPerson(userId, id);
    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const body = await req.json();
    const existing = await loadPerson(userId, id);

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, existing.orgId, "team", "update");
      return db
        .update(people)
        .set({
          fullName: body.full_name ?? undefined,
          workEmail: body.work_email ? body.work_email.toLowerCase() : undefined,
          jobTitle: body.job_title === undefined ? undefined : body.job_title,
          avatarUrl: body.avatar_url === undefined ? undefined : body.avatar_url,
          department: body.department === undefined ? undefined : body.department,
          availableHoursPerWeek: body.available_hours_per_week ?? undefined,
          roles: Array.isArray(body.roles) ? body.roles : undefined,
          skills: Array.isArray(body.skills) ? body.skills : undefined,
          isActive: body.is_active === undefined ? undefined : body.is_active,
          updatedAt: new Date(),
        })
        .where(eq(people.id, id))
        .returning();
    });

    return NextResponse.json({ data: row });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      return handleApiError(new ApiError(409, "A person with that work email already exists in this organization"));
    }
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const existing = await loadPerson(userId, id);

    // Soft-delete: they may be referenced by projects. Same reasoning as
    // org_memberships.deactivatedAt and employees.employment_status.
    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, existing.orgId, "team", "delete");
      await db.update(people).set({ isActive: false, updatedAt: new Date() }).where(eq(people.id, id));
    });

    return NextResponse.json({ data: { id, is_active: false } });
  } catch (err) {
    return handleApiError(err);
  }
}
