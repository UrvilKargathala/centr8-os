// HR Batch 2 Part 3 — Payroll & Compensation. Record-keeping only: no tax
// withholding, no statutory (PF/ESI/TDS) computation, no bank
// disbursement. Zero self-service by design (see CLAUDE.md §11a) — every
// permission check here is HR-admin-only, no manager/self fallback like
// Attendance/Leave grew.
import { and, eq, lte } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { compensationRecords, payslipRecords } from "@/db/schema";
import { requirePermission } from "./permissions";
import { requireCompensationViewAccess } from "./employees";

export function requirePayrollGenerateAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "payroll", "generate");
}
export function requirePayrollFinalizeAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "payroll", "finalize");
}
export function requirePayrollMarkPaidAccess(db: OrgScopedDb, userId: string, orgId: string) {
  return requirePermission(db, userId, orgId, "payroll", "mark_paid");
}

export type CompensationRecord = typeof compensationRecords.$inferSelect;

// The record whose [effective_date, end_date] window covers `date` — "one
// active record at a time" means at most one row should ever match, but
// this picks the most recently effective one if data is ever inconsistent.
export async function getActiveCompensationRecord(
  db: OrgScopedDb,
  employeeId: string,
  date: string,
): Promise<CompensationRecord | undefined> {
  // Only effective_date <= date is pushed into SQL; the endDate >= date
  // side is filtered in application code below rather than fighting
  // drizzle's lte(col, val) over which operand is the column.
  const rows = await db
    .select()
    .from(compensationRecords)
    .where(and(eq(compensationRecords.employeeId, employeeId), lte(compensationRecords.effectiveDate, date)));
  const candidates = rows.filter((r) => !r.endDate || r.endDate >= date);
  candidates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return candidates[0];
}

type BonusEntry = { type?: string; amount: number; currency?: string; effective_date: string; is_recurring?: boolean; notes?: string };
type DeductionEntry = { name: string; amount: number; currency?: string; is_recurring?: boolean; notes?: string };

// Weekday-agnostic calendar-day proration (payroll periods are whole
// months, not workday schedules — unlike Attendance/Leave, there's no
// "exclude weekends" concept for a salary). Overlaps the compensation
// record's effective window with the period, so a mid-period hire/
// termination gets a partial-month amount instead of the full salary.
export function prorateGross(
  baseSalary: number,
  periodStart: string,
  periodEnd: string,
  compEffectiveDate: string,
  compEndDate: string | null,
): number {
  const periodStartMs = new Date(`${periodStart}T00:00:00Z`).getTime();
  const periodEndMs = new Date(`${periodEnd}T00:00:00Z`).getTime();
  const daysInPeriod = Math.round((periodEndMs - periodStartMs) / 86_400_000) + 1;

  const overlapStartMs = Math.max(periodStartMs, new Date(`${compEffectiveDate}T00:00:00Z`).getTime());
  const overlapEndMs = compEndDate ? Math.min(periodEndMs, new Date(`${compEndDate}T00:00:00Z`).getTime()) : periodEndMs;
  const activeDays = Math.max(0, Math.round((overlapEndMs - overlapStartMs) / 86_400_000) + 1);

  if (daysInPeriod <= 0) return 0;
  const gross = (baseSalary / daysInPeriod) * activeDays;
  return Math.round(gross * 100) / 100;
}

export function bonusInPeriod(bonus: unknown, periodStart: string, periodEnd: string): number {
  if (!Array.isArray(bonus)) return 0;
  return (bonus as BonusEntry[])
    .filter((b) => b.effective_date >= periodStart && b.effective_date <= periodEnd)
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
}

export function totalDeductions(deductions: unknown): number {
  if (!Array.isArray(deductions)) return 0;
  return (deductions as DeductionEntry[]).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
}

// Monthly periods for the current + previous 12 months — the only
// frequency with real generation math right now (see compensationRecords.
// payFrequency's TODO comment in db/schema.ts).
// Shared by app/api/payroll/records/route.ts (unfiltered-by-employee case)
// and app/(app)/hr/payroll/page.tsx (server-rendered initial load for the
// most recent period). Zero self-service in this pillar, same as the route.
export async function listPayslipRecordsForPeriod(db: OrgScopedDb, userId: string, orgId: string, periodStart: string, periodEnd: string) {
  await requireCompensationViewAccess(db, userId, orgId);
  return db
    .select()
    .from(payslipRecords)
    .where(and(eq(payslipRecords.orgId, orgId), eq(payslipRecords.periodStart, periodStart), eq(payslipRecords.periodEnd, periodEnd)));
}

export function monthlyPeriods(count = 13): { period_start: string; period_end: string; label: string }[] {
  const periods: { period_start: string; period_end: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    periods.push({ period_start: start, period_end: end, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
  }
  return periods;
}
