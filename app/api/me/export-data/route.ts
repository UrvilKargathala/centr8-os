import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireUserId } from "@/lib/api/helpers";

// TODO: kick off a real background job that writes the caller's data
// (projects owned, tasks assigned, comments authored, preferences,
// audit-log entries) to JSON and emails a download link. For now this
// just acknowledges the request so the toast UI can flip to "requested".
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    console.log("me/export-data: TODO — export requested", { userId });
    return NextResponse.json({ data: { requested: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
