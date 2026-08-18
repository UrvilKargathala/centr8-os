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

function MiniBars({ values, color }: { values: number[]; color: BadgeColor }) {
  const bg: Record<string, string> = {
    neutral: "bg-neutral-400", info: "bg-info-600", warning: "bg-warning-600",
    danger: "bg-danger-600", success: "bg-success-600", ai: "bg-ai-600",
  };
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-1">
      {values.map((v, i) => (
        <div key={i} className="bar-stack flex h-full w-2 items-end rounded-full bg-neutral-100">
          <div className={`w-2 rounded-full ${bg[color] ?? bg.neutral}`} style={{ height: `${Math.max(v > 0 ? 12 : 4, (v / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

const PILLAR_ICON: Record<string, string> = {
  pm: "bg-primary-100 text-primary-600",
  hr: "bg-success-100 text-success-600",
  crm: "bg-warning-100 text-warning-600",
  ai: "bg-ai-100 text-ai-600",
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
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

  const countsByStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, (data.projects ? [data.projects].flat() : []).length > 0 ? 0 : 0]));
  const healthByProject: Record<string, HealthSnapshot> = {};
  health.forEach((h) => { healthByProject[h.projectId] = h; });

  const projectsList: { id: string; name: string; status: string }[] = [];
  if (data.projects) {
    PROJECT_STATUSES.forEach((s) => {
      const count = s === "active" ? data.projects!.active : s === "completed" ? data.projects!.completed : s === "planning" ? (data.projects!.total - data.projects!.active - data.projects!.completed - data.projects!.at_risk) : 0;
      countsByStatus[s] = Math.max(0, count);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-h1 font-semibold text-neutral-950">Executive Dashboard</h1>
          <p className="text-body-small text-neutral-500">Cross-pillar overview and strategic insights</p>
        </div>
        <AiButton label="AI Strategic Briefing" loading={briefingLoading} onClick={handleBriefing} />
      </div>

      {/* AI Strategic Briefing */}
      {briefing && (
        <div className="rounded-lg border border-ai-200 bg-ai-50 p-4 space-y-3">
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
          {/* PM row */}
          <KpiCard title="Active Projects" value={data.projects?.active ?? 0} pattern={data.projects?.active ?? 0} tone="primary" trend={data.projects?.at_risk ? { text: `${data.projects.at_risk} at risk`, positive: false } : undefined} />
          <KpiCard title="Tasks Overdue" value={data.tasks?.overdue ?? 0} pattern={data.tasks?.overdue ?? 0} tone={(data.tasks?.overdue ?? 0) > 0 ? "danger" : "success"} trend={data.tasks?.completed_trend_percent !== null && data.tasks?.completed_trend_percent !== undefined ? { text: `${data.tasks.completed_trend_percent >= 0 ? "+" : ""}${data.tasks.completed_trend_percent}% completions WoW`, positive: data.tasks.completed_trend_percent >= 0 } : undefined} />
          <KpiCard title="Sprint Progress" value={data.sprints ? `${data.sprints.avg_progress_percent}%` : "—"} pattern={data.sprints?.avg_progress_percent ?? 0} tone="info" trend={data.sprints ? { text: `${data.sprints.active_count} active sprint${data.sprints.active_count !== 1 ? "s" : ""}`, positive: true } : undefined} />

          {/* HR row */}
          <KpiCard title="Total Employees" value={data.employees?.total ?? 0} pattern={data.employees?.total ?? 0} tone="success" trend={data.employees?.onboarding ? { text: `${data.employees.onboarding} onboarding`, positive: true } : undefined} />
          <KpiCard title="Pending Leave" value={data.leave?.pending_requests ?? 0} pattern={data.leave?.pending_requests ?? 0} tone={(data.leave?.pending_requests ?? 0) > 3 ? "warning" : "neutral"} trend={data.leave?.on_leave_today ? { text: `${data.leave.on_leave_today} on leave today` } : undefined} />
          <KpiCard title="Open HR Cases" value={data.open_hr_cases ?? 0} pattern={data.open_hr_cases ?? 0} tone={(data.open_hr_cases ?? 0) > 0 ? "warning" : "success"} />

          {/* CRM row */}
          <KpiCard title="Pipeline Value" value={data.deals ? fmt(data.deals.weighted_pipeline_value) : "—"} pattern={data.deals?.deals_to_close_this_month ?? 0} tone="warning" trend={data.deals?.value_trend_percent != null ? { text: `${data.deals.value_trend_percent >= 0 ? "+" : ""}${data.deals.value_trend_percent}% MoM`, positive: data.deals.value_trend_percent >= 0 } : undefined} />
          <KpiCard title="Active Leads" value={data.leads?.total ?? 0} pattern={data.leads?.new_this_month ?? 0} tone="info" trend={data.leads?.new_this_month ? { text: `${data.leads.new_this_month} new this month`, positive: true } : undefined} />
          <KpiCard title="Win Rate" value={data.deals?.win_rate_percent != null ? `${data.deals.win_rate_percent}%` : "—"} pattern={data.deals?.win_rate_percent ?? 0} tone={(data.deals?.win_rate_percent ?? 0) >= 30 ? "success" : "neutral"} trend={data.deals?.deals_to_close_this_month ? { text: `${data.deals.deals_to_close_this_month} closing soon`, positive: true } : undefined} />
        </div>
      </section>

      {/* Two-column layout: Project Health + Budget/Revenue */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Project Health — 3 cols */}
        <section className="space-y-3 lg:col-span-3">
          <h2 className="text-h3 font-semibold text-neutral-800">Project Health</h2>
          {health.length === 0 ? (
            <p className="text-body-small text-neutral-500">No health data available. Run a health scan first.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {health.map((snap) => {
                const color: BadgeColor = snap.signals.overdueTasks > 0 ? "danger" : snap.signals.blockedTasks > 0 ? "warning" : "success";
                const dotCls = color === "danger" ? "bg-danger-500" : color === "warning" ? "bg-warning-500" : "bg-success-500";
                return (
                  <div key={snap.projectId} className="rounded-lg border border-neutral-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${dotCls}`} />
                      <span className="text-body-small font-medium text-neutral-900 truncate">{snap.projectName}</span>
                      <div className="ml-auto flex gap-1.5">
                        {snap.signals.overdueTasks > 0 && <Badge color="danger">{snap.signals.overdueTasks} overdue</Badge>}
                        {snap.signals.blockedTasks > 0 && <Badge color="warning">{snap.signals.blockedTasks} blocked</Badge>}
                        {snap.signals.overdueTasks === 0 && snap.signals.blockedTasks === 0 && <Badge color="success">On track</Badge>}
                      </div>
                    </div>
                    {snap.aiSummary && (
                      <p className="text-caption text-neutral-600 line-clamp-2">{snap.aiSummary}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Budget & Revenue — 2 cols */}
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-h3 font-semibold text-neutral-800">Revenue & Pipeline</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
              <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Deal Pipeline</p>
              {data.deals ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-h2 font-semibold text-neutral-950">{fmt(data.deals.open_pipeline_value)}</span>
                    <span className="text-caption text-neutral-500">open pipeline</span>
                    <TrendPill percent={data.deals.value_trend_percent} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-body-large font-semibold text-neutral-800">{fmt(data.deals.weighted_pipeline_value)}</span>
                    <span className="text-caption text-neutral-500">weighted</span>
                  </div>
                  <div className="flex items-center gap-4 text-caption text-neutral-600">
                    <span>{data.deals.deals_to_close_this_month} closing this month</span>
                    <span>{data.deals.win_rate_percent ?? 0}% win rate</span>
                  </div>
                  {data.deals.by_stage && (
                    <div className="space-y-1">
                      {Object.entries(data.deals.by_stage).map(([stage, count]) => (
                        <div key={stage} className="flex items-center gap-2">
                          <span className="w-24 truncate text-caption text-neutral-500 capitalize">{stage.replace(/_/g, " ")}</span>
                          <div className="bar-track h-1.5 flex-1 rounded-full bg-neutral-100">
                            <div className="h-1.5 rounded-full bg-warning-400" style={{ width: `${Math.min(100, (count / Math.max(1, Object.values(data.deals!.by_stage).reduce((a, b) => a + b, 0))) * 100)}%` }} />
                          </div>
                          <span className="text-caption font-medium text-neutral-700 w-6 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-body-small text-neutral-400">No CRM data available</p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 p-4 space-y-2">
              <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Accounts</p>
              {data.accounts ? (
                <div className="flex gap-6">
                  <div>
                    <span className="font-heading text-h3 font-semibold text-neutral-950">{data.accounts.customers}</span>
                    <span className="ml-1 text-caption text-neutral-500">customers</span>
                  </div>
                  <div>
                    <span className="font-heading text-h3 font-semibold text-neutral-950">{data.accounts.total - data.accounts.customers}</span>
                    <span className="ml-1 text-caption text-neutral-500">prospects</span>
                  </div>
                </div>
              ) : (
                <p className="text-body-small text-neutral-400">No account data</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Two-column: Recommended Actions + Activity Timeline */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recommendations — 3 cols */}
        <section className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-h3 font-semibold text-neutral-800">Recommended Actions</h2>
            <div className="flex gap-2">
              <Button onClick={loadRecommendations} disabled={recsLoading} variant="secondary">
                {recsLoading ? "Loading…" : recommendations.length > 0 ? "Refresh" : "Load"}
              </Button>
              {recommendations.length > 0 && (
                <Button href="/ai/recommendations" variant="secondary">View all →</Button>
              )}
            </div>
          </div>
          {recommendations.length === 0 && !recsLoading ? (
            <p className="text-body-small text-neutral-500">Click &quot;Load&quot; to get AI-powered action items.</p>
          ) : recommendations.length === 0 ? (
            <p className="text-body-small text-neutral-500">Generating recommendations…</p>
          ) : (
            <div className="space-y-2">
              {[...recommendations]
                .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.priority] - { critical: 0, high: 1, medium: 2 }[b.priority]))
                .slice(0, 5)
                .map((r) => (
                  <Card key={r.id} padding="sm" className={cardAccentClass(r.priority === "critical" ? "danger" : r.priority === "high" ? "warning" : "neutral")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body-small font-medium text-neutral-950">{r.title}</p>
                        <p className="truncate text-caption text-neutral-600">{r.description}</p>
                      </div>
                      <Badge color={r.priority === "critical" ? "danger" : r.priority === "high" ? "warning" : "ai"}>{r.priority}</Badge>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </section>

        {/* Activity Timeline — 2 cols */}
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-h3 font-semibold text-neutral-800">Recent Activity</h2>
          {data.recent_activity.length === 0 ? (
            <p className="text-body-small text-neutral-500">No recent activity.</p>
          ) : (
            <div className="space-y-0 rounded-lg border border-neutral-200 divide-y divide-neutral-100">
              {data.recent_activity.slice(0, 10).map((a, i) => {
                const pillarCls = PILLAR_ICON[a.pillar] ?? PILLAR_ICON.pm;
                return (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase ${pillarCls}`}>
                      {a.pillar === "pm" ? "P" : a.pillar === "hr" ? "H" : a.pillar === "crm" ? "C" : "A"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-small font-medium text-neutral-800">{a.title}</p>
                      <p className="truncate text-caption text-neutral-500">{a.description}</p>
                    </div>
                    <span className="shrink-0 text-caption text-neutral-400 whitespace-nowrap">{timeAgo(a.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
