// CRM Batch 1 — Leads, Contacts, Accounts. Shared "sales-team working
// set" tier (owner/admin/member get full CRUD, viewer read-only — same as
// lead/contact/account/deal/activity's existing grid), with lead
// conversion and reassignment as separate, more tightly-held actions
// (lead:convert, */assign) layered on top.
import { and, eq, gte, lte } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { accounts, activities, campaigns, contacts, dealStageHistory, deals, employees, leads } from "@/db/schema";
import { ApiError } from "./helpers";
import { requirePermission } from "./permissions";

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

export type Campaign = typeof campaigns.$inferSelect;
