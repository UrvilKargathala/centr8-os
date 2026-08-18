import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { timeEntries } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listTimeEntries, resolveOwnPersonId } from "@/lib/api/timeEntries";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const personId = sp.get("person_id");
    const projectId = sp.get("project_id");
    const taskId = sp.get("task_id");
    const mine = sp.get("mine") === "true";

    const rows = await withOrgContext(userId, async (db) => {
      if (mine) {
        await requirePermission(db, userId, orgId, "time", "view_own");
        const myPersonId = await resolveOwnPersonId(db, userId, orgId);
        if (!myPersonId) return [];
        return listTimeEntries(db, orgId, {
          personId: myPersonId,
          projectId: projectId ?? undefined,
          taskId: taskId ?? undefined,
          startDate: sp.get("start_date") ?? undefined,
          endDate: sp.get("end_date") ?? undefined,
          limit: Math.min(Number(sp.get("limit") ?? "50") || 50, 200),
          offset: Number(sp.get("offset") ?? "0") || 0,
        });
      }
      await requirePermission(db, userId, orgId, "time", "read");
      return listTimeEntries(db, orgId, {
        personId: personId ?? undefined,
        projectId: projectId ?? undefined,
        taskId: taskId ?? undefined,
        startDate: sp.get("start_date") ?? undefined,
        endDate: sp.get("end_date") ?? undefined,
        limit: Math.min(Number(sp.get("limit") ?? "50") || 50, 200),
        offset: Number(sp.get("offset") ?? "0") || 0,
      });
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const { org_id, task_id, project_id, person_id, date, hours, description, is_billable } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");
    if (!project_id) throw new ApiError(400, "project_id is required");
    if (!date) throw new ApiError(400, "date is required");
    if (!hours || hours <= 0 || hours > 24) throw new ApiError(400, "hours must be between 0 and 24");

    const row = await withOrgContext(userId, async (db) => {
      let resolvedPersonId = person_id;
      if (!resolvedPersonId) {
        await requirePermission(db, userId, org_id, "time", "log_own");
        resolvedPersonId = await resolveOwnPersonId(db, userId, org_id);
        if (!resolvedPersonId) throw new ApiError(400, "No linked team member found for your account");
      } else {
        const myPersonId = await resolveOwnPersonId(db, userId, org_id);
        if (resolvedPersonId === myPersonId) {
          await requirePermission(db, userId, org_id, "time", "log_own");
        } else {
          await requirePermission(db, userId, org_id, "time", "create");
        }
      }

      const [inserted] = await db
        .insert(timeEntries)
        .values({
          orgId: org_id,
          taskId: task_id ?? null,
          projectId: project_id,
          personId: resolvedPersonId,
          date,
          hours: String(hours),
          description: description ?? null,
          isBillable: is_billable ?? true,
          createdBy: userId,
        })
        .returning();
      return inserted;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
