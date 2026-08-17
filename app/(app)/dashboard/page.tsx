"use client";

// Global cross-pillar dashboard — the new landing page at /dashboard.
// Backend (GET /api/dashboard, GET /api/ai/recommendations, generateAI) is
// already built and tested; this file is purely presentational.
import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { createClient } from "@/lib/supabase/client";
import { Card, CardLink } from "@/components/ui/Card";
import { Badge, ProjectStatusBadge, TaskStatusBadge, type BadgeColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AiBanner } from "@/components/ui/AiBanner";
import { DonutChart } from "@/components/ui/DonutChart";
import { Avatar } from "@/components/ui/Avatar";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { ChatInput, HeroEmptyState, MessageList, useAskAiConversation } from "@/components/ai/AskAiChat";
import { useAiUsage } from "@/lib/context/AiUsageContext";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function inDays(iso: string | null) {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return `in ${days}d`;
}

// Groups an already-newest-first activity list into Today / Yesterday /
// This Week / Earlier buckets, preserving order within each bucket — turns
// a flat 15-row list into something that reads like an actual timeline
// instead of a sparse dump.
function groupByDate<T extends { timestamp: string }>(items: T[]): [string, T[]][] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  const buckets: Record<string, T[]> = { Today: [], Yesterday: [], "This week": [], Earlier: [] };
  for (const item of items) {
    const t = new Date(item.timestamp);
    if (t >= startOfToday) buckets.Today.push(item);
    else if (t >= startOfYesterday) buckets.Yesterday.push(item);
    else if (t >= startOfWeek) buckets["This week"].push(item);
    else buckets.Earlier.push(item);
  }
  return Object.entries(buckets).filter(([, list]) => list.length > 0);
}

// Small icon set for the pillar chips on each Quick Stat card — same path
// style/stroke as AppShell's ICON map, duplicated here rather than
// exported/shared since AppShell's set is much larger and page-specific
// subsetting isn't worth a shared-module indirection for 4 paths.
const PILLAR_ICON: Record<string, string> = {
  pm: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  tasks: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  hr: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8",
  crm: "M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01",
  ai: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z",
  video: "M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
};

