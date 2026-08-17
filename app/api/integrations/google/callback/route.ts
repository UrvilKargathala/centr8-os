import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { connectGoogleMeet } from "@/lib/api/googleMeet";

// Mirrors app/api/integrations/gmail/callback/route.ts. `state` carries
// org_id but is never trusted on its own — requirePermission re-checks the
// calling user actually holds integration:configure in that exact org
// before anything is written, so a tampered/replayed state value can't be
// used to connect Google Meet into an org the caller has no access to.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("state");
  const redirectTo = (status: "connected" | "error", message?: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("google_meet", status);
    if (message) url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const code = req.nextUrl.searchParams.get("code");
    const googleError = req.nextUrl.searchParams.get("error");
    if (googleError) return redirectTo("error", googleError);
    if (!code || !orgId) return redirectTo("error", "Missing code or org from Google redirect");

    const userId = await requireUserId(req);
    const redirectUri = `${req.nextUrl.origin}/api/integrations/google/callback`;

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "configure");
      return connectGoogleMeet(db, orgId, userId, code, redirectUri);
    });

    return redirectTo("connected");
  } catch (err) {
    return redirectTo("error", err instanceof Error ? err.message : "Unknown error");
  }
}
