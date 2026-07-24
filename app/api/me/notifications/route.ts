import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { userPreferences } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    const [row] = await withOrgContext(userId, async (db) => {
      await db
        .insert(userPreferences)
        .values({ userId, orgId: body.org_id })
        .onConflictDoNothing({ target: [userPreferences.userId, userPreferences.orgId] });
      return db
        .update(userPreferences)
        .set({
          notifyEmail: body.notify_email ?? undefined,
          notifyInapp: body.notify_inapp ?? undefined,
          notifyDigest: body.notify_digest ?? undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(userPreferences.userId, userId), eq(userPreferences.orgId, body.org_id)))
        .returning();
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
