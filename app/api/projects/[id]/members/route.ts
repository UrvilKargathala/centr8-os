import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { projectMembers, people } from "@/db/schema";
import { handleApiError, requireUserId } from "@/lib/api/helpers";

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
