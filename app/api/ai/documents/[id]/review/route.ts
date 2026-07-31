import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { handleApiError, requireUserId } from "@/lib/api/helpers";
import { reviewDocument } from "@/lib/api/aiAssistant";

type Params = { params: Promise<{ id: string }> };

// Reused for both directions of the draft <-> reviewed toggle (body.revert
// = true reverts a reviewed doc back to draft) — finalized is the only
// truly one-way transition, enforced in finalize/route.ts instead.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const result = await withOrgContext(userId, (db) => reviewDocument(db, userId, id, body?.revert === true));
    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
