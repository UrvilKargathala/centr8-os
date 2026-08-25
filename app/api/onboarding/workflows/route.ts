import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, onboardingWorkflows, templates } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listOnboardingWorkflows } from "@/lib/api/onboarding";

type TemplateStep = {
  step_id: string;
  title: string;
  description: string;
  category: string;
  owner_role: string;
  days_after_start: number;
};

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const employeeId = req.nextUrl.searchParams.get("employee_id");

    const rows = await withOrgContext(userId, (db) => listOnboardingWorkflows(db, userId, orgId, employeeId ?? undefined));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// Assign a template to an employee — clones template.structure.steps into
// the workflow's own `steps` column (each step gains status: 'pending')
// so editing the template later doesn't retroactively change an in-flight
// employee's checklist (see db/schema.ts's onboardingWorkflows comment).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.employee_id || !body.template_id) {
      throw new ApiError(400, "org_id, employee_id and template_id are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "onboarding", "assign");

      const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, body.employee_id));
      if (!employee) throw new ApiError(404, "Employee not found");

      const [template] = await db.select().from(templates).where(eq(templates.id, body.template_id));
      if (!template) throw new ApiError(404, "Template not found");

      const templateSteps = ((template.structure as { steps?: TemplateStep[] })?.steps ?? []) as TemplateStep[];
      const steps = templateSteps.map((s) => ({
        ...s,
        status: "pending" as const,
        completed_by: null,
        completed_at: null,
        notes: null,
      }));

      const [created] = await db
        .insert(onboardingWorkflows)
        .values({
          orgId: body.org_id,
          employeeId: body.employee_id,
          templateId: body.template_id,
          steps,
          status: "not_started",
        })
        .returning();
      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
