import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { timeEntries } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnPersonId } from "@/lib/api/timeEntries";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireUserId(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const { org_id, hours, description, is_billable, task_id, date } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ personId: timeEntries.personId })
        .from(timeEntries)
        .where(eq(timeEntries.id, id))
        .limit(1);
      if (!existing) throw new ApiError(404, "Time entry not found");

      const myPersonId = await resolveOwnPersonId(db, userId, org_id);
      if (existing.personId === myPersonId) {
        await requirePermission(db, userId, org_id, "time", "log_own");
      } else {
        await requirePermission(db, userId, org_id, "time", "update");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (hours !== undefined) {
        if (hours <= 0 || hours > 24) throw new ApiError(400, "hours must be between 0 and 24");
        updates.hours = String(hours);
      }
      if (description !== undefined) updates.description = description;
      if (is_billable !== undefined) updates.isBillable = is_billable;
      if (task_id !== undefined) updates.taskId = task_id;
      if (date !== undefined) updates.date = date;

      const [updated] = await db
        .update(timeEntries)
        .set(updates)
        .where(eq(timeEntries.id, id))
        .returning();
      return updated;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireUserId(req);
    const { id } = await ctx.params;
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, async (db) => {
      const [existing] = await db
        .select({ personId: timeEntries.personId })
        .from(timeEntries)
        .where(eq(timeEntries.id, id))
        .limit(1);
      if (!existing) throw new ApiError(404, "Time entry not found");

      const myPersonId = await resolveOwnPersonId(db, userId, orgId);
      if (existing.personId === myPersonId) {
        await requirePermission(db, userId, orgId, "time", "log_own");
      } else {
        await requirePermission(db, userId, orgId, "time", "delete");
      }

      await db.delete(timeEntries).where(eq(timeEntries.id, id));
    });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
