import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { templates } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Only org-scoped templates (org_id set to the caller's org) are editable
// here — the 3 seeded defaults (org_id null, shared across every org) are
// read-only via this route so one org can't mutate every org's defaults.
// An org wanting to customize a default should clone it into a new
// org-scoped row instead (POST /api/onboarding/templates).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(templates).where(eq(templates.id, id));
      if (!existing) return undefined;
      if (!existing.orgId) throw new ApiError(403, "Built-in templates can't be edited directly — clone it instead");
      await requirePermission(db, userId, existing.orgId, "onboarding", "configure");

      const [updated] = await db
        .update(templates)
        .set({
          name: body.name ?? undefined,
          structure: body.structure ?? undefined,
        })
        .where(eq(templates.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Template not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
