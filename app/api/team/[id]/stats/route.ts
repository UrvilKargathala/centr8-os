import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { handleApiError, requireUserId } from "@/lib/api/helpers";
import { getPersonStats } from "@/lib/api/team";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: personId } = await params;

    const result = await withOrgContext(userId, (db) => getPersonStats(db, personId));

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
