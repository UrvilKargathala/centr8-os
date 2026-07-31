"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { DealStageBadge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { fmtMoney, isStale } from "../deals/page";

type PeriodType = "monthly" | "quarterly" | "annual";
type Deal = {
  id: string;
  name: string;
  accountId: string | null;
  ownerId: string | null;
  stage: string;
  probability: number | null;
  value: number | null;
  currency: string;
  expectedCloseDate: string | null;
  stageChangedAt: string;
};
type Forecast = {
  period: string;
  target_value: number;
  pipeline_value: number;
  weighted_value: number;
  committed_value: number;
  won_value: number;
  gap: number;
  deals_count: number;
  deals: Deal[];
};
type ByRep = { owner_id: string; owner_name: string; target_value: number; won_value: number; weighted_value: number; pipeline_value: number; gap: number };
type TrendPoint = { period: string; target: number; won: number; weighted: number; pipeline: number };
type Account = { id: string; name: string };
type Employee = { id: string; fullName: string };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Mirrors buildPeriods' bucketing in app/api/crm/forecasts/trend/route.ts, but
// only for the current period (no need to duplicate a full N-period loop here).
function currentPeriod(periodType: PeriodType) {
  const now = new Date();
  if (periodType === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, start: isoDate(start), end: isoDate(end) };
  }
  if (periodType === "quarterly") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { period: `Q${q + 1} ${now.getFullYear()}`, start: isoDate(start), end: isoDate(end) };
  }
  return { period: `${now.getFullYear()}`, start: isoDate(new Date(now.getFullYear(), 0, 1)), end: isoDate(new Date(now.getFullYear(), 11, 31)) };
}

