import { NextRequest } from "next/server";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  try {
    await requireUserId(req);
    throw new ApiError(501, "Data export is not yet available. This feature is coming soon.");
  } catch (err) {
    return handleApiError(err);
  }
}
