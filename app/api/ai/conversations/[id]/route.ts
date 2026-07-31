import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { aiConversations, aiMessages } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      // RLS (ai_conversations_isolation) already restricts this select to
      // the caller's own conversations — a row from another user simply
      // won't come back, which is what makes the 404 below double as the
      // cross-user isolation check the regression test verifies.
      const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
      if (!conversation) return null;
      const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));
      return { conversation, messages };
    });

    if (!result) throw new ApiError(404, "Conversation not found");
    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const updated = await withOrgContext(userId, async (db) => {
      const rows = await db.update(aiConversations).set({ title: body.title, updatedAt: new Date() }).where(eq(aiConversations.id, id)).returning();
      return rows[0];
    });

    if (!updated) throw new ApiError(404, "Conversation not found");
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const deleted = await withOrgContext(userId, async (db) => {
      const rows = await db.delete(aiConversations).where(eq(aiConversations.id, id)).returning();
      return rows[0];
    });

    if (!deleted) throw new ApiError(404, "Conversation not found");
    return NextResponse.json({ data: { id } });
  } catch (err) {
    return handleApiError(err);
  }
}
