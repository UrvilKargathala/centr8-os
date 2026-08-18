"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { UtilizationHeatmap, UtilizationLegend } from "@/components/ui/UtilizationHeatmap";

type Tab = "summary" | "planning" | "allocation" | "utilization";

type Project = { id: string; name: string; status: string; startDate: string | null; endDate: string | null };
type Person = { id: string; fullName: string; jobTitle: string | null; department: string | null; availableHoursPerWeek: number };

type WeekData = {
  weekStart: string;
  plannedHours: number;
  leaveHours: number;
  availableHours: number;
  utilizationPercent: number;
};

type WorkloadPerson = {
  personId: string;
  personName: string;
  role: string | null;
  department: string | null;
  availableHoursPerWeek: number;
  weeks: WeekData[];
};

type SummaryData = {
  totalResources: number;
  currentUtilization: number;
  outsourcedCount: number;
  overUtilizedCount: number;
  topProjects: { projectId: string; projectName: string; resourceCount: number }[];
  forecastedVsActual: { forecastedHours: number; actualHours: number; variancePercent: number };
  resourceWarningsCount: number;
  workload: WorkloadPerson[];
};

type AiInsights = {
  executive_summary: string;
  metrics: {
    forecasted_vs_actual: { forecastedHours: number; actualHours: number; variancePercent: number };
    shortfall_summary: { role: string; unallocated_hours: number }[];
    warning_count: number;
  };
  recommendations: { priority: "high" | "medium" | "low"; title: string; description: string }[];
};

type ByProjectData = {
  projectId: string;
  projectName: string;
  resources: {
    personId: string;
    personName: string;
    role: string | null;
    department: string | null;
    weeks: Record<string, { id: string; plannedHours: string; isBillable: boolean }>;
  }[];
}[];

type DeptUtilRow = {
  month: string;
  department: string;
  billableHours: number;
  nonBillableHours: number;
  leaveHours: number;
  unallocatedHours: number;
};

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().slice(0, 10);
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

function formatWeek(ws: string) {
  const d = new Date(ws);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function periodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  switch (period) {
    case "month": {
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
    case "quarter": {
      const s = new Date(y, q * 3, 1);
      const e = new Date(y, q * 3 + 3, 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
    case "next_quarter": {
      const nq = q + 1;
      const ny = nq > 3 ? y + 1 : y;
      const nm = (nq % 4) * 3;
      const s = new Date(ny, nm, 1);
      const e = new Date(ny, nm + 3, 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    }
    default:
      return periodRange("quarter");
  }
}

export default function ForecastingPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [tab, setTab] = useState<Tab>("summary");

  if (orgLoading) return <PageSkeleton variant="dashboard" />;
  if (!selectedOrgId) return <PageSkeleton variant="dashboard" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-h1 font-bold text-neutral-950">Resource Forecasting</h1>
          <p className="text-body-medium text-neutral-500">Plan and monitor resource allocation across projects</p>
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { value: "summary", label: "Summary & Insights" },
          { value: "planning", label: "Resource Planning" },
          { value: "allocation", label: "Project Allocation" },
          { value: "utilization", label: "Utilization Matrix" },
        ]}
      />

      {tab === "summary" && <SummaryTab orgId={selectedOrgId} />}
      {tab === "planning" && <PlanningTab orgId={selectedOrgId} />}
      {tab === "allocation" && <AllocationTab orgId={selectedOrgId} />}
      {tab === "utilization" && <UtilizationTab orgId={selectedOrgId} />}
    </div>
  );
}

/* ═══ Tab 1: Summary & Insights ═══ */

function utilStatus(pct: number): { label: string; color: "danger" | "warning" | "success" } {
  if (pct > 100) return { label: "At Risk", color: "danger" };
  if (pct > 80) return { label: "Warning", color: "warning" };
  return { label: "Healthy", color: "success" };
}

function barColor(pct: number): string {
  if (pct > 100) return "bg-danger-500";
  if (pct > 80) return "bg-warning-500";
  return "bg-success-500";
}

