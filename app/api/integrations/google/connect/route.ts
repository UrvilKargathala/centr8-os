import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { googleAuthorizeUrl } from "@/lib/api/googleOAuth";

// Mirrors app/api/integrations/gmail/connect/route.ts — top-level browser
// navigation to a real Google consent screen, state carries org_id, the
// callback re-checks permission independently rather than trusting state.
export async function GET(req: NextRequest) {
  const errorRedirect = (message: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("google_meet", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, (db) => requirePermission(db, userId, orgId, "integration", "configure"));

    const redirectUri = `${req.nextUrl.origin}/api/integrations/google/callback`;
    const authorizeUrl = googleAuthorizeUrl(redirectUri, orgId, "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email");
    if (!authorizeUrl) {
      return errorRedirect("Google isn't configured yet — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see lib/api/gmail.ts for setup steps).");
    }

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    if (err instanceof ApiError) return errorRedirect(err.message);
    return handleApiError(err);
  }
}
