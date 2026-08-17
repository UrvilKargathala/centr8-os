import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { createGoogleMeeting, listGoogleMeetings, withGoogleCalendar } from "@/lib/api/googleMeet";

// GET requires time_min/time_max query params (ISO) — the Video page's two
// tabs (Upcoming/Past) each pass their own range rather than this route
// guessing "today" server-side.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    const timeMin = params.get("time_min");
    const timeMax = params.get("time_max");
    if (!orgId || !timeMin || !timeMax) throw new ApiError(400, "org_id, time_min, and time_max are required");

    const meetings = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withGoogleCalendar(db, orgId, (accessToken, calendarId) => listGoogleMeetings(accessToken, calendarId, { timeMin, timeMax }));
    });

    return NextResponse.json({ data: meetings });
  } catch (err) {
    return handleApiError(err);
  }
}

// Creating a meeting isn't an admin-only action — integration:read, same
// tier as viewing, per spec (only connect/disconnect are integration:configure).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.title || !body.start_time || !body.end_time) {
      throw new ApiError(400, "org_id, title, start_time, and end_time are required");
    }

    const meeting = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "read");
      return withGoogleCalendar(db, body.org_id, (accessToken, calendarId) =>
        createGoogleMeeting(accessToken, calendarId, {
          title: body.title,
          startTime: body.start_time,
          endTime: body.end_time,
          attendeeEmails: Array.isArray(body.attendee_emails) ? body.attendee_emails : [],
          description: body.description ?? undefined,
        }),
      );
    });

    return NextResponse.json({ data: meeting }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