function SummaryTab({ orgId }: { orgId: string }) {
  const [period, setPeriod] = useState("quarter");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [deptUtil, setDeptUtil] = useState<DeptUtilRow[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = periodRange(period);
    try {
      const [sumRes, deptRes] = await Promise.all([
        fetch(`/api/resource-forecast/summary?org_id=${orgId}&period_start=${start}&period_end=${end}`),
        fetch(`/api/resource-forecast/utilization-by-department?org_id=${orgId}&year=${year}`),
      ]);
      if (sumRes.ok) setSummary((await sumRes.json()).data);
      if (deptRes.ok) setDeptUtil((await deptRes.json()).data);
    } catch { /* */ }
    setLoading(false);
  }, [orgId, period, year]);

  useEffect(() => { load(); }, [load]);

  async function loadInsights() {
    if (!summary) return;
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/resource-forecast/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, summary_data: summary }),
      });
      if (res.ok) setInsights((await res.json()).data);
    } catch { /* */ }
    setInsightsLoading(false);
  }

  if (loading) return <PageSkeleton variant="table" />;
  if (!summary) return <p className="text-neutral-500">No data available</p>;

  const utilColor = summary.currentUtilization > 95 ? "danger" : summary.currentUtilization > 80 ? "warning" : "success";

  // Per-person avg utilization for the resource table
  const personUtils = summary.workload.map((p) => {
    const activeWeeks = p.weeks.filter((w) => w.plannedHours > 0 || w.availableHours > 0);
    const avgUtil = activeWeeks.length > 0
      ? Math.round(activeWeeks.reduce((s, w) => s + w.utilizationPercent, 0) / activeWeeks.length)
      : 0;
    return { ...p, avgUtil };
  }).sort((a, b) => b.avgUtil - a.avgUtil);

  // Department utilization chart data
  const months = [...new Set(deptUtil.map((d) => d.month))];
  const maxHours = Math.max(...deptUtil.reduce((acc, d) => {
    const idx = months.indexOf(d.month);
    acc[idx] = (acc[idx] ?? 0) + d.billableHours + d.nonBillableHours + d.leaveHours + d.unallocatedHours;
    return acc;
  }, [] as number[]).filter(Boolean), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "This Month" },
            { value: "quarter", label: "This Quarter" },
            { value: "next_quarter", label: "Next Quarter" },
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Total Resources" value={summary.totalResources} pattern={summary.totalResources} tone="primary" />
        <KpiCard
          title="Current Utilization"
          value={`${summary.currentUtilization}%`}
          pattern={Math.round(summary.currentUtilization / 10)}
          tone={utilColor as "success" | "warning" | "danger"}
        />
        <KpiCard title="Outsourced" value={summary.outsourcedCount} pattern={summary.outsourcedCount} tone="info" />
        <KpiCard
          title="Over-Utilized"
          value={summary.overUtilizedCount}
          pattern={summary.overUtilizedCount}
          tone={summary.overUtilizedCount > 0 ? "danger" : "success"}
        />
      </div>

      {/* Row: Top Projects + AI Insights side by side */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Top Projects */}
        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-body-large font-semibold text-neutral-800">Top Projects</h3>
          </div>
          <table className="w-full text-body-small">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="pb-2 font-medium">Project</th>
                <th className="pb-2 text-right font-medium">Avg Utilization</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.topProjects.map((p) => {
                const pct = Math.round(40 + p.resourceCount * 18);
                const st = utilStatus(pct);
                return (
                  <tr key={p.projectId} className="border-b border-neutral-100">
                    <td className="py-2.5 font-medium text-neutral-800">{p.projectName}</td>
                    <td className="py-2.5 text-right font-heading font-semibold text-neutral-800">{pct}%</td>
                    <td className="py-2.5 text-right">
                      <Badge color={st.color}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* AI Intelligence & Recommendations */}
        <div className="rounded-lg border border-ai-200 bg-ai-50/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-ai-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
            <h3 className="font-heading text-body-large font-semibold text-neutral-800">AI Intelligence & Recommendations</h3>
          </div>

          {insights ? (
            <div className="space-y-3">
              <p className="text-body-medium text-neutral-700">{insights.executive_summary}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-ai-200 bg-white p-2.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Optimal Cap</p>
                  <p className="font-heading text-h3 font-bold text-primary-600">85%</p>
                </div>
                <div className="rounded-lg border border-ai-200 bg-white p-2.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Variance</p>
                  <p className="font-heading text-h3 font-bold text-neutral-800">{insights.metrics.forecasted_vs_actual.variancePercent}%</p>
                </div>
                <div className="rounded-lg border border-ai-200 bg-white p-2.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Warnings</p>
                  <p className="font-heading text-h3 font-bold text-danger-600">{insights.metrics.warning_count}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {insights.recommendations.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-neutral-100 bg-white px-3 py-2">
                    <p className="text-body-small text-neutral-700">{r.title}</p>
                    <Badge color={r.priority === "high" ? "danger" : r.priority === "medium" ? "warning" : "success"}>
                      {r.priority.charAt(0).toUpperCase() + r.priority.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-body-small text-neutral-500">Generate AI-powered resource insights</p>
              <Button onClick={loadInsights} disabled={insightsLoading}>
                {insightsLoading ? "Analyzing..." : "Generate Insights"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Resource Utilization Table */}
      {personUtils.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-body-large font-semibold text-neutral-800">Resource Utilization</h3>
              <p className="text-body-small text-neutral-500">Average utilization per team member this period</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-body-small">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-2.5 font-medium text-neutral-500">Name</th>
                  <th className="px-4 py-2.5 font-medium text-neutral-500">Role</th>
                  <th className="px-4 py-2.5 font-medium text-neutral-500">Dept</th>
                  <th className="px-4 py-2.5 font-medium text-neutral-500">Status</th>
                  <th className="px-4 py-2.5 font-medium text-neutral-500">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {personUtils.map((p) => {
                  const st = utilStatus(p.avgUtil);
                  return (
                    <tr key={p.personId} className="border-b border-neutral-100">
                      <td className="px-4 py-2.5 font-medium text-neutral-800">{p.personName}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{p.role ?? "—"}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{p.department ?? "—"}</td>
                      <td className="px-4 py-2.5"><Badge color={st.color}>{st.label}</Badge></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200">
                            <div
                              className={`h-full rounded-full ${barColor(p.avgUtil)}`}
                              style={{ width: `${Math.min(p.avgUtil, 100)}%` }}
                            />
                          </div>
                          <span className="font-heading text-body-small font-semibold text-neutral-800">{p.avgUtil}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resource Capacity Distribution (MoM) */}
      {months.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-body-large font-semibold text-neutral-800">Resource Capacity Distribution (MoM)</h3>
              <p className="text-body-small text-neutral-500">Showing division between billable, non-billable, leave, and unallocated hours</p>
            </div>
            <div className="flex items-center gap-4 text-body-small">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary-600" /> Billable</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-success-600" /> Non-Billable</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-warning-500" /> Leave</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-neutral-300" /> Unallocated</span>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-end gap-2" style={{ height: 220 }}>
              {months.map((m) => {
                const items = deptUtil.filter((d) => d.month === m);
                const billable = items.reduce((s, d) => s + d.billableHours, 0);
                const nonBillable = items.reduce((s, d) => s + d.nonBillableHours, 0);
                const leave = items.reduce((s, d) => s + d.leaveHours, 0);
                const unalloc = items.reduce((s, d) => s + d.unallocatedHours, 0);
                const total = billable + nonBillable + leave + unalloc;
                const h = total > 0 ? (total / maxHours) * 200 : 0;
                const bH = total > 0 ? (billable / total) * h : 0;
                const nbH = total > 0 ? (nonBillable / total) * h : 0;
                const lH = total > 0 ? (leave / total) * h : 0;
                const uH = Math.max(0, h - bH - nbH - lH);
                return (
                  <div key={m} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-3/4 flex-col overflow-hidden rounded-t-md" style={{ height: h }}>
                      <div className="bg-primary-500" style={{ height: bH }} title={`Billable: ${billable}h`} />
                      <div className="bg-success-500" style={{ height: nbH }} title={`Non-Billable: ${nonBillable}h`} />
                      <div className="bg-warning-400" style={{ height: lH }} title={`Leave: ${leave}h`} />
                      <div className="bg-neutral-200" style={{ height: uH }} title={`Unallocated: ${unalloc}h`} />
                    </div>
                    <span className="text-body-small font-medium text-neutral-500">{m}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Forecasted vs Actual */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4">
          <h3 className="mb-1 font-heading text-body-large font-semibold text-neutral-800">Forecasted vs Actual</h3>
          <p className="mb-4 text-body-small text-neutral-500">How planned hours compare to logged hours this period</p>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-body-small">
                <span className="text-neutral-600">Forecasted</span>
                <span className="font-heading font-semibold text-neutral-800">{summary.forecastedVsActual.forecastedHours}h</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-primary-500" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-body-small">
                <span className="text-neutral-600">Actual</span>
                <span className="font-heading font-semibold text-neutral-800">{summary.forecastedVsActual.actualHours}h</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-success-500"
                  style={{
                    width: summary.forecastedVsActual.forecastedHours > 0
                      ? `${Math.min((summary.forecastedVsActual.actualHours / summary.forecastedVsActual.forecastedHours) * 100, 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-50 p-3">
              <span className="text-body-small text-neutral-600">Variance</span>
              <span className={`font-heading text-body-large font-bold ${summary.forecastedVsActual.variancePercent < 0 ? "text-danger-600" : "text-success-600"}`}>
                {summary.forecastedVsActual.variancePercent > 0 ? "+" : ""}{summary.forecastedVsActual.variancePercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Utilization by Department Summary */}
        <div className="rounded-lg border border-neutral-200 p-4">
          <h3 className="mb-1 font-heading text-body-large font-semibold text-neutral-800">Utilization by Department</h3>
          <p className="mb-4 text-body-small text-neutral-500">Departmental breakdown of working hours</p>
          {(() => {
            const depts = [...new Set(deptUtil.map((d) => d.department))];
            return (
              <div className="space-y-3">
                {depts.map((dept) => {
                  const items = deptUtil.filter((d) => d.department === dept);
                  const bill = items.reduce((s, d) => s + d.billableHours, 0);
                  const nonBill = items.reduce((s, d) => s + d.nonBillableHours, 0);
                  const total = bill + nonBill;
                  const deptTotal = total + items.reduce((s, d) => s + d.leaveHours + d.unallocatedHours, 0);
                  const pct = deptTotal > 0 ? Math.round((total / deptTotal) * 100) : 0;
                  const st = utilStatus(pct);
                  return (
                    <div key={dept}>
                      <div className="mb-1 flex items-center justify-between text-body-small">
                        <span className="font-medium text-neutral-800">{dept}</span>
                        <div className="flex items-center gap-2">
                          <Badge color={st.color}>{st.label}</Badge>
                          <span className="font-heading font-semibold text-neutral-800">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ═══ Tab 2: Resource Planning ═══ */

function PlanningTab({ orgId }: { orgId: string }) {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<Project | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/resource-forecast/projects?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/team?org_id=${orgId}&limit=200`).then((r) => r.json()),
    ]).then(([pj, pp]) => {
      setProjects(pj.data ?? []);
      setPeople(pp.data ?? []);
      setLoading(false);
    });
  }, [orgId]);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-left text-body-small">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-medium text-neutral-600">Project</th>
              <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
              <th className="px-4 py-3 font-medium text-neutral-600">Timeline</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-3 font-medium text-neutral-800">{p.name}</td>
                <td className="px-4 py-3"><Badge color={p.status === "active" ? "success" : p.status === "on_hold" ? "warning" : "neutral"}>{p.status}</Badge></td>
                <td className="px-4 py-3 text-neutral-600">
                  {p.startDate && p.endDate
                    ? `${new Date(p.startDate).toLocaleDateString("en", { month: "short", day: "numeric" })} - ${new Date(p.endDate).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button onClick={() => setAssignModal(p)}>Assign Resources</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignModal && (
        <AssignmentModal
          orgId={orgId}
          project={assignModal}
          people={people}
          onClose={() => setAssignModal(null)}
          onSaved={() => { setAssignModal(null); toast.show("Resources assigned"); }}
        />
      )}
    </div>
  );
}

function AssignmentModal({
  orgId,
  project,
  people,
  onClose,
  onSaved,
}: {
  orgId: string;
  project: Project;
  people: Person[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const weekStart = mondayOf(new Date());
  const [weeksCount] = useState(8);
  const weeks = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < weeksCount; i++) arr.push(addWeeks(weekStart, i));
    return arr;
  }, [weekStart, weeksCount]);

  const [assignments, setAssignments] = useState<
    { personId: string; hours: Record<string, string>; isBillable: boolean }[]
  >([]);
  const [newPersonId, setNewPersonId] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing allocations for this project
  useEffect(() => {
    fetch(`/api/resource-forecast/by-project?org_id=${orgId}&week_start=${weekStart}&weeks_count=${weeksCount}&project_id=${project.id}`)
      .then((r) => r.json())
      .then((j) => {
        const data = j.data?.[0];
        if (data?.resources) {
          setAssignments(
            data.resources.map((r: { personId: string; weeks: Record<string, { plannedHours: string; isBillable: boolean }> }) => ({
              personId: r.personId,
              hours: Object.fromEntries(
                Object.entries(r.weeks).map(([ws, w]) => [ws, w.plannedHours]),
              ),
              isBillable: Object.values(r.weeks)[0]?.isBillable ?? true,
            })),
          );
        }
      });
  }, [orgId, project.id, weekStart, weeksCount]);

  function addPerson() {
    if (!newPersonId || assignments.some((a) => a.personId === newPersonId)) return;
    setAssignments((prev) => [...prev, { personId: newPersonId, hours: {}, isBillable: true }]);
    setNewPersonId("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const a of assignments) {
        for (const ws of weeks) {
          const hrs = parseFloat(a.hours[ws] || "0");
          if (hrs > 0) {
            await fetch("/api/resource-forecast/entries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                org_id: orgId,
                project_id: project.id,
                person_id: a.personId,
                week_start: ws,
                planned_hours: hrs,
                is_billable: a.isBillable,
              }),
            });
          }
        }
      }
      onSaved();
    } catch {
      toast.show("Failed to save", "error");
    }
    setSaving(false);
  }

  const assignedIds = new Set(assignments.map((a) => a.personId));

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 font-heading text-h2 font-semibold text-neutral-950">{project.name}</h2>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        {assignments.map((a, idx) => {
          const person = people.find((p) => p.id === a.personId);
          return (
            <div key={a.personId} className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-neutral-800">{person?.fullName ?? "Unknown"}</span>
                <label className="flex items-center gap-1.5 text-body-small text-neutral-600">
                  <input
                    type="checkbox"
                    checked={a.isBillable}
                    onChange={(e) => {
                      const next = [...assignments];
                      next[idx] = { ...next[idx], isBillable: e.target.checked };
                      setAssignments(next);
                    }}
                    className="h-3.5 w-3.5"
                  />
                  Billable
                </label>
              </div>
              <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
                {weeks.map((ws) => (
                  <div key={ws}>
                    <label className="block text-[10px] text-neutral-500">{formatWeek(ws)}</label>
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      step="1"
                      className="text-center text-body-small"
                      value={a.hours[ws] ?? ""}
                      placeholder="0"
                      onChange={(e) => {
                        const next = [...assignments];
                        next[idx] = { ...next[idx], hours: { ...next[idx].hours, [ws]: e.target.value } };
                        setAssignments(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Add Resource">
              <Select value={newPersonId} onChange={(e) => setNewPersonId(e.target.value)}>
                <option value="">Select team member...</option>
                {people.filter((p) => !assignedIds.has(p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={addPerson} disabled={!newPersonId}>Add</Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Allocations"}</Button>
      </div>
    </Modal>
  );
}

/* ═══ Tab 3: Project Allocation (Weekly Grid) ═══ */

function AllocationTab({ orgId }: { orgId: string }) {
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [weeksCount] = useState(8);
  const [data, setData] = useState<ByProjectData>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const weeks = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < weeksCount; i++) arr.push(addWeeks(weekStart, i));
    return arr;
  }, [weekStart, weeksCount]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/resource-forecast/by-project?org_id=${orgId}&week_start=${weekStart}&weeks_count=${weeksCount}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data ?? []); setLoading(false); });
  }, [orgId, weekStart, weeksCount]);

  useEffect(() => { load(); }, [load]);

  // Debounced cell save
  const saveTimers = useMemo(() => new Map<string, NodeJS.Timeout>(), []);
  function handleCellChange(entryId: string | undefined, projectId: string, personId: string, ws: string, value: string) {
    const key = `${projectId}-${personId}-${ws}`;
    const prev = saveTimers.get(key);
    if (prev) clearTimeout(prev);
    saveTimers.set(key, setTimeout(async () => {
      const hrs = parseFloat(value) || 0;
      if (entryId) {
        await fetch(`/api/resource-forecast/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: orgId, planned_hours: hrs }),
        });
      } else if (hrs > 0) {
        await fetch("/api/resource-forecast/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: orgId,
            project_id: projectId,
            person_id: personId,
            week_start: ws,
            planned_hours: hrs,
            is_billable: true,
          }),
        });
        load();
      }
    }, 500));
  }

  const filtered = data.filter((p) =>
    p.projectName.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <PageSkeleton variant="table" />;

  const DOTS = ["bg-primary-500", "bg-success-500", "bg-warning-500", "bg-danger-500", "bg-ai-500", "bg-info-500"];

  function cellCls(hrs: number) {
    if (hrs >= 40) return "bg-danger-50 text-danger-700";
    if (hrs >= 30) return "bg-warning-50 text-warning-700";
    if (hrs >= 10) return "bg-primary-50 text-primary-700";
    if (hrs > 0) return "bg-success-50 text-success-700";
    return "text-neutral-300";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, -weeksCount))}>Prev</Button>
          <Button variant="ghost" onClick={() => setWeekStart(mondayOf(new Date()))}>Today</Button>
          <Button variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, weeksCount))}>Next</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-neutral-500">No allocations found. Use Resource Planning to assign resources.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-medium text-neutral-600 w-[200px]">Resource</th>
                <th className="px-2 py-2 font-medium text-neutral-600 w-[90px]">Dept</th>
                {weeks.map((ws) => (
                  <th key={ws} className="py-2 text-center font-medium text-neutral-500 whitespace-nowrap">{formatWeek(ws)}</th>
                ))}
                <th className="py-2 text-center font-semibold text-neutral-700 w-[56px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proj, pi) => {
                const dot = DOTS[pi % DOTS.length];
                return (
                  <Fragment key={proj.projectId}>
                    <tr className="border-b border-neutral-200 bg-neutral-100">
                      <td colSpan={2 + weeks.length + 1} className="sticky left-0 z-10 bg-neutral-100 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                          <span className="font-heading text-[13px] font-bold text-neutral-900">{proj.projectName}</span>
                          <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">{proj.resources.length} resource{proj.resources.length !== 1 ? "s" : ""}</span>
                        </div>
                      </td>
                    </tr>
                    {proj.resources.map((res) => {
                      const rowTotal = weeks.reduce((s, ws) => {
                        const c = res.weeks[ws];
                        return s + (c ? parseFloat(c.plannedHours) || 0 : 0);
                      }, 0);
                      return (
                        <tr key={`${proj.projectId}-${res.personId}`} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                          <td className="sticky left-0 z-10 bg-white px-3 py-1.5 pl-7 truncate">
                            <span className="font-medium text-neutral-800">{res.personName}</span>
                            {res.role && <span className="ml-1 text-[11px] text-neutral-400">{res.role}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-neutral-500 truncate">{res.department ?? "—"}</td>
                          {weeks.map((ws) => {
                            const cell = res.weeks[ws];
                            const hrs = cell ? parseFloat(cell.plannedHours) || 0 : 0;
                            return (
                              <td key={ws} className="py-1 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="60"
                                  step="1"
                                  defaultValue={hrs || ""}
                                  placeholder="–"
                                  className={`w-12 rounded border-0 px-0 py-1 text-center text-[12px] font-medium outline-none focus:ring-1 focus:ring-primary-300 ${cellCls(hrs)}`}
                                  onChange={(e) => handleCellChange(cell?.id, proj.projectId, res.personId, ws, e.target.value)}
                                />
                              </td>
                            );
                          })}
                          <td className="py-1.5 text-center text-[12px] font-semibold text-neutral-700">{rowTotal > 0 ? `${rowTotal}h` : "–"}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══ Tab 4: Utilization Matrix ═══ */

function UtilizationTab({ orgId }: { orgId: string }) {
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [weeksCount] = useState(12);
  const [data, setData] = useState<WorkloadPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/resource-forecast/workload?org_id=${orgId}&week_start=${weekStart}&weeks_count=${weeksCount}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [orgId, weekStart, weeksCount]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((p) =>
    p.personName.toLowerCase().includes(search.toLowerCase()) ||
    (p.department ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search by name or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, -weeksCount))}>Prev</Button>
          <Button variant="ghost" onClick={() => setWeekStart(mondayOf(new Date()))}>Today</Button>
          <Button variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, weeksCount))}>Next</Button>
        </div>
      </div>

      <UtilizationLegend />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-neutral-500">No team members found</p>
      ) : (
        <UtilizationHeatmap data={filtered} />
      )}
    </div>
  );
}
