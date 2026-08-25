// CRM Batch 1 — Leads, Contacts, Accounts. Shared "sales-team working
// set" tier (owner/admin/member get full CRUD, viewer read-only — same as
// lead/contact/account/deal/activity's existing grid), with lead
// conversion and reassignment as separate, more tightly-held actions
// (lead:convert, */assign) layered on top.
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { accounts, activities, campaigns, contacts, dealStageHistory, deals, employees, forecastTargets, leads } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";
import { createNotification } from "@/lib/notifications/create";

// CRM Batch 2 — default probability per stage. A PATCH's explicit
// `probability` in the request body always wins over this table (see
// changeDealStage below) — this is only the auto-set default.
export const STAGE_PROBABILITY: Record<string, number> = {
  prospecting: 10,
  discovery: 25,
  proposal: 50,
  negotiation: 75,
  contract_sent: 90,
  won: 100,
  lost: 0,
};

// Shared by app/api/crm/leads/route.ts and app/(app)/crm/leads/page.tsx
// (server-rendered initial load) — the page's status/source/owner/score/
// search filters are applied via refetch, so the initial server load just
// needs every lead, same as GET with no query params.
// Shared by app/api/crm/stats/route.ts and app/(app)/crm/page.tsx
// (server-rendered initial load).
export async function getCrmStats(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "lead", "read");

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
}

export async function listAllLeads(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "lead", "read");
  return db.select().from(leads).where(eq(leads.orgId, orgId));
}

// Shared by app/api/crm/accounts/route.ts and app/(app)/crm/accounts/page.tsx.
export async function listAllAccounts(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "account", "read");
  return db.select().from(accounts).where(eq(accounts.orgId, orgId));
}

// Shared by app/api/crm/contacts/route.ts and app/(app)/crm/{accounts,contacts}
// pages (server-rendered initial load).
export async function listAllContacts(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "contact", "read");
  return db.select().from(contacts).where(eq(contacts.orgId, orgId));
}

// app/(app)/crm/{contacts,deals}' account-name lookup — just id+name.
// Requires account:read same as GET /api/crm/accounts does; callers should
// catch and default to [] the way the pages' original client fetch
// degraded gracefully when the caller had contact:read but not
// account:read (Promise.all's other results still populate the page).
export async function listAccountNames(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "account", "read");
  return db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.orgId, orgId));
}

export async function resolveOwnEmployeeId(db: OrgScopedDb, userId: string, orgId: string): Promise<string | null> {
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.userId, userId)));
  return row?.id ?? null;
}

export function requireLeadConvertAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "lead", "convert");
}
export function requireLeadAssignAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "lead", "assign");
}
export function requireAccountAssignAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "account", "assign");
}
export function requireContactAssignAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "contact", "assign");
}
export function requireDealCloseAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "deal", "close");
}
export function requireDealAssignAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "deal", "assign");
}

export type Lead = typeof leads.$inferSelect;

// Runs inside the caller's withOrgContext callback, so this is already
// one all-or-nothing transaction (withOrgContext wraps every query in a
// single `begin`/`commit` — see db/withOrgContext.ts) — no nested
// db.transaction() needed. An already-converted or already-lost lead is a
// hard 400, not a silent no-op: re-running conversion on a terminal-state
// lead is a client bug, not a valid retry.
export async function convertLead(
  db: OrgScopedDb,
  orgId: string,
  performedByEmployeeId: string | null,
  leadId: string,
  options?: { createDeal?: boolean; dealName?: string; dealValue?: number | null },
) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead || lead.orgId !== orgId) throw new ApiError(404, "Lead not found");
  if (lead.status === "converted") throw new ApiError(400, "This lead has already been converted");
  if (lead.status === "lost") throw new ApiError(400, "This lead is marked lost and cannot be converted");

  const [account] = await db
    .insert(accounts)
    .values({
      orgId,
      name: lead.companyName || lead.fullName,
      industry: null,
      ownerId: lead.ownerId,
    })
    .returning();

  const [contact] = await db
    .insert(contacts)
    .values({
      orgId,
      accountId: account.id,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      jobTitle: lead.jobTitle,
      ownerId: lead.ownerId,
      source: "converted_lead",
      convertedFromLeadId: lead.id,
    })
    .returning();

  const [updatedLead] = await db
    .update(leads)
    .set({
      status: "converted",
      convertedAt: new Date(),
      convertedAccountId: account.id,
      convertedContactId: contact.id,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId))
    .returning();

  await db.insert(activities).values({
    orgId,
    relatedType: "lead",
    relatedId: leadId,
    type: "conversion",
    subject: "Lead converted",
    description: `Converted to account "${account.name}" and contact "${contact.fullName}".`,
    performedBy: performedByEmployeeId,
  });

  const createDeal = options?.createDeal ?? true;
  if (!createDeal) return { lead: updatedLead, account, contact, deal: null };

  const [deal] = await db
    .insert(deals)
    .values({
      orgId,
      name: options?.dealName || `${lead.companyName || lead.fullName} — New Deal`,
      accountId: account.id,
      primaryContactId: contact.id,
      ownerId: lead.ownerId,
      stage: "prospecting",
      probability: STAGE_PROBABILITY.prospecting,
      value: options?.dealValue ?? null,
      source: "converted_lead",
      convertedFromLeadId: lead.id,
      createdBy: performedByEmployeeId,
    })
    .returning();

  await db.insert(dealStageHistory).values({
    orgId,
    dealId: deal.id,
    fromStage: null,
    toStage: "prospecting",
    changedBy: performedByEmployeeId,
  });

  return { lead: updatedLead, account, contact, deal };
}

