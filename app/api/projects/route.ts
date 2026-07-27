import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { projects, projectMembers } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    const portfolioId = req.nextUrl.searchParams.get("portfolio_id");

    const conditions = [
      orgId ? eq(projects.orgId, orgId) : undefined,
      portfolioId ? eq(projects.portfolioId, portfolioId) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await withOrgContext(userId, (db) =>
      conditions.length ? db.select().from(projects).where(and(...conditions)) : db.select().from(projects),
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

    if (!body.org_id || !body.name) {
      throw new ApiError(400, "org_id and name are required");
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawMembers: { person_id?: string; role?: string; hours_per_week?: number; access?: string; is_lead?: boolean }[] =
      Array.isArray(body.members) ? body.members : [];
    // Filter down to real people rows (synthetic AI-only ids from the wizard
    // are skipped rather than persisted with a fake FK).
    const memberInputs = rawMembers.filter((m) => m.person_id && uuidRe.test(m.person_id));

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "project", "create");
      const [created] = await db
        .insert(projects)
        .values({
          orgId: body.org_id,
          portfolioId: body.portfolio_id ?? null,
          name: body.name,
          status: body.status ?? undefined,
          startDate: body.start_date ?? null,
          endDate: body.end_date ?? null,
        })
        .returning();

      if (memberInputs.length > 0) {
        await db.insert(projectMembers).values(
          memberInputs.map((m) => ({
            projectId: created.id,
            personId: m.person_id!,
            orgId: body.org_id,
            role: m.role ?? null,
            hoursPerWeek: m.hours_per_week ?? null,
            access: m.access ?? "Editor",
            isLead: !!m.is_lead,
          })),
        );
      }

      return [created];
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
