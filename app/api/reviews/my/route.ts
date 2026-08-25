import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getMyReviews } from "@/lib/api/reviews";

// Current user's review across every non-draft cycle they're covered by —
// lazily creates the row on first read (see getOrCreateReview), so a new
// cycle doesn't need a separate "instantiate reviews for everyone" step.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, (db) => getMyReviews(db, userId, orgId));
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
