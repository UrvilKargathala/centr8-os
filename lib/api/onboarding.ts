import { and, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { onboardingWorkflows } from "@/db/schema";
import { requirePermission } from "./permissions";

// Shared by app/api/onboarding/workflows/route.ts (GET, unfiltered case)
// and app/(app)/hr/onboarding/page.tsx (server-rendered initial load,
// "Active Onboarding" tab, the default).
export async function listOnboardingWorkflows(db: OrgScopedDb, userId: string, orgId: string, employeeId?: string) {
  await requirePermission(db, userId, orgId, "employee", "read");
  return db
    .select()
    .from(onboardingWorkflows)
    .where(employeeId ? and(eq(onboardingWorkflows.orgId, orgId), eq(onboardingWorkflows.employeeId, employeeId)) : eq(onboardingWorkflows.orgId, orgId));
}
