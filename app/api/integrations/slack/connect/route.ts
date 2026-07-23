import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Top-level browser navigation (the "Connect" button is a plain link), not
// a fetch() call — Slack's OAuth authorize screen has to be a real page
// the user sees and approves, so this redirects rather than returning JSON.
// state carries org_id; Slack echoes it back verbatim to the callback,
// which re-checks the (still-cookied) user's permission independently
// rather than trusting the state value alone.
export async function GET(req: NextRequest) {
  const errorRedirect = (message: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("slack", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, (db) => requirePermission(db, userId, orgId, "integration", "configure"));

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      return errorRedirect(
        "Slack isn't configured yet — set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (see lib/api/slack.ts for setup steps).",
      );
    }

    const redirectUri = `${req.nextUrl.origin}/api/integrations/slack/callback`;
    const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", "chat:write,chat:write.public");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", orgId);

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    if (err instanceof ApiError) return errorRedirect(err.message);
    return handleApiError(err);
  }
}
