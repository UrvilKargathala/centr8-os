import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { new_password } = await req.json();
    if (!new_password || new_password.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters");
    }
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new ApiError(401, "Not authenticated");

    // Supabase enforces reauthentication on password change if the session
    // is older than an hour — surface that as-is so the UI can prompt.
    const { error } = await supabase.auth.updateUser({ password: new_password });
    if (error) throw new ApiError(400, error.message);

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
