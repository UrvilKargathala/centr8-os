import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { exchangeGoogleCode } from "@/lib/api/gmail";

// Mirrors app/api/integrations/slack/callback/route.ts.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("state");
  const redirectTo = (status: "connected" | "error", message?: string) => {
    const url = new URL("/admin/integrations", req.nextUrl.origin);
    url.searchParams.set("gmail", status);
    if (message) url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  try {
    const code = req.nextUrl.searchParams.get("code");
    const googleError = req.nextUrl.searchParams.get("error");
    if (googleError) return redirectTo("error", googleError);
    if (!code || !orgId) return redirectTo("error", "Missing code or org from Google redirect");

    const userId = await requireUserId(req);
    const redirectUri = `${req.nextUrl.origin}/api/integrations/gmail/callback`;
    const { accessToken, refreshToken, email } = await exchangeGoogleCode(code, redirectUri);

    if (!refreshToken) {
      // Happens if the user previously connected and Google didn't re-issue
      // one — prompt=consent in gmailAuthorizeUrl should prevent this, but
      // surface a clear error instead of silently storing a token that'll
      // stop working in ~1hr with no way to refresh it.
      return redirectTo("error", "Google didn't return a refresh token — disconnect any prior Gmail access at myaccount.google.com/permissions and try again.");
    }

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "configure");

      const [existing] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, "gmail")));

      const values = {
        config: { access_token: accessToken, refresh_token: refreshToken, team_name: email },
        status: "connected" as const,
        connectedByUserId: userId,
        connectedAt: new Date(),
      };

      if (existing) {
        await db.update(integrations).set(values).where(eq(integrations.id, existing.id));
      } else {
        await db.insert(integrations).values({ orgId, provider: "gmail", ...values });
      }
    });

    return redirectTo("connected");
  } catch (err) {
    return redirectTo("error", err instanceof Error ? err.message : "Unknown error");
  }
}
