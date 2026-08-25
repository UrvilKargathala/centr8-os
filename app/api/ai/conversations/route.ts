import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listMyConversations } from "@/lib/api/aiAssistant";

// No permission gate — any authenticated user can use Ask AI, scoped to
// their own conversations by RLS (ai_conversations_isolation checks
// user_id = auth.uid()), same as db/schema.ts's comment explains.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, (db) => listMyConversations(db, orgId));
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
