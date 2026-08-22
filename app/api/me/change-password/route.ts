import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

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

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