export type Deal = typeof deals.$inferSelect;

// Transactional stage change: stage_history + deal.stage/stageChangedAt/
// updatedAt + probability (auto from STAGE_PROBABILITY unless the caller
// passes an explicit override) + a status_change activity, all inside the
// caller's withOrgContext transaction — same all-or-nothing discipline as
// convertLead.
export async function changeDealStage(
  db: OrgScopedDb,
  orgId: string,
  dealId: string,
  toStage: string,
  performedByEmployeeId: string | null,
  explicitProbability?: number,
) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!deal || deal.orgId !== orgId) throw new ApiError(404, "Deal not found");

  const fromStage = deal.stage;
  const now = new Date();
  const durationMinutes = Math.round((now.getTime() - deal.stageChangedAt.getTime()) / 60000);

  await db.insert(dealStageHistory).values({
    orgId,
    dealId,
    fromStage,
    toStage: toStage as typeof deal.stage,
    changedBy: performedByEmployeeId,
    durationInPreviousStageMinutes: durationMinutes,
  });

  const [updated] = await db
    .update(deals)
    .set({
      stage: toStage as typeof deal.stage,
      probability: explicitProbability ?? STAGE_PROBABILITY[toStage] ?? deal.probability,
      stageChangedAt: now,
      updatedAt: now,
    })
    .where(eq(deals.id, dealId))
    .returning();

  await db.insert(activities).values({
    orgId,
    relatedType: "deal",
    relatedId: dealId,
    type: "status_change",
    subject: `Stage: ${fromStage} → ${toStage}`,
    performedBy: performedByEmployeeId,
  });

  if (updated?.ownerId) {
    const [owner] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, updated.ownerId));
    if (owner?.userId) {
      createNotification(db, {
        orgId,
        userId: owner.userId,
        type: "deal_stage_changed",
        title: `Deal moved: ${fromStage} → ${toStage}`,
        body: updated.name,
        linkType: "deal",
        linkId: updated.id,
      }).catch(() => {});
    }
  }

  return updated;
}

// Won/lost is just a stage change with extra required/optional fields —
// reuses changeDealStage for the transactional stage_history+activity
// part, then layers on actualCloseDate/lostReason/wonNotes.
export async function closeDeal(
  db: OrgScopedDb,
  orgId: string,
  dealId: string,
  outcome: "won" | "lost",
  performedByEmployeeId: string | null,
  lostReason?: string | null,
  wonNotes?: string | null,
) {
  if (outcome === "lost" && !lostReason) {
    throw new ApiError(400, "lost_reason is required when closing a deal as lost");
  }

  await changeDealStage(db, orgId, dealId, outcome, performedByEmployeeId);

  const [updated] = await db
    .update(deals)
    .set({
      actualCloseDate: new Date().toISOString().slice(0, 10),
      lostReason: outcome === "lost" ? lostReason : null,
      wonNotes: outcome === "won" ? (wonNotes ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId))
    .returning();

  if (outcome === "won" && updated?.ownerId) {
    const [owner] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, updated.ownerId));
    if (owner?.userId) {
      await createNotification(db, {
        orgId,
        userId: owner.userId,
        type: "deal_won",
        title: `Deal won: ${updated.name}`,
        linkType: "deal",
        linkId: updated.id,
      });
    }
  }

  return updated;
}

