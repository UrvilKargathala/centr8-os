import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { sendGmailMessage } from "@/lib/api/gmail";

// Mirrors app/api/integrations/slack/send/route.ts.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.to || !body.subject || !body.body) {
      throw new ApiError(400, "org_id, to, subject, and body are required");
    }

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "read");

      const [row] = await db
        .select()
        .from(integrations)
        .where(and(eq(integrations.orgId, body.org_id), eq(integrations.provider, "gmail")));

      if (!row || row.status !== "connected") {
        throw new ApiError(400, "Gmail isn't connected for this organization — connect it under Administration → Integrations.");
      }

      const config = row.config as { refresh_token?: string; team_name?: string };
      if (!config.refresh_token) throw new ApiError(500, "Gmail integration is missing its refresh token");

      await sendGmailMessage(config.refresh_token, config.team_name ?? "me", body.to, body.subject, body.body);
    });

    return NextResponse.json({ data: { sent: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
