"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { LeadStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar, Pill } from "@/components/ui/Avatar";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CrmKpiCard, KpiIcons } from "@/components/crm/CrmKpiCard";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  contract_sent: "Contract Sent",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  campaign: "Campaign",
  job_board: "Job Board",
  cold_outreach: "Cold Outreach",
  event: "Event",
  social_media: "Social Media",
  manual: "Manual",
};

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export type Lead = { id: string; fullName: string; companyName: string | null; status: string; createdAt: string; source: string | null };
export type Activity = { id: string; relatedType: string; type: string; subject: string | null; performedBy: string | null; activityDate: string };
export type Stats = {
  total_leads: number;
  conversion_rate: number;
  total_accounts: number;
  total_contacts: number;
  activities_this_week: number;
};
export type PipelineStage = { stage: string; count: number; total_value: number; avg_days_in_stage: number };
export type PipelineStats = {
  stages: PipelineStage[];
  total_pipeline_value: number;
  weighted_pipeline_value: number;
  avg_deal_cycle_days: number;
  win_rate_percent: number;
};

export type CrmDashboardInitialData = { stats: Stats | null; pipeline: PipelineStats | null; leads: Lead[]; activities: Activity[] };

export default function CrmDashboardPageClient({ initial }: { initial?: CrmDashboardInitialData }) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState<Stats | null>(initial?.stats ?? null);
  const [pipeline, setPipeline] = useState<PipelineStats | null>(initial?.pipeline ?? null);
  const [leads, setLeads] = useState<Lead[]>(initial?.leads ?? []);
  const [activities, setActivities] = useState<Activity[]>(initial?.activities ?? []);
  const [loading, setLoading] = useState(!initial);

  const canReadDeals = can("deal", "read");

  const skippedInitialLoad = useRef(!!initial);
  useEffect(() => {
    if (!selectedOrgId) return;
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/stats?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/leads?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/activities?org_id=${selectedOrgId}`).then((r) => r.json()),
      canReadDeals ? fetch(`/api/crm/deals/pipeline-stats?org_id=${selectedOrgId}`).then((r) => r.json()) : Promise.resolve({ data: null }),
    ])
      .then(([statsBody, leadsBody, activitiesBody, pipelineBody]) => {
        setStats(statsBody.data ?? null);
        setLeads(leadsBody.data ?? []);
        setActivities(activitiesBody.data ?? []);
        setPipeline(pipelineBody.data ?? null);
      })
      .finally(() => setLoading(false));
  }, [selectedOrgId, canReadDeals]);

  if (orgLoading || loading) return <PageSkeleton variant="dashboard" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("lead", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to CRM.</p>;

  const recentLeads = [...leads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);
  const recentActivities = [...activities].sort((a, b) => +new Date(b.activityDate) - +new Date(a.activityDate)).slice(0, 8);
  const maxStageValue = pipeline ? Math.max(...pipeline.stages.map((s) => s.total_value), 1) : 1;

  const sourceCounts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.source ?? "unknown";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sourceBreakdown = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxSourceCount = Math.max(...sourceBreakdown.map(([, count]) => count), 1);

  const dayBuckets: { date: Date; count: number }[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    return { date, count: 0 };
  });
  for (const a of activities) {
    const activityDay = new Date(a.activityDate);
    activityDay.setHours(0, 0, 0, 0);
    const bucket = dayBuckets.find((b) => b.date.getTime() === activityDay.getTime());
    if (bucket) bucket.count += 1;
  }
  const maxDayCount = Math.max(...dayBuckets.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-950">CRM</h1>
        <p className="text-body text-neutral-600">Leads, accounts, and contacts at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CrmKpiCard label="Total Leads" value={stats?.total_leads ?? 0} color="primary" icon={KpiIcons.target} />
        <CrmKpiCard label="Conversion Rate" value={`${Math.round((stats?.conversion_rate ?? 0) * 100)}%`} color="success" icon={KpiIcons.percent} />
        <CrmKpiCard label="Total Accounts" value={stats?.total_accounts ?? 0} color="info" icon={KpiIcons.building} />
        <CrmKpiCard label="Total Contacts" value={stats?.total_contacts ?? 0} color="warning" icon={KpiIcons.users} />
        <CrmKpiCard label="Activities This Week" value={stats?.activities_this_week ?? 0} color="neutral" icon={KpiIcons.activity} />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-body-medium font-semibold text-neutral-950">Pipeline Summary</h2>
          <Button href="/crm/deals" variant="secondary" size="icon-sm" className="!w-auto !px-3">
            View all
          </Button>
        </div>
        {!canReadDeals ? (
          <p className="text-small text-neutral-600">You don&apos;t have access to deals.</p>
        ) : !pipeline || pipeline.stages.every((s) => s.count === 0) ? (
          <p className="text-small text-neutral-600">No open deals in the pipeline yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-caption text-neutral-600">Open Pipeline</p>
                <p className="text-body-medium font-semibold text-neutral-950">₹{pipeline.total_pipeline_value.toLocaleString("en-US")}</p>
              </div>
              <div>
                <p className="text-caption text-neutral-600">Weighted Pipeline</p>
                <p className="text-body-medium font-semibold text-neutral-950">₹{Math.round(pipeline.weighted_pipeline_value).toLocaleString("en-US")}</p>
              </div>
              <div>
                <p className="text-caption text-neutral-600">Win Rate</p>
                <p className="text-body-medium font-semibold text-neutral-950">{Math.round(pipeline.win_rate_percent)}%</p>
              </div>
              <div>
                <p className="text-caption text-neutral-600">Avg Deal Cycle</p>
                <p className="text-body-medium font-semibold text-neutral-950">{Math.round(pipeline.avg_deal_cycle_days)} days</p>
              </div>
            </div>
            <div className="space-y-2">
              {pipeline.stages.map((s) => (
                <div
                  key={s.stage}
                  className="flex cursor-default items-center gap-3"
                  title={`${STAGE_LABELS[s.stage] ?? s.stage}: ${s.count} deal${s.count === 1 ? "" : "s"}, ₹${s.total_value.toLocaleString("en-US")}, avg ${Math.round(s.avg_days_in_stage)}d in stage`}
                >
                  <span className="w-28 shrink-0 text-caption text-neutral-600">{STAGE_LABELS[s.stage] ?? s.stage}</span>
                  <div className="h-2 flex-1 bar-track overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${(s.total_value / maxStageValue) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-caption text-neutral-600">
                    {s.count} · ₹{s.total_value.toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-body-medium font-semibold text-neutral-950">Lead Source Breakdown</h2>
          {sourceBreakdown.length === 0 ? (
            <p className="text-small text-neutral-600">No leads yet.</p>
          ) : (
            <div className="space-y-2">
              {sourceBreakdown.map(([source, count]) => (
                <div
                  key={source}
                  className="flex cursor-default items-center gap-3"
                  title={`${SOURCE_LABELS[source] ?? source}: ${count} lead${count === 1 ? "" : "s"}`}
                >
                  <span className="w-28 shrink-0 truncate text-caption text-neutral-600">{SOURCE_LABELS[source] ?? source}</span>
                  <div className="h-2 flex-1 bar-track overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${(count / maxSourceCount) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-caption text-neutral-600">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-body-medium font-semibold text-neutral-950">Activity — Last 7 Days</h2>
          <div className="flex items-end gap-2">
            {dayBuckets.map((b, i) => (
              <div
                key={i}
                className="flex flex-1 cursor-default flex-col items-center gap-1"
                title={`${b.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}: ${b.count} activit${b.count === 1 ? "y" : "ies"}`}
              >
                <span className="text-caption text-neutral-600">{b.count}</span>
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t bg-primary-600"
                    style={{ height: `${Math.max((b.count / maxDayCount) * 100, b.count > 0 ? 6 : 2)}%` }}
                  />
                </div>
                <span className="text-caption text-neutral-500">{dayLabel(b.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-body-medium font-semibold text-neutral-950">Recent Leads</h2>
            <Button href="/crm/leads" variant="secondary" size="icon-sm" className="!w-auto !px-3">
              View all
            </Button>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-small text-neutral-600">No leads yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar name={lead.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-medium font-medium text-neutral-950">{lead.fullName}</p>
                    {lead.companyName && <p className="truncate text-caption text-neutral-500">{lead.companyName}</p>}
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-body-medium font-semibold text-neutral-950">Recent Activities</h2>
            <Button href="/crm/activities" variant="secondary" size="icon-sm" className="!w-auto !px-3">
              View all
            </Button>
          </div>
          {recentActivities.length === 0 ? (
            <p className="text-small text-neutral-600">No activity logged yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentActivities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-medium font-medium text-neutral-950">{a.subject || `${a.type} on ${a.relatedType}`}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Pill>{a.relatedType}</Pill>
                      <span className="text-caption capitalize text-neutral-500">{a.type}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-caption text-neutral-500">{timeAgo(a.activityDate)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
