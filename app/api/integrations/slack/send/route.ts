import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { integrations } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { sendSlackMessage } from "@/lib/api/slack";

// The "Send via Slack" proof-of-concept surfaced contextually (project
// detail page) per Prompt 7.1 — gated on integration:read since anyone who
// can see the integration is connected (owner/admin, per its permission
// seed) is trusted to use it; no separate "send" permission action added.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.channel || !body.text) {
      throw new ApiError(400, "org_id, channel, and text are required");
    }

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "read");

      const [row] = await db
        .select()
        .from(integrations)
        .where(and(eq(integrations.orgId, body.org_id), eq(integrations.provider, "slack")));

      if (!row || row.status !== "connected") {
        throw new ApiError(400, "Slack isn't connected for this organization — connect it under Administration → Integrations.");
      }

      const config = row.config as { access_token?: string };
      if (!config.access_token) throw new ApiError(500, "Slack integration is missing its access token");

      await sendSlackMessage(config.access_token, body.channel, body.text);
    });

    return NextResponse.json({ data: { sent: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