export function requireForecastSetTargetAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "forecast", "set_target");
}
export function requireCampaignCreateAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "campaign", "create");
}
export function requireCampaignUpdateAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "campaign", "update");
}
export function requireCampaignDeleteAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "campaign", "delete");
}

// CRM Batch 3 — forecasts are always computed live from `deals`, never
// stored (see forecastTargets' schema comment). ownerId narrows to one
// rep's deals; omitted, this is the org-wide forecast for the period.
const OPEN_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"];
// Shared by app/api/crm/activities/route.ts and app/(app)/crm/activities/page.tsx.
export async function listAllActivities(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "activity", "read");
  return db.select().from(activities).where(eq(activities.orgId, orgId)).orderBy(desc(activities.activityDate));
}

// Shared by app/api/crm/deals/route.ts and app/(app)/crm/deals/page.tsx.
export async function listAllDeals(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "deal", "read");
  return db.select().from(deals).where(eq(deals.orgId, orgId));
}

const OPEN_DEAL_PIPELINE_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"];

// Shared by app/api/crm/deals/pipeline-stats/route.ts and
// app/(app)/crm/deals/page.tsx (server-rendered initial load).
export async function computePipelineStats(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "deal", "read");
  const allDeals = await db.select().from(deals).where(eq(deals.orgId, orgId));

  const now = Date.now();
  const byStage: Record<string, { stage: string; count: number; total_value: number; avg_days_in_stage: number }> = {};
  for (const stage of OPEN_DEAL_PIPELINE_STAGES) byStage[stage] = { stage, count: 0, total_value: 0, avg_days_in_stage: 0 };

  const daysInStageSum: Record<string, number> = {};
  for (const d of allDeals) {
    if (!OPEN_DEAL_PIPELINE_STAGES.includes(d.stage)) continue;
    const bucket = byStage[d.stage];
    bucket.count += 1;
    bucket.total_value += Number(d.value ?? 0);
    const days = (now - d.stageChangedAt.getTime()) / (24 * 60 * 60 * 1000);
    daysInStageSum[d.stage] = (daysInStageSum[d.stage] ?? 0) + days;
  }
  for (const stage of OPEN_DEAL_PIPELINE_STAGES) {
    const bucket = byStage[stage];
    bucket.avg_days_in_stage = bucket.count > 0 ? daysInStageSum[stage] / bucket.count : 0;
  }

  const openDeals = allDeals.filter((d) => OPEN_DEAL_PIPELINE_STAGES.includes(d.stage));
  const totalPipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const weightedPipelineValue = openDeals.reduce((s, d) => s + (Number(d.value ?? 0) * (d.probability ?? 0)) / 100, 0);

  const wonDeals = allDeals.filter((d) => d.stage === "won");
  const lostDeals = allDeals.filter((d) => d.stage === "lost");
  const winRate = wonDeals.length + lostDeals.length > 0 ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 : 0;

  const cycleDays = wonDeals
    .filter((d) => d.actualCloseDate)
    .map((d) => (new Date(d.actualCloseDate as string).getTime() - d.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  const avgDealCycleDays = cycleDays.length > 0 ? cycleDays.reduce((s, n) => s + n, 0) / cycleDays.length : 0;

  return {
    stages: OPEN_DEAL_PIPELINE_STAGES.map((s) => byStage[s]),
    total_pipeline_value: totalPipelineValue,
    weighted_pipeline_value: weightedPipelineValue,
    avg_deal_cycle_days: avgDealCycleDays,
    win_rate_percent: winRate,
  };
}

const COMMITTED_STAGES = ["negotiation", "contract_sent"];

export async function computeForecast(
  db: OrgScopedDb,
  orgId: string,
  periodStart: string,
  periodEnd: string,
  ownerId?: string | null,
) {
  const conditions = [eq(deals.orgId, orgId), gte(deals.expectedCloseDate, periodStart), lte(deals.expectedCloseDate, periodEnd)];
  if (ownerId) conditions.push(eq(deals.ownerId, ownerId));
  const periodDeals = await db.select().from(deals).where(and(...conditions));

  const openDeals = periodDeals.filter((d) => OPEN_STAGES.includes(d.stage));
  const wonDeals = periodDeals.filter((d) => d.stage === "won");
  const committedDeals = periodDeals.filter((d) => COMMITTED_STAGES.includes(d.stage));

  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const weightedValue = openDeals.reduce((s, d) => s + (Number(d.value ?? 0) * (d.probability ?? 0)) / 100, 0);
  const committedValue = committedDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const wonValue = wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);

  const byStage: Record<string, { count: number; value: number }> = {};
  for (const d of periodDeals) {
    byStage[d.stage] = byStage[d.stage] ?? { count: 0, value: 0 };
    byStage[d.stage].count += 1;
    byStage[d.stage].value += Number(d.value ?? 0);
  }

  return {
    pipeline_value: pipelineValue,
    weighted_value: weightedValue,
    committed_value: committedValue,
    won_value: wonValue,
    deals_count: periodDeals.length,
    deals_by_stage: Object.entries(byStage).map(([stage, v]) => ({ stage, ...v })),
    deals: periodDeals,
  };
}