function ChipIcon({ path, color }: { path: string; color: BadgeColor }) {
  const bg: Record<BadgeColor, string> = {
    neutral: "bg-neutral-200 text-neutral-700",
    info: "bg-info-100 text-info-600",
    warning: "bg-warning-100 text-warning-600",
    danger: "bg-danger-100 text-danger-600",
    success: "bg-success-100 text-success-600",
    ai: "bg-ai-100 text-ai-600",
  };
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg[color]}`}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </span>
  );
}

// Trend pill — only ever rendered when the caller has a REAL prior-period
// comparison (see lib/api/dashboard.ts's pctChange()); null values already
// mean "no pill", this component never fabricates a direction.
function TrendPill({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const positive = percent >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-caption font-medium ${
        positive ? "bg-success-100 text-success-600" : "bg-danger-100 text-danger-600"
      }`}
    >
      <svg className={`h-2.5 w-2.5 ${positive ? "" : "rotate-180"}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 3l6 7h-4v7H8v-7H4l6-7z" />
      </svg>
      {Math.abs(percent)}%
    </span>
  );
}

// Real-data mini bar chart for the Quick Stat cards — each bar is an actual
// sub-count (e.g. task statuses), not decoration. Bars are relative to the
// tallest bar in the set so a card with small numbers doesn't look flat.
function MiniBars({ values, color }: { values: number[]; color: BadgeColor }) {
  const bg: Record<BadgeColor, string> = {
    neutral: "bg-neutral-400",
    info: "bg-info-600",
    warning: "bg-warning-600",
    danger: "bg-danger-600",
    success: "bg-success-600",
    ai: "bg-ai-600",
  };
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-1">
      {values.map((v, i) => (
        <div key={i} className="flex h-full w-2 items-end rounded-full bg-neutral-100">
          <div className={`w-2 rounded-full ${bg[color]}`} style={{ height: `${Math.max(v > 0 ? 12 : 4, (v / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

type DashboardData = {
  projects: { total: number; active: number; at_risk: number; completed: number } | null;
  tasks: {
    total: number;
    pending: number;
    in_progress: number;
    in_review: number;
    completed: number;
    overdue: number;
    completed_trend_percent: number | null;
  } | null;
  sprints: { active_count: number; avg_progress_percent: number } | null;
  active_projects_list:
    | Array<{
        id: string;
        name: string;
        status: string;
        at_risk: boolean;
        task_progress: { done: number; total: number };
        remaining: number;
        end_date: string | null;
      }>
    | null;
  recent_tasks_list:
    | Array<{ id: string; title: string; project_name: string; assignee_name: string | null; due_date: string | null; status: string }>
    | null;
  employees: { total: number; active: number; onboarding: number; on_leave: number; notice_period: number } | null;
  attendance: {
    checked_in_today: number | null;
    checked_out_today: number | null;
    absent_today: number | null;
    late_today: number | null;
    attendance_rate_percent: number | null;
  } | null;
  leave: { pending_requests: number | null; approved_today: number | null; on_leave_today: number | null } | null;
  open_hr_cases: number | null;
  leads: { total: number; new_this_month: number; qualified: number; conversion_rate_percent: number } | null;
  deals: {
    open_pipeline_value: number;
    weighted_pipeline_value: number;
    deals_to_close_this_month: number;
    win_rate_percent: number;
    value_trend_percent: number | null;
    by_stage: { prospecting: number; discovery: number; proposal: number; negotiation: number; contract_sent: number };
  } | null;
  accounts: { total: number; customers: number; prospects: number } | null;
  communication: { unread_messages: number; unread_emails: number; upcoming_meetings: number; missed_calls: number };
  next_meeting: { id: string; title: string; startTime: string; endTime: string; meetUrl: string | null; attendees: string[]; htmlLink: string } | null;
  ai: { pending_sprint_plans: number | null; documents_in_draft: number | null };
  recent_activity: Array<{
    type: string;
    pillar: "pm" | "hr" | "crm" | "ai";
    title: string;
    description: string;
    actor_name: string;
    timestamp: string;
    linked_entity_type: string | null;
    linked_entity_id: string | null;
  }>;
};

type Recommendation = {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  category: string;
  action_type: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
  reasoning: string;
};

type Briefing = { summary: string; highlights: Array<{ type: "positive" | "warning" | "action_needed"; text: string }> };

function activityLink(a: DashboardData["recent_activity"][number]): string | null {
  if (!a.linked_entity_id) return null;
  switch (a.linked_entity_type) {
    case "project":
      return `/projects/${a.linked_entity_id}`;
    case "deal":
      return `/crm/deals/${a.linked_entity_id}`;
    case "lead":
      return "/crm/leads";
    case "sprint_plan_proposal":
      return "/ai/sprint-plans";
    case "document":
      return "/ai/documents";
    default:
      return null;
  }
}

const PILLAR_DOT: Record<string, string> = {
  pm: "bg-primary-600",
  hr: "bg-success-600",
  crm: "bg-danger-600",
  ai: "bg-ai-600",
};

// Matches Recommendation["category"] (app/(app)/ai/recommendations/page.tsx)
const RECOMMENDATION_CATEGORY_BADGE: Record<string, BadgeColor> = {
  project: "info",
  hr: "success",
  crm: "danger",
  capacity: "ai",
};

const HIGHLIGHT_COLOR: Record<Briefing["highlights"][number]["type"], "success" | "warning" | "danger"> = {
  positive: "success",
  warning: "warning",
  action_needed: "danger",
};

// Dynamic `border-${accent}-600` strings don't survive Tailwind's static
// class-name scan — an explicit map is required, same reasoning
// cardAccentClass (components/ui/Badge.tsx) already exists for.
const PRIORITY_BORDER: Record<"danger" | "warning" | "neutral", string> = {
  danger: "border-danger-600",
  warning: "border-warning-600",
  neutral: "border-neutral-400",
};

const STAGE_COLOR: Record<string, BadgeColor> = {
  prospecting: "neutral",
  discovery: "info",
  proposal: "warning",
  negotiation: "danger",
  contract_sent: "ai",
};

// Fixed 268x117 Quick Stat tile (explicit request) — flex-col justify-between
// distributes the icon row and text block across the fixed height instead
// of a fluid space-y gap, so tightening/loosening content never blows the
// box out.
const KPI_CARD = "!w-[380px] !h-[136px] !rounded-2xl !p-4 flex flex-col justify-between overflow-hidden";

export default function DashboardPage() {
  const { selectedOrgId, selectedOrg, can, loading: orgLoading } = useOrg();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const chat = useAskAiConversation(selectedOrgId);
  const { increment: incrementAi, cache: aiCache } = useAiUsage();
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const dismissKey = `centr8_briefing_dismissed_${todayKey}`;

  function load(silent = false) {
    if (!selectedOrgId) return;
    if (!silent) setLoading(true);
    fetch(`/api/dashboard?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((dashBody) => {
        setData(dashBody.data ?? null);
        const cachedRecs = aiCache.get(`recs_${selectedOrgId}`) as Recommendation[] | undefined;
        if (cachedRecs) setRecs(cachedRecs);
        const cachedBriefing = aiCache.get(`briefing_${selectedOrgId}_${todayKey}`) as Briefing | undefined;
        if (cachedBriefing) setBriefing(cachedBriefing);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => load(), [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onFocus() {
      load(true);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  function loadRecommendations() {
    if (!selectedOrgId || recsLoading) return;
    setRecsLoading(true);
    fetch(`/api/ai/recommendations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const result = (body.data ?? []).slice(0, 3);
        setRecs(result);
        aiCache.set(`recs_${selectedOrgId}`, result);
        incrementAi();
      })
      .finally(() => setRecsLoading(false));
  }

  function loadBriefing() {
    if (!selectedOrgId || briefingLoading || !data) return;
    setBriefingLoading(true);
    setBriefingDismissed(false);
    fetch(`/api/ai/daily-briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, dashboard_data: data }),
    })
      .then((r) => r.json())
      .then((body) => {
        const result = body.data as Briefing;
        setBriefing(result);
        aiCache.set(`briefing_${selectedOrgId}_${todayKey}`, result);
        incrementAi();
      })
      .catch(() => setBriefing(null))
      .finally(() => setBriefingLoading(false));
  }

  function dismissBriefing() {
    localStorage.setItem(dismissKey, "1");
    setBriefingDismissed(true);
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId || !data) return <p className="text-body text-neutral-600">No organization selected.</p>;

  const firstName = email ? email.split("@")[0].split(/[._-]/)[0] : null;
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "there";
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const pendingAiActions = (data.ai.pending_sprint_plans ?? 0) + recs.length;

  const stageEntries = data.deals ? (Object.entries(data.deals.by_stage) as [string, number][]) : [];
  const donutSlices = stageEntries
    .filter(([, v]) => v > 0)
    .map(([stage, value]) => ({ label: stage.replace(/_/g, " "), value, color: STAGE_COLOR[stage] ?? "neutral" }));

  const upcoming: Array<{ key: string; title: string; date: string }> = [];
  if (data.active_projects_list) {
    for (const p of data.active_projects_list) {
      if (p.end_date) upcoming.push({ key: p.id, title: p.name, date: p.end_date });
    }
  }
  const meeting = data.next_meeting;
  if (meeting) upcoming.push({ key: meeting.id, title: meeting.title, date: meeting.startTime });
  upcoming.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const upcomingTop3 = upcoming.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-body text-neutral-500">Ready to conquer your projects?</p>
          <h1 className="text-h2 font-semibold text-neutral-950">Welcome back, {displayName}</h1>
          <p className="text-small text-neutral-500">
            {todayLabel} · {selectedOrg?.name ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="!rounded-full !border-ai-600 !text-ai-600 hover:!bg-ai-100"
            onClick={() => {
              if (briefing) {
                setBriefingDismissed(false);
              } else {
                loadBriefing();
              }
            }}
          >
            {briefingLoading ? "Generating…" : "AI: Daily Briefing"}
          </Button>
        </div>
      </div>

      {!briefingDismissed && (briefing || briefingLoading) && (
        <Card className="!rounded-2xl overflow-hidden !p-0">
          <div className="flex items-start justify-between gap-4">
            <AiBanner label="AI-generated daily briefing" />
            <button
              type="button"
              onClick={dismissBriefing}
              aria-label="Dismiss briefing"
              className="m-2 shrink-0 rounded-sm px-2 py-1 text-neutral-500 hover:bg-neutral-200"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 p-4">
            {briefingLoading || !briefing ? (
              <p className="text-body text-neutral-600">Generating briefing…</p>
            ) : (
              <>
                <p className="text-body text-neutral-800">{briefing.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {briefing.highlights.map((h, i) => (
                    <Badge key={i} color={HIGHLIGHT_COLOR[h.type]}>
                      {h.text}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Section 1 — Quick Stats. Fixed 268x117 tiles (explicit request) —
          a flex-wrap row rather than a fluid grid, since a fixed pixel size
          per card doesn't divide evenly into a responsive grid track. */}
      <div className="flex flex-wrap gap-4">
        {data.projects ? (
          <CardLink href="/projects" className={KPI_CARD}>
            <div className="flex items-start justify-between">
              <ChipIcon path={PILLAR_ICON.pm} color="info" />
              <MiniBars values={[data.projects.active, data.projects.completed, data.projects.at_risk]} color="info" />
            </div>
            <div>
              <p className="text-caption text-neutral-600">Projects</p>
              <p className="text-h3 font-semibold leading-tight text-neutral-950">{data.projects.active}</p>
              <p className={`text-small ${data.projects.at_risk > 0 ? "text-warning-600" : "text-neutral-500"}`}>
                {data.projects.at_risk > 0 ? `${data.projects.at_risk} at risk` : "All on track"}
              </p>
            </div>
          </CardLink>
        ) : (
          <Card className={KPI_CARD}>
            <p className="text-caption text-neutral-600">Projects</p>
            <p className="text-small text-neutral-400">No access</p>
          </Card>
        )}

        {data.tasks ? (
          <CardLink href="/tasks" className={KPI_CARD}>
            <div className="flex items-start justify-between">
              <ChipIcon path={PILLAR_ICON.tasks} color={data.tasks.overdue > 0 ? "danger" : "success"} />
              <MiniBars
                values={[data.tasks.pending, data.tasks.in_progress, data.tasks.in_review, data.tasks.completed]}
                color={data.tasks.overdue > 0 ? "danger" : "success"}
              />
            </div>
            <div>
              <p className="text-caption text-neutral-600">Tasks Overdue</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-h3 font-semibold leading-tight ${data.tasks.overdue > 0 ? "text-danger-600" : "text-neutral-950"}`}>
                  {data.tasks.overdue}
                </p>
                <TrendPill percent={data.tasks.completed_trend_percent} />
              </div>
              <p className="text-small text-neutral-500">{data.tasks.in_progress} in progress</p>
            </div>
          </CardLink>
        ) : (
          <Card className={KPI_CARD}>
            <p className="text-caption text-neutral-600">Tasks</p>
            <p className="text-small text-neutral-400">No access</p>
          </Card>
        )}

        {data.deals ? (
          <CardLink href="/crm/deals" className={KPI_CARD}>
            <div className="flex items-start justify-between">
              <ChipIcon path={PILLAR_ICON.crm} color="danger" />
              <MiniBars values={Object.values(data.deals.by_stage)} color="danger" />
            </div>
            <div>
              <p className="text-caption text-neutral-600">Pipeline</p>
              <div className="flex items-baseline gap-2">
                <p className="text-h3 font-semibold leading-tight text-neutral-950">₹{Math.round(data.deals.weighted_pipeline_value).toLocaleString()}</p>
                <TrendPill percent={data.deals.value_trend_percent} />
              </div>
              <p className="text-small text-neutral-500">{data.deals.deals_to_close_this_month} closing this month</p>
            </div>
          </CardLink>
        ) : (
          <Card className={KPI_CARD}>
            <p className="text-caption text-neutral-600">Pipeline</p>
            <p className="text-small text-neutral-400">No access</p>
          </Card>
        )}

        <CardLink href="/ai/recommendations" className={KPI_CARD}>
          <ChipIcon path={PILLAR_ICON.ai} color="ai" />
          <div>
            <p className="text-caption text-neutral-600">AI Actions</p>
            <p className="text-h3 font-semibold leading-tight text-neutral-950">{pendingAiActions}</p>
            <p className="text-small font-medium text-ai-600">Review →</p>
          </div>
        </CardLink>
      </div>

      {/* Section 2 — two columns */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="!rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-body-medium font-semibold text-neutral-950">Projects Overview</h2>
              <Button href="/projects" variant="secondary" size="icon-sm" className="!w-auto !rounded-full !px-3">
                View all
              </Button>
            </div>
            {!data.active_projects_list ? (
              <p className="text-small text-neutral-600">You don&apos;t have access to projects.</p>
            ) : data.active_projects_list.length === 0 ? (
              <p className="text-small text-neutral-600">No active projects.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {data.active_projects_list.map((p, i) => (
                  <a key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-medium font-medium text-neutral-950">{p.name}</p>
                      <div className="mt-1 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-primary-600"
                          style={{ width: `${p.task_progress.total > 0 ? (p.task_progress.done / p.task_progress.total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-caption text-neutral-500">
                        {p.remaining > 0 ? `${p.remaining} tasks remaining` : "All tasks done"}
                        {p.end_date ? ` · due ${new Date(p.end_date).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ProjectStatusBadge status={p.status} />
                      {p.at_risk && <Badge color="danger">At risk</Badge>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card className="!rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-body-medium font-semibold text-neutral-950">Recent Tasks</h2>
              <Button href="/tasks" variant="secondary" size="icon-sm" className="!w-auto !rounded-full !px-3">
                View all
              </Button>
            </div>
            {!data.recent_tasks_list ? (
              <p className="text-small text-neutral-600">You don&apos;t have access to tasks.</p>
            ) : data.recent_tasks_list.length === 0 ? (
              <p className="text-small text-neutral-600">No open tasks.</p>
            ) : (
              <div className="space-y-3">
                {data.recent_tasks_list.map((t) => {
                  // Horizontal bar length is real days-until-due (clamped to
                  // a 14-day window so one far-out date doesn't flatten
                  // every other bar) — not decoration. No due date at all
                  // renders as an empty track rather than a fabricated bar.
                  const daysUntil = t.due_date ? Math.round((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;
                  const overdue = daysUntil !== null && daysUntil < 0;
                  const barPercent = daysUntil === null ? 0 : Math.min(100, Math.max(6, ((daysUntil + 7) / 21) * 100));
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <Avatar name={t.assignee_name ?? "?"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-body-medium font-medium text-neutral-950">{t.title}</p>
                          <span className={`shrink-0 text-caption ${overdue ? "text-danger-600" : "text-neutral-500"}`}>
                            {daysUntil === null ? "No due date" : overdue ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d left`}
                          </span>
                        </div>
                        <p className="truncate text-caption text-neutral-500">{t.project_name}</p>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={`h-full rounded-full ${overdue ? "bg-danger-600" : "bg-primary-600"}`}
                            style={{ width: `${barPercent}%` }}
                          />
                        </div>
                      </div>
                      <TaskStatusBadge status={t.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="!rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-body-medium font-semibold text-neutral-950">Deals Pipeline</h2>
              <Button href="/crm/deals" variant="secondary" size="icon-sm" className="!w-auto !rounded-full !px-3">
                View pipeline
              </Button>
            </div>
            {!data.deals ? (
              <p className="text-small text-neutral-600">You don&apos;t have access to deals.</p>
            ) : donutSlices.length === 0 ? (
              <p className="text-small text-neutral-600">No open deals in the pipeline yet.</p>
            ) : (
              <div className="space-y-4">
                <DonutChart slices={donutSlices} centerLabel={String(donutSlices.reduce((s, x) => s + x.value, 0))} centerSublabel="open deals" />
                <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-3">
                  <div>
                    <p className="text-caption text-neutral-600">Open Pipeline</p>
                    <p className="text-body-medium font-semibold text-neutral-950">₹{data.deals.open_pipeline_value.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-caption text-neutral-600">Weighted Pipeline</p>
                    <p className="text-body-medium font-semibold text-neutral-950">
                      ₹{Math.round(data.deals.weighted_pipeline_value).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="!rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-body-medium font-semibold text-neutral-950">HR Snapshot</h2>
              <Button href="/hr/dashboard" variant="secondary" size="icon-sm" className="!w-auto !rounded-full !px-3">
                View HR
              </Button>
            </div>
            {!data.employees ? (
              <p className="text-small text-neutral-600">You don&apos;t have access to HR data.</p>
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <DonutChart
                  slices={[
                    { label: "Active", value: data.employees.active, color: "success" },
                    { label: "Onboarding", value: data.employees.onboarding, color: "info" },
                    { label: "On leave", value: data.employees.on_leave, color: "warning" },
                    { label: "Notice period", value: data.employees.notice_period, color: "danger" },
                  ]}
                  centerLabel={String(data.employees.total)}
                  centerSublabel="employees"
                />
                <div className="grid flex-1 grid-cols-2 gap-4">
                  <div>
                    <p className="text-caption text-neutral-600">On Leave Today</p>
                    <p className="text-body-medium font-semibold text-neutral-950">{data.leave?.on_leave_today ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-caption text-neutral-600">Pending Leave</p>
                    <p className="text-body-medium font-semibold text-neutral-950">{data.leave?.pending_requests ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-caption text-neutral-600">Open Cases</p>
                    <p className="text-body-medium font-semibold text-neutral-950">{data.open_hr_cases ?? "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* CRM Snapshot — real leads/accounts data already fetched for the
              Quick Stats/Pipeline cards but not otherwise surfaced anywhere
              on this page; added specifically to give the left column real
              content instead of ending short next to the taller right
              column (a fixed-height-row CSS Grid limitation — see
              CLAUDE.md's dashboard redesign note). */}
          {(data.leads || data.accounts) && (
            <Card className="!rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-body-medium font-semibold text-neutral-950">CRM Snapshot</h2>
                <Button href="/crm" variant="secondary" size="icon-sm" className="!w-auto !rounded-full !px-3">
                  View CRM
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {data.leads && (
                  <>
                    <div>
                      <p className="text-caption text-neutral-600">Total Leads</p>
                      <p className="text-body-medium font-semibold text-neutral-950">{data.leads.total}</p>
                    </div>
                    <div>
                      <p className="text-caption text-neutral-600">New This Month</p>
                      <p className="text-body-medium font-semibold text-neutral-950">{data.leads.new_this_month}</p>
                    </div>
                    <div>
                      <p className="text-caption text-neutral-600">Qualified</p>
                      <p className="text-body-medium font-semibold text-neutral-950">{data.leads.qualified}</p>
                    </div>
                    <div>
                      <p className="text-caption text-neutral-600">Conversion Rate</p>
                      <p className="text-body-medium font-semibold text-neutral-950">{data.leads.conversion_rate_percent}%</p>
                    </div>
                  </>
                )}
                {data.accounts && (
                  <>
                    <div>
                      <p className="text-caption text-neutral-600">Total Accounts</p>
                      <p className="text-body-medium font-semibold text-neutral-950">{data.accounts.total}</p>
                    </div>
                    <div>
                      <p className="text-caption text-neutral-600">Customers</p>
                      <p className="text-body-medium font-semibold text-neutral-950">{data.accounts.customers}</p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="!rounded-2xl !border-none !bg-neutral-950 !p-5 text-neutral-50">
            <div className="mb-8 flex items-start justify-between">
              <p className="text-body-medium font-medium">Next Meeting</p>
              <ChipIcon path={PILLAR_ICON.video} color="ai" />
            </div>
            {meeting ? (
              <>
                <h3 className="text-h3 font-semibold">{meeting.title}</h3>
                <p className="mt-1 text-small text-neutral-400">
                  {new Date(meeting.startTime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                </p>
                {meeting.meetUrl ? (
                  <a
                    href={meeting.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 block w-full rounded-full bg-ai-600 px-4 py-2 text-center text-body-medium font-medium text-white hover:bg-ai-600/90"
                  >
                    Join Meeting
                  </a>
                ) : (
                  <Button href="/communication/video" className="!mt-5 !w-full !rounded-full !bg-ai-600 hover:!bg-ai-600/90">
                    Join Meeting
                  </Button>
                )}
              </>
            ) : (
              <p className="text-small text-neutral-400">Nothing scheduled right now.</p>
            )}
          </Card>

          {/* Embedded Ask AI panel — the real chat (components/ai/AskAiChat.tsx,
              same one at /ai/ask and the header widget), not a decorative
              mockup. Top recommendations sit below the input as quick-start
              tiles, mirroring the reference's prompt-tile row. */}
          <Card className="!rounded-2xl !p-0 flex h-[420px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-200 p-3">
              <span className="flex items-center gap-1.5 text-body-medium font-semibold text-ai-600">
                <ChipIcon path={PILLAR_ICON.ai} color="ai" />
                Ask AI
              </span>
              <Button href="/ai/ask" variant="secondary" size="icon-sm" className="!w-auto !rounded-full !px-3">
                Open full page
              </Button>
            </div>
            {!chat.conversationId ? (
              <HeroEmptyState compact onPick={(text) => chat.sendStarter(text)} />
            ) : (
              <MessageList messages={chat.messages} sending={chat.sending} streamingId={chat.streamingId} />
            )}
            {chat.conversationId && <ChatInput disabled={chat.sending} onSend={(text) => chat.sendMessage(text)} />}
            {recs.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto border-t border-neutral-200 p-3">
                {recs.map((r) => {
                  const accent = r.priority === "critical" ? "danger" : r.priority === "high" ? "warning" : "neutral";
                  return (
                    <a
                      key={r.id}
                      href="/ai/recommendations"
                      className={`block w-40 shrink-0 rounded-lg bg-neutral-100 p-2 border-l-4 ${PRIORITY_BORDER[accent]}`}
                    >
                      <p className="truncate text-caption font-medium text-neutral-950">{r.title}</p>
                      <Badge color={RECOMMENDATION_CATEGORY_BADGE[r.category] ?? "neutral"}>{r.category}</Badge>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="border-t border-neutral-200 p-3">
                <button
                  type="button"
                  onClick={loadRecommendations}
                  disabled={recsLoading}
                  className="w-full rounded-lg bg-ai-50 px-3 py-2 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-50"
                >
                  {recsLoading ? "Loading…" : "Load AI recommendations"}
                </button>
              </div>
            )}
          </Card>

          <Card className="!rounded-2xl">
            <h2 className="mb-3 text-body-medium font-semibold text-neutral-950">Upcoming</h2>
            {upcomingTop3.length === 0 ? (
              <p className="text-small text-neutral-600">Nothing upcoming.</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingTop3.map((u) => (
                  <div key={u.key} className="flex items-center justify-between gap-3">
                    <p className="truncate text-body-medium text-neutral-950">{u.title}</p>
                    <span className="shrink-0 text-caption text-neutral-500">{inDays(u.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Last per explicit request — it's the longest block (up to 15
              grouped rows), so it reads best as the final thing in this
              column rather than pushing the shorter blocks down. */}
          <Card className="!rounded-2xl">
            <h2 className="mb-3 text-body-medium font-semibold text-neutral-950">Recent Activity</h2>
            {data.recent_activity.length === 0 ? (
              <p className="text-small text-neutral-600">No recent activity.</p>
            ) : (
              <div className="space-y-4">
                {groupByDate(data.recent_activity).map(([groupLabel, items]) => (
                  <div key={groupLabel} className="space-y-1">
                    <p className="px-2 text-caption font-semibold uppercase tracking-wide text-neutral-500">{groupLabel}</p>
                    {items.map((a, i) => {
                      const href = activityLink(a);
                      const body = (
                        <div className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-neutral-100">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PILLAR_DOT[a.pillar]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-medium font-medium text-neutral-950">{a.title}</p>
                            <p className="truncate text-caption text-neutral-600">
                              {a.actor_name}
                              {a.description ? ` · ${a.description}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-caption text-neutral-500">{timeAgo(a.timestamp)}</span>
                        </div>
                      );
                      return href ? (
                        <a key={i} href={href} className="block">
                          {body}
                        </a>
                      ) : (
                        <div key={i}>{body}</div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Section 3 — Quick Actions */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {can("project", "create") && (
          <Button
            variant="secondary"
            className="!shrink-0 !rounded-full !border-primary-600 !text-primary-700"
            onClick={() => setShowNewProject(true)}
          >
            + New Project
          </Button>
        )}
        {can("lead", "create") && (
          <Button href="/crm/leads" variant="secondary" className="!shrink-0 !rounded-full !border-danger-600 !text-danger-600">
            + New Lead
          </Button>
        )}
        {can("employee", "create") && (
          <Button href="/hr/employees" variant="secondary" className="!shrink-0 !rounded-full !border-success-600 !text-success-600">
            + Add Employee
          </Button>
        )}
        {can("document", "create") && (
          <Button href="/ai/documents" variant="secondary" className="!shrink-0 !rounded-full !border-ai-600 !text-ai-600">
            + Generate Document
          </Button>
        )}
      </div>

      {showNewProject && selectedOrgId && (
        <NewProjectWizard
          orgId={selectedOrgId}
          currentUserId=""
          onClose={() => setShowNewProject(false)}
          onCreated={() => {
            setShowNewProject(false);
            load();
          }}
        />
      )}
    </div>
  );
}
