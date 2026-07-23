import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { exchangeSlackCode } from "@/lib/api/slack";

// Slack redirects the browser here after the user approves (or denies) the
// authorize screen. This is a top-level navigation with the user's own
// session cookie attached, so requireUserId + requirePermission re-check
// authorization independently of the state param — state is just routing
// (which org this install belongs to), never trusted as proof of access.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("state");
  const redirectTo = (status: "connected" | "error", message?: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("slack", status);
    if (message) url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const code = req.nextUrl.searchParams.get("code");
    const slackError = req.nextUrl.searchParams.get("error");
    if (slackError) return redirectTo("error", slackError);
    if (!code || !orgId) return redirectTo("error", "Missing code or org from Slack redirect");

    const userId = await requireUserId(req);
    const redirectUri = `${req.nextUrl.origin}/api/integrations/slack/callback`;
    const { accessToken, botUserId, teamId, teamName } = await exchangeSlackCode(code, redirectUri);

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "configure");

      const [existing] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "slack")));

      const values = {
        config: { access_token: accessToken, bot_user_id: botUserId, team_id: teamId, team_name: teamName },
        status: "connected" as const,
        connectedByUserId: userId,
        connectedAt: new Date(),
      };

      if (existing) {
        await db.update(integrations).set(values).where(eq(integrations.id, existing.id));
      } else {
        await db.insert(integrations).values({ orgId, provider: "slack", ...values });
      }
    });

    return redirectTo("connected");
  } catch (err) {
    return redirectTo("error", err instanceof Error ? err.message : "Unknown error");
  }
}
