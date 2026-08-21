"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { useAiUsage } from "@/lib/context/AiUsageContext";
import { Badge, projectStatusColor, cardAccentClass, type BadgeColor } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import { PROJECT_STATUSES } from "@/lib/constants";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";

type HealthSnapshot = {
  projectId: string;
  projectName: string;
  aiSummary: string;
  signals: { overdueTasks: number; blockedTasks: number };
};
type Recommendation = {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  category: string;
  action_type: string;
};
type Briefing = {
  summary: string;
  highlights: { type: "positive" | "warning" | "action_needed"; text: string }[];
};
type ActivityItem = {
  type: string;
  pillar: string;
  title: string;
  description: string;
  actor_name: string | null;
  timestamp: string;
};
type DashData = {
  projects: { total: number; active: number; at_risk: number; completed: number } | null;
  tasks: { total: number; pending: number; in_progress: number; in_review: number; completed: number; overdue: number; completed_trend_percent: number | null } | null;
  employees: { total: number; active: number; onboarding: number; on_leave: number } | null;
  attendance: { checked_in_today: number; attendance_rate_percent: number | null } | null;
  leave: { pending_requests: number; on_leave_today: number } | null;
  open_hr_cases: number | null;
  leads: { total: number; new_this_month: number; qualified: number; conversion_rate_percent: number | null } | null;
  deals: { open_pipeline_value: number; weighted_pipeline_value: number; deals_to_close_this_month: number; win_rate_percent: number | null; value_trend_percent: number | null; by_stage: Record<string, number> } | null;
  accounts: { total: number; customers: number } | null;
  ai: { pending_sprint_plans: number | null; documents_in_draft: number | null } | null;
  recent_activity: ActivityItem[];
  sprints: { active_count: number; avg_progress_percent: number } | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TrendPill({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const positive = percent >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-caption font-medium ${positive ? "bg-success-100 text-success-600" : "bg-danger-100 text-danger-600"}`}>
      <svg className={`h-2.5 w-2.5 ${positive ? "" : "rotate-180"}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 3l6 7h-4v7H8v-7H4l6-7z" />
      </svg>
      {Math.abs(percent)}%
    </span>
  );
}

const PILLAR_ICON: Record<string, string> = {
  pm: "bg-primary-100 text-primary-600",
  hr: "bg-success-100 text-success-600",
  crm: "bg-warning-100 text-warning-600",
  ai: "bg-ai-100 text-ai-600",
};

const PILLAR_LABEL: Record<string, string> = {
  pm: "Project", hr: "HR", crm: "CRM", ai: "AI",
};

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; dot: string; badge: BadgeColor }> = {
  critical: { bg: "bg-danger-50", text: "text-danger-700", dot: "bg-danger-500", badge: "danger" },
  high: { bg: "bg-warning-50", text: "text-warning-700", dot: "bg-warning-500", badge: "warning" },
  medium: { bg: "bg-info-50", text: "text-info-700", dot: "bg-info-500", badge: "info" },
};

