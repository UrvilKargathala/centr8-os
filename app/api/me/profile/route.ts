import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { userPreferences } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Loads (or lazily inserts) the caller's user_preferences row for the given
// org. Everything the profile page shows lives on this row plus the user's
// Supabase auth record.
async function loadOrInit(userId: string, orgId: string) {
  return withOrgContext(userId, async (db) => {
    const existing = await db
      .select()
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), eq(userPreferences.orgId, orgId)))
      .limit(1);
    if (existing[0]) return existing[0];
    const [row] = await db
      .insert(userPreferences)
      .values({ userId, orgId })
      .returning();
    return row;
  });
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    const prefs = await loadOrInit(userId, orgId);

    // SSO detection: Supabase surfaces the provider(s) that produced this
    // session via user.app_metadata.providers. If there's anything other
    // than "email" (or nothing at all) we treat the email as SSO-managed.
    const providers: string[] = (user?.app_metadata?.providers as string[] | undefined) ?? [];
    const isSsoManaged = providers.length > 0 && providers.every((p) => p !== "email");

    return NextResponse.json({
      data: {
        email: user?.email ?? null,
        emailVerified: !!user?.email_confirmed_at,
        providers,
        isSsoManaged,
        preferences: prefs,
      },
    });
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
