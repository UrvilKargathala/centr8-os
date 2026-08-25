import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/db/schema";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/currentOrg";

export async function POST(req: NextRequest) {
  try {
    const { current_password, new_password } = await req.json();
    if (!new_password || new_password.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters");
    }
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) throw new ApiError(401, "Not authenticated");

    if (current_password) {
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: current_password,
      });
      if (reAuthError) throw new ApiError(400, "Current password is incorrect");
    }

    const { error } = await supabase.auth.updateUser({ password: new_password });
    if (error) throw new ApiError(400, error.message);

    const { orgId } = await getCurrentOrg(userData.user.id);
    if (orgId) {
      await withOrgContext(userData.user.id, (db) =>
        db.insert(auditLog).values({
          orgId,
          actorUserId: userData.user.id,
          actorType: "human",
          action: "user_password_changed",
          targetType: "user",
          targetId: userData.user.id,
          metadata: {},
        }),
      ).catch(() => {});
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
