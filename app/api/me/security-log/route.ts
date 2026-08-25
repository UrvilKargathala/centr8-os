import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog } from "@/db/schema";
import { handleApiError, requireUserId } from "@/lib/api/helpers";

// Recent activity this user performed, drawn from audit_log filtered by
// actorUserId. user_login (app/api/me/record-login) and
// user_password_changed (app/api/me/change-password) are real auth events
// now, alongside whatever else the user has done in the app — most-recent
// first.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const rows = await withOrgContext(userId, (db) =>
      db
        .select()
        .from(auditLog)
        .where(eq(auditLog.actorUserId, userId))
        .orderBy(desc(auditLog.createdAt))
        .limit(10),
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
