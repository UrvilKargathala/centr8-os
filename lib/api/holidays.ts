import { eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { holidays } from "@/db/schema";
import { requirePermission } from "./permissions";

// Shared by app/api/holidays/route.ts (GET) and
// app/(app)/hr/holidays/page.tsx (server-rendered initial load).
export async function listHolidays(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "holiday", "read");
  return db.select().from(holidays).where(eq(holidays.orgId, orgId));
}