// Shared by app/api/crm/forecasts/route.ts and
// app/(app)/crm/forecasts/page.tsx (server-rendered initial load).
export async function getForecastForPeriod(
  db: OrgScopedDb,
  orgId: string,
  periodStart: string,
  periodEnd: string,
  period: string | null,
  ownerId?: string | null,
) {
  const forecast = await computeForecast(db, orgId, periodStart, periodEnd, ownerId);

  const targetConditions = [eq(forecastTargets.orgId, orgId)];
  if (period) targetConditions.push(eq(forecastTargets.period, period));
  if (ownerId) targetConditions.push(eq(forecastTargets.ownerId, ownerId));
  const targetRows = await db.select().from(forecastTargets).where(and(...targetConditions));
  const target = targetRows.find((t) => (ownerId ? t.ownerId === ownerId : t.ownerId === null)) ?? targetRows[0] ?? null;
  const targetValue = target?.targetValue ?? 0;

  return {
    period: period ?? `${periodStart}..${periodEnd}`,
    target_value: targetValue,
    pipeline_value: forecast.pipeline_value,
    weighted_value: forecast.weighted_value,
    committed_value: forecast.committed_value,
    won_value: forecast.won_value,
    gap: targetValue - forecast.won_value - forecast.weighted_value,
    deals_count: forecast.deals_count,
    deals_by_stage: forecast.deals_by_stage,
    deals: forecast.deals,
  };
}

// Shared by app/api/crm/forecasts/by-rep/route.ts and
// app/(app)/crm/forecasts/page.tsx.
export async function getForecastByRep(db: OrgScopedDb, orgId: string, periodStart: string, periodEnd: string, period: string | null) {
  const reps = await db.select().from(employees).where(eq(employees.orgId, orgId));
  const targets = period ? await db.select().from(forecastTargets).where(eq(forecastTargets.orgId, orgId)) : [];

  return Promise.all(
    reps.map(async (rep) => {
      const forecast = await computeForecast(db, orgId, periodStart, periodEnd, rep.id);
      const target = targets.find((t) => t.ownerId === rep.id && t.period === period);
      const targetValue = target?.targetValue ?? 0;
      return {
        owner_id: rep.id,
        owner_name: rep.fullName,
        target_value: targetValue,
        won_value: forecast.won_value,
        weighted_value: forecast.weighted_value,
        pipeline_value: forecast.pipeline_value,
        gap: targetValue - forecast.won_value - forecast.weighted_value,
      };
    }),
  );
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Builds the last N periods (ending at the current one) for a given
// period_type, each as { period, start, end } — moved here from
// app/api/crm/forecasts/trend/route.ts so app/(app)/crm/forecasts/page.tsx
// (server-rendered initial load) can call the same bucketing logic.
export function buildForecastPeriods(periodType: string, count: number) {
  const now = new Date();
  const periods: { period: string; start: string; end: string }[] = [];

  if (periodType === "monthly") {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      periods.push({ period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, start: isoDate(start), end: isoDate(end) });
    }
  } else if (periodType === "quarterly") {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    for (let i = count - 1; i >= 0; i--) {
      const totalQuarters = now.getFullYear() * 4 + currentQuarter - i;
      const year = Math.floor(totalQuarters / 4);
      const q = totalQuarters % 4;
      const start = new Date(year, q * 3, 1);
      const end = new Date(year, q * 3 + 3, 0);
      periods.push({ period: `Q${q + 1} ${year}`, start: isoDate(start), end: isoDate(end) });
    }
  } else {
    for (let i = count - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      periods.push({ period: `${year}`, start: isoDate(new Date(year, 0, 1)), end: isoDate(new Date(year, 11, 31)) });
    }
  }
  return periods;
}

