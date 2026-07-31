"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { LeadStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type Lead = { id: string; fullName: string; companyName: string | null; status: string; createdAt: string };
type Activity = { id: string; relatedType: string; type: string; subject: string | null; performedBy: string | null; activityDate: string };
type Stats = {
  total_leads: number;
  conversion_rate: number;
  total_accounts: number;
  total_contacts: number;
  activities_this_week: number;
};

export default function CrmDashboardPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/stats?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/leads?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/activities?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([statsBody, leadsBody, activitiesBody]) => {
        setStats(statsBody.data ?? null);
        setLeads(leadsBody.data ?? []);
        setActivities(activitiesBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("lead", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to CRM.</p>;

  const recentLeads = [...leads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 10);
  const recentActivities = [...activities].sort((a, b) => +new Date(b.activityDate) - +new Date(a.activityDate)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-950">CRM</h1>
        <p className="text-body text-neutral-600">Leads, accounts, and contacts at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Total Leads</p>
          <p className="text-h3 font-semibold text-neutral-950">{stats?.total_leads ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Conversion Rate</p>
          <p className="text-h3 font-semibold text-neutral-950">{Math.round((stats?.conversion_rate ?? 0) * 100)}%</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Total Accounts</p>
          <p className="text-h3 font-semibold text-neutral-950">{stats?.total_accounts ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Total Contacts</p>
          <p className="text-h3 font-semibold text-neutral-950">{stats?.total_contacts ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Activities This Week</p>
          <p className="text-h3 font-semibold text-neutral-950">{stats?.activities_this_week ?? 0}</p>
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
            <div className="space-y-2">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-body-medium font-medium text-neutral-950">{lead.fullName}</p>
                    {lead.companyName && <p className="text-caption text-neutral-500">{lead.companyName}</p>}
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
            <div className="space-y-2">
              {recentActivities.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-body-medium font-medium text-neutral-950">
                      {a.subject || `${a.type} on ${a.relatedType}`}
                    </p>
                    <p className="text-caption text-neutral-500 capitalize">
                      {a.relatedType} · {a.type}
                    </p>
                  </div>
                  <span className="shrink-0 text-caption text-neutral-500">{timeAgo(a.activityDate)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-body-medium font-semibold text-neutral-950">Pipeline Summary</h2>
        <p className="mt-1 text-small text-neutral-600">Coming in CRM Batch 2 — deal value and stage rollups across your pipeline will show up here.</p>
      </Card>
    </div>
  );
}
