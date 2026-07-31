import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { accounts, activities, contacts, leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "lead", "read");

      const allLeads = await db.select().from(leads).where(eq(leads.orgId, orgId));
      const byStatus: Record<string, number> = {};
      for (const l of allLeads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      const totalLeads = allLeads.filter((l) => l.status !== "lost" && l.status !== "converted").length;
      const convertedCount = byStatus["converted"] ?? 0;
      const conversionRate = allLeads.length > 0 ? convertedCount / allLeads.length : 0;
      const leadsThisMonth = allLeads.filter((l) => l.createdAt >= startOfThisMonth).length;
      const leadsLastMonth = allLeads.filter((l) => l.createdAt >= startOfLastMonth && l.createdAt < startOfThisMonth).length;

      const [{ count: totalAccounts }] = await db.select({ count: sql<number>`count(*)::int` }).from(accounts).where(eq(accounts.orgId, orgId));
      const [{ count: totalContacts }] = await db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(eq(contacts.orgId, orgId));
      const [{ count: activitiesThisWeek }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(activities)
        .where(and(eq(activities.orgId, orgId), gte(activities.activityDate, startOfWeek)));

      return {
        total_leads: totalLeads,
        leads_by_status: byStatus,
        conversion_rate: conversionRate,
        leads_this_month: leadsThisMonth,
        leads_last_month: leadsLastMonth,
        total_accounts: totalAccounts,
        total_contacts: totalContacts,
        activities_this_week: activitiesThisWeek,
      };
    });

    return NextResponse.json({ data: stats });
  } catch (err) {
    return handleApiError(err);
  }
}
