import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { timesheetSubmissions, timeEntries } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnPersonId } from "@/lib/api/timeEntries";
import { sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    const weekStart = sp.get("week_start");
    if (!orgId) throw new ApiError(400, "org_id is required");
    if (!weekStart) throw new ApiError(400, "week_start is required");

    const row = await withOrgContext(userId, async (db) => {
      const personId = await resolveOwnPersonId(db, userId, orgId);
      if (!personId) return null;
      const [sub] = await db
        .select()
        .from(timesheetSubmissions)
        .where(
          and(
            eq(timesheetSubmissions.orgId, orgId),
            eq(timesheetSubmissions.personId, personId),
            eq(timesheetSubmissions.weekStart, weekStart),
          ),
        )
        .limit(1);
      return sub ?? null;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const { org_id, week_start } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");
    if (!week_start) throw new ApiError(400, "week_start is required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, org_id, "time", "submit");
      const personId = await resolveOwnPersonId(db, userId, org_id);
      if (!personId) throw new ApiError(400, "No linked team member found for your account");

      const [existing] = await db
        .select()
        .from(timesheetSubmissions)
        .where(
          and(
            eq(timesheetSubmissions.orgId, org_id),
            eq(timesheetSubmissions.personId, personId),
            eq(timesheetSubmissions.weekStart, week_start),
          ),
        )
        .limit(1);

      if (existing && existing.status === "approved") {
        throw new ApiError(400, "This timesheet has already been approved");
      }
      if (existing && existing.status === "submitted") {
        throw new ApiError(400, "This timesheet has already been submitted");
      }

      const weekEnd = new Date(new Date(week_start).getTime() + 6 * 86400000)
        .toISOString()
        .slice(0, 10);
      const [hoursRow] = await db
        .select({ total: sql<string>`coalesce(sum(${timeEntries.hours}), '0')` })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.orgId, org_id),
            eq(timeEntries.personId, personId),
            sql`${timeEntries.date} >= ${week_start}`,
            sql`${timeEntries.date} <= ${weekEnd}`,
          ),
        );

      const totalHours = hoursRow?.total ?? "0";

      if (existing) {
        const [updated] = await db
          .update(timesheetSubmissions)
          .set({
            status: "submitted",
            submittedAt: new Date(),
            totalHours,
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(timesheetSubmissions.id, existing.id))
          .returning();
        return updated;
      }

      const [inserted] = await db
        .insert(timesheetSubmissions)
        .values({
          orgId: org_id,
          personId,
          weekStart: week_start,
          status: "submitted",
          submittedAt: new Date(),
          totalHours,
        })
        .returning();
      return inserted;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const { org_id, submission_id, action, rejection_reason } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");
    if (!submission_id) throw new ApiError(400, "submission_id is required");
    if (!action || !["approve", "reject"].includes(action)) {
      throw new ApiError(400, "action must be 'approve' or 'reject'");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, org_id, "time", "approve");

      const [sub] = await db
        .select()
        .from(timesheetSubmissions)
        .where(
          and(
            eq(timesheetSubmissions.id, submission_id),
            eq(timesheetSubmissions.orgId, org_id),
          ),
        )
        .limit(1);

      if (!sub) throw new ApiError(404, "Submission not found");
      if (sub.status !== "submitted") {
        throw new ApiError(400, `Cannot ${action} a timesheet with status '${sub.status}'`);
      }
      if (action === "reject" && !rejection_reason) {
        throw new ApiError(400, "rejection_reason is required when rejecting");
      }

      const [updated] = await db
        .update(timesheetSubmissions)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          reviewedBy: userId,
          reviewedAt: new Date(),
          rejectionReason: action === "reject" ? rejection_reason : null,
          updatedAt: new Date(),
        })
        .where(eq(timesheetSubmissions.id, submission_id))
        .returning();
      return updated;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
