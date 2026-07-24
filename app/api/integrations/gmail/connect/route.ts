import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { gmailAuthorizeUrl } from "@/lib/api/gmail";

// Mirrors app/api/integrations/slack/connect/route.ts — top-level browser
// navigation (real Google consent screen), state carries org_id, callback
// re-checks permission independently rather than trusting state alone.
export async function GET(req: NextRequest) {
  const errorRedirect = (message: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("gmail", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, (db) => requirePermission(db, userId, orgId, "integration", "configure"));

    const redirectUri = `${req.nextUrl.origin}/api/integrations/gmail/callback`;
    const authorizeUrl = gmailAuthorizeUrl(redirectUri, orgId);
    if (!authorizeUrl) {
      return errorRedirect(
        "Gmail isn't configured yet — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see lib/api/gmail.ts for setup steps).",
      );
    }

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    if (err instanceof ApiError) return errorRedirect(err.message);
    return handleApiError(err);
  }
}
