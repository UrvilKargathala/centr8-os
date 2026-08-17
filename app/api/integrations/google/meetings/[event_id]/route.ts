import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { cancelGoogleMeeting, withGoogleCalendar } from "@/lib/api/googleMeet";

type Params = { params: Promise<{ event_id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { event_id } = await params;
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withGoogleCalendar(db, orgId, (accessToken, calendarId) => cancelGoogleMeeting(accessToken, calendarId, event_id));
    });

    return NextResponse.json({ data: { cancelled: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
