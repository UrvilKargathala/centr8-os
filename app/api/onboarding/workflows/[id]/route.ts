import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { onboardingWorkflows } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(onboardingWorkflows).where(eq(onboardingWorkflows.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "employee", "read");
      return existing;
    });
    if (!row) throw new ApiError(404, "Onboarding workflow not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
