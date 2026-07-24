import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog } from "@/db/schema";
import { handleApiError, requireUserId } from "@/lib/api/helpers";

// Recent activity this user performed, drawn from audit_log filtered by
// actorUserId. Auth-specific events (login, password change, 2FA enable)
// aren't emitted into audit_log yet — TODO once we start writing them from
// the Supabase auth callback. For now this returns whatever the user has
// done in the app, most-recent first.
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
