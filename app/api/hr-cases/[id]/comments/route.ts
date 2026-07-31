import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { hrCaseComments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission } from "@/lib/api/permissions";
import { getCaseOrThrow, resolveOwnEmployeeId } from "@/lib/api/hrCases";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.comment) throw new ApiError(400, "comment is required");

    const row = await withOrgContext(userId, async (db) => {
      const hrCase = await getCaseOrThrow(db, id);
      const isHandler = await hasPermission(db, userId, hrCase.orgId, "hr_case", "manage");
      const ownId = await resolveOwnEmployeeId(db, userId, hrCase.orgId);
      const isRaiser = ownId === hrCase.employeeId;

      if (!isHandler && !isRaiser) {
        throw new ApiError(403, "Not authorized to comment on this case");
      }
      const isInternalNote = body.is_internal_note === true;
      if (isInternalNote && !isHandler) {
        throw new ApiError(403, "Only a case handler can add an internal note");
      }
      if (!ownId) throw new ApiError(400, "No linked employee record for this user");

      const [created] = await db
        .insert(hrCaseComments)
        .values({ orgId: hrCase.orgId, caseId: id, authorId: ownId, comment: body.comment, isInternalNote })
        .returning();
      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
