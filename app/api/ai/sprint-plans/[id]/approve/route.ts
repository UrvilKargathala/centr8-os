import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { handleApiError, requireUserId } from "@/lib/api/helpers";
import { approveSprintPlan } from "@/lib/api/aiAssistant";

type Params = { params: Promise<{ id: string }> };

// Tier 1 — Approve to Act (CLAUDE.md §4): the only route that turns a
// proposal into a real sprint + tasks, and only in response to this
// explicit call. Same shape as create-project-draft/accept — never
// auto-applied by generate/route.ts.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const result = await withOrgContext(userId, (db) => approveSprintPlan(db, userId, id));
    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
