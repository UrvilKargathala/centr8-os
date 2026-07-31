import { NextRequest, NextResponse } from "next/server";
import { and, eq, notInArray } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { people, projects, sprintPlanProposals, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { generateAI } from "@/lib/ai/generate";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.project_id) throw new ApiError(400, "org_id and project_id are required");

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "sprint_plan", "create");

      const [project] = await db.select().from(projects).where(eq(projects.id, body.project_id));
      if (!project) throw new ApiError(404, "Project not found");

      const backlogTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, body.project_id), notInArray(tasks.status, ["done", "cancelled"])));

      const teamMembers = await db
        .select({ id: people.id, fullName: people.fullName, availableHoursPerWeek: people.availableHoursPerWeek })
        .from(people)
        .where(and(eq(people.orgId, body.org_id), eq(people.isActive, true)));

      const ai = (await generateAI("Planner", "generate_sprint_plan", {
        project_name: project.name,
        backlog_tasks: backlogTasks.map((t) => ({ id: t.id, title: t.title, estimate: t.estimate, priority: t.priority })),
        team_members: teamMembers.map((m) => ({ id: m.id, name: m.fullName, available_hours_per_week: m.availableHoursPerWeek })),
      })) as {
        sprint_name: string;
        start_date: string;
        end_date: string;
        tasks: { title: string; assignee_name: string; estimate: number; priority: string }[];
        capacity_analysis: Record<string, unknown>;
        reasoning: string;
      };

      const [proposal] = await db
        .insert(sprintPlanProposals)
        .values({
          orgId: body.org_id,
          projectId: body.project_id,
          sprintName: ai.sprint_name,
          proposedStartDate: ai.start_date,
          proposedEndDate: ai.end_date,
          proposedTasks: ai.tasks,
          capacityAnalysis: ai.capacity_analysis,
          reasoning: ai.reasoning,
        })
        .returning();

      return proposal;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
