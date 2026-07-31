import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { generatedDocuments, projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generateAI } from "@/lib/ai/generate";

const DOC_TYPES = ["prd", "sop", "meeting_summary", "release_notes", "bug_report", "test_cases", "client_update", "executive_summary"];

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !DOC_TYPES.includes(body.doc_type)) throw new ApiError(400, "org_id and a valid doc_type are required");

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "document", "create");

      let projectName = "the project";
      if (body.project_id) {
        const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, body.project_id));
        if (project) projectName = project.name;
      }

      const ai = (await generateAI("Writer", "generate_document", {
        doc_type: body.doc_type,
        project_name: projectName,
        context: body.context ?? "",
        today: new Date().toISOString().slice(0, 10),
      })) as { title: string; content: string };

      const [doc] = await db
        .insert(generatedDocuments)
        .values({
          orgId: body.org_id,
          docType: body.doc_type,
          title: ai.title,
          content: ai.content,
          contextSource: { projectId: body.project_id ?? null, context: body.context ?? null },
          createdBy: userId,
        })
        .returning();

      return doc;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
