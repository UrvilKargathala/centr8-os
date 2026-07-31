import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { templates } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Onboarding templates live in the generic `templates` table (org_id null
// = built-in default, visible to every org — same pattern as permissions'
// org_id-null rows). This route filters to structure.applies_to_role !=
// undefined implicitly by convention; there's no separate onboarding_
// templates table, so every read here is just "templates this org can see."
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "onboarding", "configure");
      return db
        .select()
        .from(templates)
        .where(or(isNull(templates.orgId), eq(templates.orgId, orgId)));
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
    if (!body.org_id || !body.name || !body.structure) {
      throw new ApiError(400, "org_id, name and structure are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "onboarding", "configure");
      return db
        .insert(templates)
        .values({ orgId: body.org_id, name: body.name, structure: body.structure })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
