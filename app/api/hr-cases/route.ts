import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { hrCases } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireCaseCreateAccess, requireCaseManageAccess } from "@/lib/api/hrCases";

// Org-wide case list — requires hr_case:manage. Confidential cases are
// always redacted here (subject/description hidden, lock flag set) even
// for manage-holders — full content is only ever returned by
// GET /api/hr-cases/[id], which enforces "manage-holder OR the case's own
// raiser" per case, not a blanket "any admin can list all confidential
// content" grant.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requireCaseManageAccess(db, userId, orgId);
      const cases = await db.select().from(hrCases).where(eq(hrCases.orgId, orgId));
      return cases.map((c) =>
        c.isConfidential
          ? { ...c, subject: "Confidential case", description: null, categoryId: null }
          : c,
      );
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.employee_id || !body.subject || !body.description) {
      throw new ApiError(400, "org_id, employee_id, subject, and description are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requireCaseCreateAccess(db, userId, body.org_id);
      return db
        .insert(hrCases)
        .values({
          orgId: body.org_id,
          employeeId: body.employee_id,
          categoryId: body.category_id ?? null,
          subject: body.subject,
          description: body.description,
          priority: body.priority ?? undefined,
          isConfidential: body.is_confidential ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