// Shared by app/api/crm/forecasts/trend/route.ts and
// app/(app)/crm/forecasts/page.tsx.
export async function getForecastTrend(db: OrgScopedDb, orgId: string, periodType: string, count: number) {
  const periods = buildForecastPeriods(periodType, count);
  const targets = await db.select().from(forecastTargets).where(eq(forecastTargets.orgId, orgId));

  return Promise.all(
    periods.map(async (p) => {
      const forecast = await computeForecast(db, orgId, p.start, p.end);
      const target = targets.find((t) => t.period === p.period && t.ownerId === null);
      return {
        period: p.period,
        target: target?.targetValue ?? 0,
        won: forecast.won_value,
        weighted: forecast.weighted_value,
        pipeline: forecast.pipeline_value,
      };
    }),
  );
}

// Shared by app/api/crm/campaigns/route.ts and app/(app)/crm/campaigns/page.tsx.
export async function listAllCampaigns(db: OrgScopedDb, userId: string, orgId: string) {
  await requirePermission(db, userId, orgId, "campaign", "read");
  return db.select().from(campaigns).where(eq(campaigns.orgId, orgId));
}

// CRM Batch 3 — campaign metrics, always computed live from leads/deals
// (never stored on the campaigns row) — same reasoning as forecasts.
// Deal attribution runs through TWO paths: deals.campaignId set directly,
// OR deals.convertedFromLeadId pointing at a lead whose campaignId
// matches (a deal created by converting a campaign-attributed lead).
export async function computeCampaignMetrics(db: OrgScopedDb, orgId: string, campaignId: string) {
  const campaignLeads = await db.select().from(leads).where(and(eq(leads.orgId, orgId), eq(leads.campaignId, campaignId)));
  const leadIds = campaignLeads.map((l) => l.id);

  const allDeals = await db.select().from(deals).where(eq(deals.orgId, orgId));
  const campaignDeals = allDeals.filter(
    (d) => d.campaignId === campaignId || (d.convertedFromLeadId && leadIds.includes(d.convertedFromLeadId)),
  );

  const revenueWon = campaignDeals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value ?? 0), 0);

  return {
    leads_count: campaignLeads.length,
    deals_count: campaignDeals.length,
    revenue_won: revenueWon,
    leads: campaignLeads,
    deals: campaignDeals,
  };
}

export function campaignRoi(revenueWon: number, budgetSpent: number): number | null {
  if (!budgetSpent) return null;
  return ((revenueWon - budgetSpent) / budgetSpent) * 100;
}

// Shared by app/api/crm/campaigns/stats/route.ts and
// app/(app)/crm/campaigns/page.tsx.
export async function getCampaignsStats(db: OrgScopedDb, orgId: string) {
  const allCampaigns = await db.select().from(campaigns).where(eq(campaigns.orgId, orgId));

  const active = allCampaigns.filter((c) => c.status === "active");
  const totalBudgetAllocated = active.reduce((s, c) => s + Number(c.budgetAllocated ?? 0), 0);
  const totalBudgetSpent = active.reduce((s, c) => s + Number(c.budgetSpent ?? 0), 0);

  let totalLeads = 0;
  let best: { name: string; roi: number } | null = null;
  let worst: { name: string; roi: number } | null = null;
  for (const c of allCampaigns) {
    const metrics = await computeCampaignMetrics(db, orgId, c.id);
    totalLeads += metrics.leads_count;
    const roi = campaignRoi(metrics.revenue_won, c.budgetSpent);
    if (roi !== null) {
      if (!best || roi > best.roi) best = { name: c.name, roi };
      if (!worst || roi < worst.roi) worst = { name: c.name, roi };
    }
  }

  return {
    active_campaigns: active.length,
    total_budget_allocated: totalBudgetAllocated,
    total_budget_spent: totalBudgetSpent,
    total_leads_generated: totalLeads,
    best_performing: best,
    worst_performing: worst,
  };
}

