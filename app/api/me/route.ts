import { NextRequest } from "next/server";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

export async function DELETE(req: NextRequest) {
  try {
    await requireUserId(req);
    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== "DELETE") {
      throw new ApiError(400, "Type DELETE to confirm");
    }
    throw new ApiError(501, "Account deletion is not yet available. Please contact support.");
  } catch (err) {
    return handleApiError(err);
  }
}