const STAGE_COLORS: Record<string, string> = {
  prospecting: "bg-neutral-400",
  discovery: "bg-info-400",
  proposal: "bg-primary-500",
  negotiation: "bg-warning-500",
  contract_sent: "bg-success-500",
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function HealthIcon({ color }: { color: "danger" | "warning" | "success" }) {
  if (color === "success") return (
    <svg className="h-4 w-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (color === "warning") return (
    <svg className="h-4 w-4 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
  return (
    <svg className="h-4 w-4 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ActivityIcon({ pillar }: { pillar: string }) {
  const cls = PILLAR_ICON[pillar] ?? PILLAR_ICON.pm;
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase ${cls}`}>
      {PILLAR_LABEL[pillar]?.[0] ?? "P"}
    </span>
  );
}

export default function ExecutivePage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const { increment: incrementAi, cache: aiCache } = useAiUsage();
  const [data, setData] = useState<DashData | null>(null);
  const [health, setHealth] = useState<HealthSnapshot[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { result: briefing, loading: briefingLoading, run: runBriefing } = useAiCall<Briefing>("Analyst", "daily_briefing");

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/dashboard?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/ai/project-health?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([dashBody, healthBody]) => {
        if (!dashBody.data) throw new Error(dashBody.error ?? "Failed to load");
        setData(dashBody.data);
        setHealth(healthBody.data ?? []);
        const cachedRecs = aiCache.get(`exec_recs_${selectedOrgId}`) as Recommendation[] | undefined;
        if (cachedRecs) setRecommendations(cachedRecs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadRecommendations() {
    if (!selectedOrgId || recsLoading) return;
    setRecsLoading(true);
    fetch(`/api/ai/recommendations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const result = body.data ?? [];
        setRecommendations(result);
        aiCache.set(`exec_recs_${selectedOrgId}`, result);
        incrementAi();
      })
      .finally(() => setRecsLoading(false));
  }

  function handleBriefing() {
    if (!selectedOrgId || !data) return;
    runBriefing({ org_id: selectedOrgId, dashboard_data: data });
  }

  if (orgLoading || loading) return <PageSkeleton variant="dashboard" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  if (!data) return null;

  const countsByStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0]));
  const healthByProject: Record<string, HealthSnapshot> = {};
  health.forEach((h) => { healthByProject[h.projectId] = h; });

  if (data.projects) {
    PROJECT_STATUSES.forEach((s) => {
      const count = s === "active" ? data.projects!.active : s === "completed" ? data.projects!.completed : s === "planning" ? (data.projects!.total - data.projects!.active - data.projects!.completed - data.projects!.at_risk) : 0;
      countsByStatus[s] = Math.max(0, count);
    });
  }

  const totalStageDeals = data.deals?.by_stage ? Object.values(data.deals.by_stage).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-h1 font-semibold text-neutral-950">Executive Dashboard</h1>
          <p className="text-body-small text-neutral-500">Cross-pillar overview and strategic insights</p>
        </div>
        <AiButton label="AI Strategic Briefing" loading={briefingLoading} onClick={handleBriefing} />
      </div>

      {/* AI Strategic Briefing */}
      {briefing && (
        <div className="glass-card rounded-lg border-ai-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-ai-600 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-white">AI Strategic Briefing</span>
          </div>
          <p className="text-body-small text-neutral-800">{briefing.summary}</p>
          <div className="flex flex-wrap gap-2">
            {briefing.highlights.map((h, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ${
                h.type === "positive" ? "bg-success-100 text-success-700" :
                h.type === "warning" ? "bg-warning-100 text-warning-700" :
                "bg-danger-100 text-danger-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  h.type === "positive" ? "bg-success-500" : h.type === "warning" ? "bg-warning-500" : "bg-danger-500"
                }`} />
                {h.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cross-Pillar KPIs — 3x3 grid */}
      <section className="space-y-3">
        <h2 className="text-h3 font-semibold text-neutral-800">Portfolio Overview</h2>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard title="Active Projects" value={data.projects?.active ?? 0} pattern={data.projects?.active ?? 0} tone="primary" trend={data.projects?.at_risk ? { text: `${data.projects.at_risk} at risk`, positive: false } : undefined} />
          <KpiCard title="Tasks Overdue" value={data.tasks?.overdue ?? 0} pattern={data.tasks?.overdue ?? 0} tone={(data.tasks?.overdue ?? 0) > 0 ? "danger" : "success"} trend={data.tasks?.completed_trend_percent !== null && data.tasks?.completed_trend_percent !== undefined ? { text: `${data.tasks.completed_trend_percent >= 0 ? "+" : ""}${data.tasks.completed_trend_percent}% completions WoW`, positive: data.tasks.completed_trend_percent >= 0 } : undefined} />
          <KpiCard title="Sprint Progress" value={data.sprints ? `${data.sprints.avg_progress_percent}%` : "—"} pattern={data.sprints?.avg_progress_percent ?? 0} tone="info" trend={data.sprints ? { text: `${data.sprints.active_count} active sprint${data.sprints.active_count !== 1 ? "s" : ""}`, positive: true } : undefined} />

          <KpiCard title="Total Employees" value={data.employees?.total ?? 0} pattern={data.employees?.total ?? 0} tone="success" trend={data.employees?.onboarding ? { text: `${data.employees.onboarding} onboarding`, positive: true } : undefined} />
          <KpiCard title="Pending Leave" value={data.leave?.pending_requests ?? 0} pattern={data.leave?.pending_requests ?? 0} tone={(data.leave?.pending_requests ?? 0) > 3 ? "warning" : "neutral"} trend={data.leave?.on_leave_today ? { text: `${data.leave.on_leave_today} on leave today` } : undefined} />
          <KpiCard title="Open HR Cases" value={data.open_hr_cases ?? 0} pattern={data.open_hr_cases ?? 0} tone={(data.open_hr_cases ?? 0) > 0 ? "warning" : "success"} />

          <KpiCard title="Pipeline Value" value={data.deals ? fmt(data.deals.weighted_pipeline_value) : "—"} pattern={data.deals?.deals_to_close_this_month ?? 0} tone="warning" trend={data.deals?.value_trend_percent != null ? { text: `${data.deals.value_trend_percent >= 0 ? "+" : ""}${data.deals.value_trend_percent}% MoM`, positive: data.deals.value_trend_percent >= 0 } : undefined} />
          <KpiCard title="Active Leads" value={data.leads?.total ?? 0} pattern={data.leads?.new_this_month ?? 0} tone="info" trend={data.leads?.new_this_month ? { text: `${data.leads.new_this_month} new this month`, positive: true } : undefined} />
          <KpiCard title="Win Rate" value={data.deals?.win_rate_percent != null ? `${data.deals.win_rate_percent}%` : "—"} pattern={data.deals?.win_rate_percent ?? 0} tone={(data.deals?.win_rate_percent ?? 0) >= 30 ? "success" : "neutral"} trend={data.deals?.deals_to_close_this_month ? { text: `${data.deals.deals_to_close_this_month} closing soon`, positive: true } : undefined} />
        </div>
      </section>

      {/* Project Health + Revenue & Pipeline — side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Health */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-neutral-800">Project Health</h2>
            <span className="text-caption text-neutral-400">{health.length} project{health.length !== 1 ? "s" : ""}</span>
          </div>
          {health.length === 0 ? (
            <div className="glass-card rounded-lg p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-body-small text-neutral-500">No health data available</p>
              <p className="text-caption text-neutral-400">Run a health scan to see project status</p>
            </div>
          ) : (
            <div className="space-y-3">
              {health.map((snap) => {
                const color: "danger" | "warning" | "success" = snap.signals.overdueTasks > 0 ? "danger" : snap.signals.blockedTasks > 0 ? "warning" : "success";
                const borderCls = color === "danger" ? "border-l-danger-500" : color === "warning" ? "border-l-warning-500" : "border-l-success-500";
                const totalIssues = snap.signals.overdueTasks + snap.signals.blockedTasks;
                return (
                  <div key={snap.projectId} className={`glass-card rounded-lg border-l-[3px] ${borderCls} p-4 space-y-2`}>
                    <div className="flex items-start gap-3">
                      <HealthIcon color={color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-body-small font-semibold text-neutral-950 truncate">{snap.projectName}</h3>
                          <div className="flex shrink-0 gap-1.5">
                            {snap.signals.overdueTasks > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-caption font-medium text-danger-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                                {snap.signals.overdueTasks} overdue
                              </span>
                            )}
                            {snap.signals.blockedTasks > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-caption font-medium text-warning-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
                                {snap.signals.blockedTasks} blocked
                              </span>
                            )}
                            {totalIssues === 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-caption font-medium text-success-700">
                                On track
                              </span>
                            )}
                          </div>
                        </div>
                        {snap.aiSummary && (
                          <p className="mt-1 text-caption text-neutral-600 leading-relaxed">{snap.aiSummary}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Revenue & Pipeline */}
        <section className="space-y-4">
          <h2 className="text-h3 font-semibold text-neutral-800">Revenue & Pipeline</h2>
          <div className="space-y-3">
            {/* Deal Pipeline Card */}
            <div className="glass-card rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">Deal Pipeline</p>
              </div>
              {data.deals ? (
                <>
                  <div className="flex items-end gap-3">
                    <span className="font-heading text-h1 font-bold text-neutral-950">{fmt(data.deals.open_pipeline_value)}</span>
                    <TrendPill percent={data.deals.value_trend_percent} />
                  </div>
                  <div className="flex gap-6 text-body-small">
                    <div>
                      <span className="font-semibold text-neutral-800">{fmt(data.deals.weighted_pipeline_value)}</span>
                      <span className="ml-1 text-neutral-500">weighted</span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-800">{data.deals.win_rate_percent ?? 0}%</span>
                      <span className="ml-1 text-neutral-500">win rate</span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-800">{data.deals.deals_to_close_this_month}</span>
                      <span className="ml-1 text-neutral-500">closing soon</span>
                    </div>
                  </div>
                  {data.deals.by_stage && (
                    <div className="space-y-2 pt-1">
                      {Object.entries(data.deals.by_stage).map(([stage, count]) => {
                        const pct = totalStageDeals > 0 ? (count / totalStageDeals) * 100 : 0;
                        const barColor = STAGE_COLORS[stage] ?? "bg-primary-400";
                        return (
                          <div key={stage} className="flex items-center gap-3">
                            <span className="w-28 truncate text-caption text-neutral-600 capitalize">{stage.replace(/_/g, " ")}</span>
                            <div className="h-2 flex-1 rounded-full bg-neutral-100">
                              <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(pct > 0 ? 8 : 0, pct)}%` }} />
                            </div>
                            <span className="w-8 text-right text-caption font-semibold text-neutral-800">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-body-small text-neutral-400">No CRM data available</p>
              )}
            </div>

            {/* Accounts Card */}
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">Accounts</p>
              </div>
              {data.accounts ? (
                <div className="flex gap-8">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading text-h2 font-bold text-neutral-950">{data.accounts.customers}</span>
                    <span className="text-caption text-neutral-500">customers</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading text-h2 font-bold text-neutral-950">{data.accounts.total - data.accounts.customers}</span>
                    <span className="text-caption text-neutral-500">prospects</span>
                  </div>
                  <div className="ml-auto flex items-baseline gap-1.5">
                    <span className="font-heading text-h3 font-semibold text-neutral-600">{data.accounts.total}</span>
                    <span className="text-caption text-neutral-400">total</span>
                  </div>
                </div>
              ) : (
                <p className="text-body-small text-neutral-400">No account data</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Recommended Actions + Recent Activity — side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recommended Actions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-neutral-800">Recommended Actions</h2>
            <div className="flex gap-2">
              <Button onClick={loadRecommendations} disabled={recsLoading} variant="secondary">
                {recsLoading ? "Loading…" : recommendations.length > 0 ? "Refresh" : "Load"}
              </Button>
              {recommendations.length > 0 && (
                <Button href="/ai/recommendations" variant="secondary">View all</Button>
              )}
            </div>
          </div>
          {recommendations.length === 0 && !recsLoading ? (
            <div className="glass-card rounded-lg p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="mt-2 text-body-small font-medium text-neutral-600">Get AI-powered recommendations</p>
              <p className="text-caption text-neutral-400">Click Load to analyze your org and surface action items</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="glass-card rounded-lg p-6 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ai-200 border-t-ai-600" />
              <p className="mt-3 text-body-small text-neutral-500">Analyzing your organization...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...recommendations]
                .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.priority] - { critical: 0, high: 1, medium: 2 }[b.priority]))
                .slice(0, 5)
                .map((r) => {
                  const cfg = PRIORITY_CONFIG[r.priority] ?? PRIORITY_CONFIG.medium;
                  return (
                    <div key={r.id} className={`glass-card rounded-lg border-l-[3px] p-3 ${
                      r.priority === "critical" ? "border-l-danger-500" : r.priority === "high" ? "border-l-warning-500" : "border-l-info-400"
                    }`}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-body-small font-medium text-neutral-950 truncate">{r.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
                              {r.priority}
                            </span>
                          </div>
                          <p className="mt-0.5 text-caption text-neutral-600 line-clamp-2">{r.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-neutral-800">Recent Activity</h2>
            <span className="text-caption text-neutral-400">{data.recent_activity.length} event{data.recent_activity.length !== 1 ? "s" : ""}</span>
          </div>
          {data.recent_activity.length === 0 ? (
            <div className="glass-card rounded-lg p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-body-small text-neutral-500">No recent activity</p>
            </div>
          ) : (
            <div className="glass-card divide-y divide-neutral-100 rounded-lg">
              {data.recent_activity.slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 first:rounded-t-lg last:rounded-b-lg hover:bg-neutral-50/50 transition-colors">
                  <ActivityIcon pillar={a.pillar} />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-small font-medium text-neutral-900 truncate">{a.title}</p>
                    <p className="text-caption text-neutral-500 truncate">{a.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-caption text-neutral-400 whitespace-nowrap">{timeAgo(a.timestamp)}</span>
                    {a.actor_name && <p className="text-[10px] text-neutral-400 truncate max-w-[80px]">{a.actor_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