export type Campaign = typeof campaigns.$inferSelect;

// Shared by app/api/crm/accounts/[id]/route.ts (GET) and
// app/(app)/crm/accounts/[id]/page.tsx (server-rendered initial load).
export async function getAccountDetail(db: OrgScopedDb, userId: string, id: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
  if (!account) return undefined;
  await requirePermission(db, userId, account.orgId, "account", "read");
  const [linkedContacts, accountDeals] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.accountId, id)),
    db.select().from(deals).where(eq(deals.accountId, id)),
  ]);

  const dealIds = accountDeals.map((d) => d.id);
  const relatedIds = [id, ...dealIds];
  const timeline = await db
    .select()
    .from(activities)
    .where(inArray(activities.relatedId, relatedIds))
    .orderBy(desc(activities.activityDate));
  const relevantActivities = timeline.filter(
    (a) => (a.relatedType === "account" && a.relatedId === id) || (a.relatedType === "deal" && dealIds.includes(a.relatedId)),
  );

  return { account, contacts: linkedContacts, deals: accountDeals, activities: relevantActivities };
}

// Shared by app/api/crm/deals/[id]/route.ts (GET) and
// app/(app)/crm/deals/[id]/page.tsx (server-rendered initial load). The
// page's client also fetches this account's contacts separately (its
// Contacts tab) — seeded here too so that lazy fetch is skipped on first load.
export async function getDealDetail(db: OrgScopedDb, userId: string, id: string) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  if (!deal) return undefined;
  await requirePermission(db, userId, deal.orgId, "deal", "read");

  const [account, contact, stageHistory, timeline, accountContacts] = await Promise.all([
    deal.accountId ? db.select().from(accounts).where(eq(accounts.id, deal.accountId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    deal.primaryContactId ? db.select().from(contacts).where(eq(contacts.id, deal.primaryContactId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    db.select().from(dealStageHistory).where(eq(dealStageHistory.dealId, id)).orderBy(desc(dealStageHistory.changedAt)),
    db.select().from(activities).where(eq(activities.relatedId, id)).orderBy(desc(activities.activityDate)),
    deal.accountId ? db.select().from(contacts).where(eq(contacts.accountId, deal.accountId)) : Promise.resolve([]),
  ]);

  return { deal, account, contact, stageHistory, activities: timeline.filter((a) => a.relatedType === "deal"), accountContacts };
}

// Shared by app/api/crm/campaigns/[id]/route.ts (GET) and
// app/(app)/crm/campaigns/[id]/page.tsx (server-rendered initial load).
export async function getCampaignDetail(db: OrgScopedDb, userId: string, id: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!campaign) return undefined;
  await requirePermission(db, userId, campaign.orgId, "campaign", "read");

  const metrics = await computeCampaignMetrics(db, campaign.orgId, id);
  const roi = campaignRoi(metrics.revenue_won, campaign.budgetSpent);
  const costPerLead = metrics.leads_count > 0 ? campaign.budgetSpent / metrics.leads_count : null;

  return {
    campaign,
    leads_count: metrics.leads_count,
    deals_count: metrics.deals_count,
    revenue_won: metrics.revenue_won,
    roi_percent: roi,
    cost_per_lead: costPerLead,
  };
}

// app/(app)/crm/campaigns/[id]/page.tsx's own load() fetches the campaign
// detail plus its leads/deals lists together — this mirrors that, computing
// metrics once and reusing it for all three instead of the client's three
// separate requests (each of which recomputes computeCampaignMetrics itself).
export async function getCampaignFullDetail(db: OrgScopedDb, userId: string, id: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!campaign) return undefined;
  await requirePermission(db, userId, campaign.orgId, "campaign", "read");

  const metrics = await computeCampaignMetrics(db, campaign.orgId, id);
  const roi = campaignRoi(metrics.revenue_won, campaign.budgetSpent);
  const costPerLead = metrics.leads_count > 0 ? campaign.budgetSpent / metrics.leads_count : null;

  return {
    detail: {
      campaign,
      leads_count: metrics.leads_count,
      deals_count: metrics.deals_count,
      revenue_won: metrics.revenue_won,
      roi_percent: roi,
      cost_per_lead: costPerLead,
    },
    leads: metrics.leads,
    deals: metrics.deals,
  };
}
