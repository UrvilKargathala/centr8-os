import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { aiConversations } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

// No permission gate — any authenticated user can use Ask AI, scoped to
// their own conversations by RLS (ai_conversations_isolation checks
// user_id = auth.uid()), same as db/schema.ts's comment explains.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, (db) =>
      db.select().from(aiConversations).where(eq(aiConversations.orgId, orgId)).orderBy(desc(aiConversations.updatedAt)),
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    const [row] = await withOrgContext(userId, (db) =>
      db
        .insert(aiConversations)
        .values({ orgId: body.org_id, userId, title: body.title ?? null })
        .returning(),
    );

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
