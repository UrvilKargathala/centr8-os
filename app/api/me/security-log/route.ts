import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { handleApiError, requireUserId } from "@/lib/api/helpers";
import { listMySecurityLog } from "@/lib/api/me";

// Recent activity this user performed, drawn from audit_log filtered by
// actorUserId. user_login (app/api/me/record-login) and
// user_password_changed (app/api/me/change-password) are real auth events
// now, alongside whatever else the user has done in the app — most-recent
// first.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const rows = await withOrgContext(userId, (db) => listMySecurityLog(db, userId));
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
