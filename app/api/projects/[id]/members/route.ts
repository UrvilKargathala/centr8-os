import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { projectMembers, people, projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Members on a project, joined against the people directory so callers
// get names + avatars in one call.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: projectId } = await params;

    const rows = await withOrgContext(userId, (db) =>
      db
        .select({
          projectId: projectMembers.projectId,
          personId: projectMembers.personId,
          role: projectMembers.role,
          hoursPerWeek: projectMembers.hoursPerWeek,
          access: projectMembers.access,
          isLead: projectMembers.isLead,
          fullName: people.fullName,
          jobTitle: people.jobTitle,
          avatarUrl: people.avatarUrl,
        })
        .from(projectMembers)
        .leftJoin(people, eq(projectMembers.personId, people.id))
        .where(eq(projectMembers.projectId, projectId)),
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: projectId } = await params;
    const body = await req.json();
    if (!body.person_id) throw new ApiError(400, "person_id is required");

    const [row] = await withOrgContext(userId, async (db) => {
      const [project] = await db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) throw new ApiError(404, "Project not found");
      await requirePermission(db, userId, project.orgId, "project", "update");
      return db
        .insert(projectMembers)
        .values({
          projectId,
          personId: body.person_id,
          orgId: project.orgId,
          role: body.role ?? null,
          hoursPerWeek: body.hours_per_week ?? null,
          access: body.access ?? "Editor",
          isLead: !!body.is_lead,
        })
        .onConflictDoUpdate({
          target: [projectMembers.projectId, projectMembers.personId],
          set: {
            role: body.role ?? null,
            hoursPerWeek: body.hours_per_week ?? null,
            access: body.access ?? "Editor",
            isLead: !!body.is_lead,
          },
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: projectId } = await params;
    const personId = req.nextUrl.searchParams.get("person_id");
    if (!personId) throw new ApiError(400, "person_id query param is required");

    await withOrgContext(userId, async (db) => {
      const [project] = await db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) throw new ApiError(404, "Project not found");
      await requirePermission(db, userId, project.orgId, "project", "update");
      await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.personId, personId)));
    });

    return NextResponse.json({ data: { removed: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
