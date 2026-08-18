import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { aiConversations, aiMessages, projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { generateAI } from "@/lib/ai/generate";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.question?.trim()) throw new ApiError(400, "question is required");

    const result = await withOrgContext(userId, async (db) => {
      const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
      if (!conversation) throw new ApiError(404, "Conversation not found");

      const priorMessages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));

      const [userMessage] = await db
        .insert(aiMessages)
        .values({ orgId: conversation.orgId, conversationId: id, role: "user", content: body.question })
        .returning();

      const orgProjects = await db.select({ name: projects.name }).from(projects).where(eq(projects.orgId, conversation.orgId));

      const ai = (await generateAI("Analyst", "ask_ai", {
        question: body.question,
        conversation_history: priorMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        org_context: { project_names: orgProjects.map((p) => p.name) },
      })) as { answer: string; citations: { source_type: string; source_title: string; excerpt: string }[] };

      const [assistantMessage] = await db
        .insert(aiMessages)
        .values({ orgId: conversation.orgId, conversationId: id, role: "assistant", content: ai.answer, citations: ai.citations })
        .returning();

      const isFirstMessage = priorMessages.length === 0;
      if (isFirstMessage) {
        await db
          .update(aiConversations)
          .set({ title: body.question.slice(0, 60), updatedAt: new Date() })
          .where(eq(aiConversations.id, id));
      } else {
        await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, id));
      }

      return { userMessage, assistantMessage };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof ApiError) && err.message.includes("rate limit")) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof Error && !(err instanceof ApiError) && (err.message.includes("AI ") || err.message.includes("OpenRouter"))) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return handleApiError(err);
  }
}
