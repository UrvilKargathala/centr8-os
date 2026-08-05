import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generateAI } from "@/lib/ai/generate";

// Tier 0 — Suggest Only (CLAUDE.md §4). This route must never write to
// goals/projects/milestones/sprints/tasks — only POST .../accept does,
// and only on an explicit human click.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.prompt) {
      throw new ApiError(400, "org_id and prompt are required");
    }

    await withOrgContext(userId, (db) => requirePermission(db, userId, body.org_id, "project", "create"));

    const input = { prompt: body.prompt };
    let draft: unknown;
    let error: string | null = null;

    try {
      draft = await generateAI("Planner", "create_project_draft", input);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const action = error ? "ai_project_draft_generated_failed" : "ai_project_draft_generated";
    await withOrgContext(userId, (db) =>
      db.insert(auditLog).values({
        orgId: body.org_id,
        actorUserId: userId,
        actorType: "ai",
        action,
        targetType: "organization",
        targetId: body.org_id,
        metadata: { tier: "tier_0", input, output: draft ?? null, error },
      }),
    );

    if (error) throw new ApiError(502, error);

    return NextResponse.json({ data: { draft } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