export default function ForecastsPage() {
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [ownerId, setOwnerId] = useState("");
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [byRep, setByRep] = useState<ByRep[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTarget, setShowTarget] = useState(false);

  const canSetTarget = can("forecast", "set_target");
  const period = useMemo(() => currentPeriod(periodType), [periodType]);

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    const forecastParams = new URLSearchParams({
      org_id: selectedOrgId,
      period_start: period.start,
      period_end: period.end,
      period: period.period,
    });
    if (ownerId) forecastParams.set("owner_id", ownerId);
    Promise.all([
      fetch(`/api/crm/forecasts?${forecastParams}`).then((r) => r.json()),
      fetch(`/api/crm/forecasts/by-rep?org_id=${selectedOrgId}&period_start=${period.start}&period_end=${period.end}&period=${period.period}`).then((r) => r.json()),
      fetch(`/api/crm/forecasts/trend?org_id=${selectedOrgId}&period_type=${periodType}&count=6`).then((r) => r.json()),
      fetch(`/api/crm/accounts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([f, r, t, a, e]) => {
        setForecast(f.data ?? null);
        setByRep(r.data ?? []);
        setTrend(t.data ?? []);
        setAccounts(a.data ?? []);
        setEmployees(e.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [selectedOrgId, periodType, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "No account";
  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "Unassigned";

  const sortedDeals = useMemo(() => [...(forecast?.deals ?? [])].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)), [forecast]);
  const sortedByRep = useMemo(() => [...byRep].sort((a, b) => a.gap - b.gap), [byRep]);
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.target, t.won + t.weighted, t.pipeline)));

  const analyzeAI = useAiCall<string>("Analyst", "analyze_forecast");
  const actionsAI = useAiCall<{ actions: { action: string; deal_name: string; reasoning: string }[] }>("Planner", "suggest_pipeline_actions");

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("forecast", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to forecasts.</p>;
  if (!forecast) return <p className="text-body text-neutral-600">No forecast data.</p>;

  const dealByName = (name: string) => sortedDeals.find((d) => d.name === name);
  const openDeals = sortedDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const staleNames = openDeals.filter((d) => isStale(d.stageChangedAt)).map((d) => d.name);
  const overdueNames = openDeals.filter((d) => d.expectedCloseDate && new Date(d.expectedCloseDate) < new Date()).map((d) => d.name);
  const negotiationNames = openDeals.filter((d) => d.stage === "negotiation" || d.stage === "contract_sent").map((d) => d.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Sales Forecasts</h1>
          <p className="text-body text-neutral-600">Pipeline health and revenue targets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Field label="Owner">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">All reps</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex w-fit gap-1 rounded-md border border-neutral-300 p-0.5">
            {(["monthly", "quarterly", "annual"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setPeriodType(v)}
                className={`rounded-sm px-3 py-1 text-small font-medium capitalize ${periodType === v ? "bg-danger-600 text-neutral-50" : "text-neutral-600"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Target ({forecast.period})</p>
          {forecast.target_value === 0 ? (
            <>
              <p className="text-body-medium text-neutral-600">No target set</p>
              {canSetTarget && (
                <Button variant="secondary" className="mt-1" onClick={() => setShowTarget(true)}>
                  + Set Target
                </Button>
              )}
            </>
          ) : (
            <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(forecast.target_value, "INR")}</p>
          )}
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Won</p>
          <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(forecast.won_value, "INR")}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Weighted Pipeline</p>
          <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(forecast.weighted_value, "INR")}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Total Pipeline</p>
          <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(forecast.pipeline_value, "INR")}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Gap to Target</p>
          <p className={`text-h3 font-semibold ${forecast.gap <= 0 ? "text-success-600" : "text-danger-600"}`}>{fmtMoney(forecast.gap, "INR")}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <AiButton
          label="Analyze forecast"
          loading={analyzeAI.loading}
          onClick={() =>
            analyzeAI.run({
              target_value: forecast.target_value,
              won_value: forecast.won_value,
              weighted_value: forecast.weighted_value,
              gap: forecast.gap,
              period: forecast.period,
              top_deal_names: sortedDeals.slice(0, 3).map((d) => d.name),
            })
          }
        />
        <AiButton
          label="Suggest pipeline actions"
          loading={actionsAI.loading}
          onClick={() => actionsAI.run({ stale_deal_names: staleNames, overdue_deal_names: overdueNames, negotiation_deal_names: negotiationNames })}
        />
      </div>
      {analyzeAI.result && (
        <AiSuggestionCard onAccept={() => analyzeAI.setResult(null)} onReject={() => analyzeAI.setResult(null)}>
          <p className="text-body text-neutral-950">{analyzeAI.result}</p>
        </AiSuggestionCard>
      )}
      {actionsAI.result && (
        <AiSuggestionCard onAccept={() => actionsAI.setResult(null)} onReject={() => actionsAI.setResult(null)}>
          <div className="space-y-2">
            {actionsAI.result.actions.map((a, i) => {
              const deal = dealByName(a.deal_name);
              return (
                <div key={i} className="rounded-sm border border-neutral-200 p-2">
                  <p className="text-body-medium font-medium text-neutral-950">{a.action}</p>
                  {deal ? (
                    <button className="text-small text-danger-600 underline" onClick={() => router.push(`/crm/deals/${deal.id}`)}>
                      {a.deal_name}
                    </button>
                  ) : (
                    <p className="text-small text-neutral-600">{a.deal_name}</p>
                  )}
                  <p className="text-caption text-neutral-500">{a.reasoning}</p>
                </div>
              );
            })}
          </div>
        </AiSuggestionCard>
      )}

      <Card>
        <h3 className="text-body-medium font-semibold text-neutral-950">Target vs. Won vs. Weighted — last 6 periods</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-caption text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-neutral-400" /> Target
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-danger-600" /> Won
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-danger-300" /> Weighted
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {trend.map((t) => (
            <div key={t.period} className="space-y-1">
              <div className="flex items-center justify-between text-caption text-neutral-600">
                <span>{t.period}</span>
                <span>{fmtMoney(t.target, "INR")} target</span>
              </div>
              <div className="relative h-4 rounded-sm bg-neutral-200">
                <div className="absolute inset-y-0 left-0 flex">
                  <div className="h-4 rounded-l-sm bg-danger-600" style={{ width: `${(t.won / maxTrend) * 100}%` }} />
                  <div className="h-4 bg-danger-300" style={{ width: `${(t.weighted / maxTrend) * 100}%` }} />
                </div>
                {t.target > 0 && <div className="absolute inset-y-0 w-0.5 bg-neutral-950" style={{ left: `${Math.min(100, (t.target / maxTrend) * 100)}%` }} />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">Deals closing this period</h3>
          {sortedDeals.length === 0 ? (
            <p className="text-small text-neutral-600">No deals expected to close in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Prob.</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeals.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/crm/deals/${d.id}`)}>
                    <TableCell>
                      <p className="font-medium text-neutral-950">{d.name}</p>
                      <p className="text-caption text-neutral-500">{accountName(d.accountId)}</p>
                    </TableCell>
                    <TableCell>{fmtMoney(d.value, d.currency)}</TableCell>
                    <TableCell>
                      <DealStageBadge stage={d.stage} />
                    </TableCell>
                    <TableCell>{d.probability ?? 0}%</TableCell>
                    <TableCell>{d.expectedCloseDate ?? "—"}</TableCell>
                    <TableCell>{employeeName(d.ownerId)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {!ownerId && (
          <Card>
            <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">By rep</h3>
            {sortedByRep.length === 0 ? (
              <p className="text-small text-neutral-600">No reps found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Won</TableHead>
                    <TableHead>Weighted</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByRep.map((r) => (
                    <TableRow key={r.owner_id} className="cursor-pointer" onClick={() => setOwnerId(r.owner_id)}>
                      <TableCell>{r.owner_name}</TableCell>
                      <TableCell>{fmtMoney(r.target_value, "INR")}</TableCell>
                      <TableCell>{fmtMoney(r.won_value, "INR")}</TableCell>
                      <TableCell>{fmtMoney(r.weighted_value, "INR")}</TableCell>
                      <TableCell>{fmtMoney(r.pipeline_value, "INR")}</TableCell>
                      <TableCell className={r.gap <= 0 ? "text-success-600" : "text-danger-600"}>{fmtMoney(r.gap, "INR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}
      </div>

      {showTarget && (
        <SetTargetModal
          orgId={selectedOrgId}
          period={period}
          periodType={periodType}
          ownerId={ownerId || null}
          onClose={() => setShowTarget(false)}
          onSaved={() => {
            setShowTarget(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function SetTargetModal({
  orgId,
  period,
  periodType,
  ownerId,
  onClose,
  onSaved,
}: {
  orgId: string;
  period: { period: string; start: string; end: string };
  periodType: PeriodType;
  ownerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [targetValue, setTargetValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/forecasts/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        period: period.period,
        period_type: periodType,
        period_start: period.start,
        period_end: period.end,
        target_value: Number(targetValue),
        owner_id: ownerId,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to set target");
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">Set Target — {period.period}</h2>
      <div className="mt-4 space-y-3">
        <Field label="Target value">
          <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
        </Field>
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving || !targetValue}>
            {saving ? "Saving…" : "Save Target"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
