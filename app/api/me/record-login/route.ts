import { NextResponse } from "next/server";
import { auditLog } from "@/db/schema";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getCurrentOrg } from "@/lib/org/currentOrg";

// Sign-in itself happens client-side (supabase-js's signInWithPassword,
// app/login/page.tsx) — there's no server auth callback to hook in this
// app, so the login form calls this once it has a session, to get a real
// audit_log row instead of the security log staying permanently empty for
// auth events (see app/api/me/security-log/route.ts's TODO). audit_log
// requires an orgId (not user-scoped), so this uses the caller's default
// org (same cookie/first-org resolution every other page uses) — a login
// isn't naturally scoped to one org for a multi-org user, but recording it
// against their default org beats not recording it at all.
export async function POST() {
  try {
    const userId = await requireUserId();
    const { orgId } = await getCurrentOrg(userId);
    if (!orgId) throw new ApiError(400, "No organization to record this event against");

    await withOrgContext(userId, (db) =>
      db.insert(auditLog).values({
        orgId,
        actorUserId: userId,
        actorType: "human",
        action: "user_login",
        targetType: "user",
        targetId: userId,
        metadata: {},
      }),
    );

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
