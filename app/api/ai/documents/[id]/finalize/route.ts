import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { handleApiError, requireUserId } from "@/lib/api/helpers";
import { finalizeDocument } from "@/lib/api/aiAssistant";

type Params = { params: Promise<{ id: string }> };

// Irreversible by design (build spec) — there is no un-finalize route, and
// PATCH/route.ts + review/route.ts both reject any further change once
// status='finalized'.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const result = await withOrgContext(userId, (db) => finalizeDocument(db, userId, id));
    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
