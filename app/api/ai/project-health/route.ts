import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog, projectHealthSnapshots, projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generateAI } from "@/lib/ai/generate";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "project_health_snapshot", "read");
      return db
        .selectDistinctOn([projectHealthSnapshots.projectId])
        .from(projectHealthSnapshots)
        .innerJoin(projects, eq(projects.id, projectHealthSnapshots.projectId))
        .where(eq(projectHealthSnapshots.orgId, orgId))
        .orderBy(projectHealthSnapshots.projectId, desc(projectHealthSnapshots.createdAt));
    });

    return NextResponse.json({
      data: rows.map((r) => ({ ...r.project_health_snapshots, projectName: r.projects.name })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Tier 0 — the only write is a new project_health_snapshots row;
// nothing here ever mutates task/project/sprint data.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.project_id) {
      throw new ApiError(400, "org_id and project_id are required");
    }

    const project = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "project_health_snapshot", "create");
      const [project] = await db.select().from(projects).where(eq(projects.id, body.project_id));
      if (!project) throw new ApiError(404, "Project not found");
      return project;
    });

    const input = { projectId: body.project_id, projectName: project.name };
    let output: { signals: unknown; aiSummary: string } | null = null;
    let error: string | null = null;

    try {
      output = (await generateAI("Monitor", "project_health_scan", input)) as {
        signals: unknown;
        aiSummary: string;
      };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const action = error ? "project_health_snapshot_generated_failed" : "project_health_snapshot_generated";
    await withOrgContext(userId, (db) =>
      db.insert(auditLog).values({
        orgId: body.org_id,
        actorUserId: userId,
        actorType: "ai",
        action,
        targetType: "project",
        targetId: body.project_id,
        metadata: { tier: "tier_0", input, output: output ?? null, error },
      }),
    );

    if (error) throw new ApiError(502, error);

    const [snapshot] = await withOrgContext(userId, (db) =>
      db
        .insert(projectHealthSnapshots)
        .values({ orgId: body.org_id, projectId: body.project_id, signals: output!.signals, aiSummary: output!.aiSummary })
        .returning(),
    );

    return NextResponse.json({ data: { ...snapshot, projectName: project.name } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
