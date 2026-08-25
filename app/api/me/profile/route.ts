import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { userPreferences } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { assembleProfile, loadOrInitPreferences } from "@/lib/api/me";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const prefs = await withOrgContext(userId, (db) => loadOrInitPreferences(db, userId, orgId));

    return NextResponse.json({ data: assembleProfile(userData.user, prefs) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    const [row] = await withOrgContext(userId, async (db) => {
      // Ensure the row exists (INSERT ... ON CONFLICT DO UPDATE would work too
      // but drizzle's upsert helper here is fine — we already have loadOrInit).
      await db
        .insert(userPreferences)
        .values({ userId, orgId: body.org_id })
        .onConflictDoNothing({ target: [userPreferences.userId, userPreferences.orgId] });
      return db
        .update(userPreferences)
        .set({
          fullName: body.full_name === undefined ? undefined : body.full_name,
          jobTitle: body.job_title === undefined ? undefined : body.job_title,
          department: body.department === undefined ? undefined : body.department,
          phone: body.phone === undefined ? undefined : body.phone,
          avatarUrl: body.avatar_url === undefined ? undefined : body.avatar_url,
          timezone: body.timezone ?? undefined,
          language: body.language ?? undefined,
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
