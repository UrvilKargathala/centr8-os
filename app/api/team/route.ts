import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { people } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    const q = req.nextUrl.searchParams.get("q");
    const role = req.nextUrl.searchParams.get("role");
    // "active" defaults to "true" — soft-deleted people are hidden unless
    // explicitly requested (?active=all or ?active=false).
    const active = req.nextUrl.searchParams.get("active") ?? "true";
    if (!orgId) throw new ApiError(400, "org_id is required");

    const department = req.nextUrl.searchParams.get("department");

    const conditions = [eq(people.orgId, orgId)];
    if (active === "true") conditions.push(eq(people.isActive, true));
    else if (active === "false") conditions.push(eq(people.isActive, false));
    if (q) {
      conditions.push(
        or(
          ilike(people.fullName, `%${q}%`),
          ilike(people.workEmail, `%${q}%`),
          ilike(people.jobTitle, `%${q}%`),
        )!,
      );
    }
    if (role) {
      conditions.push(sql`${people.roles}::text ilike ${`%"${role}"%`}`);
    }
    if (department) {
      conditions.push(ilike(people.department, department));
    }

    const rows = await withOrgContext(userId, (db) =>
      db.select().from(people).where(and(...conditions)).orderBy(people.fullName),
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.full_name || !body.work_email) {
      throw new ApiError(400, "org_id, full_name and work_email are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.work_email)) {
      throw new ApiError(400, "work_email is not a valid email");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "team", "create");
      return db
        .insert(people)
        .values({
          orgId: body.org_id,
          fullName: body.full_name,
          workEmail: body.work_email.toLowerCase(),
          jobTitle: body.job_title ?? null,
          avatarUrl: body.avatar_url ?? null,
          department: body.department ?? null,
          availableHoursPerWeek: body.available_hours_per_week ?? 40,
          roles: Array.isArray(body.roles) ? body.roles : [],
          skills: Array.isArray(body.skills) ? body.skills : [],
          isActive: body.is_active ?? true,
          createdByUserId: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err: unknown) {
    // Postgres unique-violation on (org_id, work_email) — surface as 409.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      return handleApiError(new ApiError(409, "A person with that work email already exists in this organization"));
    }
    return handleApiError(err);
  }
}
