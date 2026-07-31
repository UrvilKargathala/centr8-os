import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { reviewCycles } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getOrCreateReview, resolveOwnEmployeeId } from "@/lib/api/reviews";

// Current user's review across every non-draft cycle they're covered by —
// lazily creates the row on first read (see getOrCreateReview), so a new
// cycle doesn't need a separate "instantiate reviews for everyone" step.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "review", "view_own");
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) return [];

      const cycles = await db.select().from(reviewCycles).where(eq(reviewCycles.orgId, orgId));
      const activeCycles = cycles.filter((c) => c.status !== "draft");
      const reviews = await Promise.all(activeCycles.map((c) => getOrCreateReview(db, orgId, c.id, employeeId)));
      return activeCycles.map((cycle, i) => ({ cycle, review: reviews[i] }));
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
