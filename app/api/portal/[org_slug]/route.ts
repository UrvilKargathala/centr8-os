import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, organizations, projects, tasks } from "@/db/schema";
import { PortalAccessError, requirePortalGrant } from "@/lib/api/portalAccess";
import { computePlainStatusSummary } from "@/lib/portal/summary";
import { generateAI } from "@/lib/ai/generate";

type Params = { params: Promise<{ org_slug: string }> };

// Public route (proxy.ts already treats /portal and /api as unauthenticated
// paths) — but "public" only gets you the org's branding once you also
// have a valid token. No Supabase session exists for a client, so this
// reads through db/index.ts's plain connection (bypasses RLS by the same
// Neon owner-role default noted in db/withOrgContext.ts) and enforces
// scoping in application code: every query below is explicitly filtered
// by the grant's own project_id, never by anything the client supplies.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { org_slug } = await params;
    const token = req.nextUrl.searchParams.get("token");

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, brandingConfig: organizations.brandingConfig })
      .from(organizations)
      .where(eq(organizations.slug, org_slug));
    if (!org) return NextResponse.json({ error: "Portal not found" }, { status: 404 });

    const grant = await requirePortalGrant(token);
    if (grant.orgId !== org.id) {
      return NextResponse.json({ error: "This access link doesn't belong to this portal" }, { status: 403 });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, grant.projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [milestoneRows, taskRows] = await Promise.all([
      db.select().from(milestones).where(eq(milestones.projectId, grant.projectId)),
      db.select({ status: tasks.status }).from(tasks).where(eq(tasks.projectId, grant.projectId)),
    ]);

    const hideBudget = grant.hiddenFields.includes("budget");

    return NextResponse.json({
      data: {
        organization: { name: org.name, brandingConfig: org.brandingConfig },
        clientName: grant.clientName,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          ...(hideBudget ? {} : { budgetAllocated: project.budgetAllocated, budgetSpent: project.budgetSpent }),
        },
        milestones: milestoneRows.map((m) => ({
          id: m.id,
          name: m.name,
          dueDate: m.dueDate,
          approvedAt: m.approvedAt,
        })),
        summary: await (async () => {
          const plain = computePlainStatusSummary(milestoneRows, taskRows);
          try {
            const ai = (await generateAI("Analyst", "portal_summary", {
              project_name: project.name,
              project_status: project.status,
              current_milestone: plain.currentMilestoneName,
              pct_tasks_done: plain.pctTasksDone,
              total_milestones: milestoneRows.length,
              approved_milestones: milestoneRows.filter((m) => m.approvedAt).length,
            })) as { currentMilestoneName: string | null; pctTasksDone: number; aiSummary?: string };
            return { ...plain, aiSummary: ai.aiSummary ?? null };
          } catch {
            return { ...plain, aiSummary: null };
          }
        })(),
      },
    });
  } catch (err) {
    if (err instanceof PortalAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
