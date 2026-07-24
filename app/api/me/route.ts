import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

// Soft-delete the caller's account. Real account deletion in Supabase
// requires the service-role admin API — TODO once we're comfortable
// wiring that. For now: sign out the current session and mark the intent
// in the log so an admin can complete the wipe.
export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== "DELETE") {
      throw new ApiError(400, "Type DELETE to confirm");
    }
    console.log("me/DELETE: account deletion requested", { userId });
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ data: { signedOut: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
