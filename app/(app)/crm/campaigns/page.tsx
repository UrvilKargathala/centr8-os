"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card, CardButton } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Badge, type BadgeColor } from "@/components/ui/Badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { fmtMoney } from "../deals/page";

const CAMPAIGN_TYPES = ["email", "social", "event", "webinar", "referral", "paid_ads", "content", "cold_outreach", "other"] as const;
const CAMPAIGN_STATUSES = ["planned", "draft", "active", "paused", "completed", "cancelled"] as const;
const CAMPAIGN_CHANNELS = ["email", "linkedin", "google_ads", "facebook", "instagram", "twitter", "event", "other"] as const;

const STATUS_COLOR: Record<string, BadgeColor> = {
  planned: "neutral",
  draft: "neutral",
  active: "info",
  paused: "warning",
  completed: "success",
  cancelled: "danger",
};

function humanize(v: string) {
  return v.replace(/_/g, " ");
}

type Campaign = {
  id: string;
  name: string;
  type: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetAllocated: number | null;
  budgetSpent: number;
  currency: string;
  ownerId: string | null;
};
type Stats = {
  active_campaigns: number;
  total_budget_allocated: number;
  total_leads_generated: number;
  best_performing: { name: string; roi: number } | null;
};
type Metrics = { leads_count: number; deals_count: number; revenue_won: number; roi_percent: number | null };
type Employee = { id: string; fullName: string };

export default function CampaignsPage() {
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metricsById, setMetricsById] = useState<Record<string, Metrics>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showNew, setShowNew] = useState(false);

  const canCreate = can("campaign", "create");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/campaigns?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/campaigns/stats?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(async ([c, s, e]) => {
        const list: Campaign[] = c.data ?? [];
        setCampaigns(list);
        setStats(s.data ?? null);
        setEmployees(e.data ?? []);
        const entries = await Promise.all(
          list.map(async (camp) => {
            const body = await fetch(`/api/crm/campaigns/${camp.id}`).then((r) => r.json());
            return [camp.id, { leads_count: body.data?.leads_count ?? 0, deals_count: body.data?.deals_count ?? 0, revenue_won: body.data?.revenue_won ?? 0, roi_percent: body.data?.roi_percent ?? null }] as const;
          }),
        );
        setMetricsById(Object.fromEntries(entries));
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "Unassigned";

  const filtered = useMemo(
    () =>
      campaigns.filter((c) => {
        if (status && c.status !== status) return false;
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [campaigns, search, status],
  );

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("campaign", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to campaigns.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Campaigns</h1>
          <p className="text-body text-neutral-600">Track marketing efforts and measure ROI.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
          {canCreate && <Button onClick={() => setShowNew(true)}>+ New Campaign</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Active Campaigns</p>
          <p className="text-h3 font-semibold text-neutral-950">{stats?.active_campaigns ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Total Budget Allocated</p>
          <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(stats?.total_budget_allocated ?? 0, "INR")}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Total Leads Generated</p>
          <p className="text-h3 font-semibold text-neutral-950">{stats?.total_leads_generated ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Best ROI Campaign</p>
          {stats?.best_performing ? (
            <p className="text-body-medium font-semibold text-neutral-950">
              {stats.best_performing.name} ({Math.round(stats.best_performing.roi)}%)
            </p>
          ) : (
            <p className="text-body-medium text-neutral-600">No data yet</p>
          )}
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No campaigns found</EmptyTitle>
            <EmptyDescription>Try adjusting your filters, or create your first campaign.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const m = metricsById[c.id];
            const spent = c.budgetSpent ?? 0;
            const allocated = c.budgetAllocated ?? 0;
            const pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
            const barColor = allocated > 0 && spent > allocated ? "bg-danger-600" : pct > 80 ? "bg-warning-600" : "bg-success-600";
            return (
              <CardButton key={c.id} onClick={() => router.push(`/crm/campaigns/${c.id}`)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-neutral-950">{c.name}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge color="neutral">{humanize(c.type ?? "other")}</Badge>
                  <Badge color={STATUS_COLOR[c.status] ?? "neutral"}>{humanize(c.status)}</Badge>
                </div>
                <p className="mt-2 text-caption text-neutral-500">
                  {c.startDate ?? "No start"} – {c.endDate ?? "No end"} · {employeeName(c.ownerId)}
                </p>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-caption text-neutral-600">
                  <div>
                    <p className="text-body-medium font-semibold text-neutral-950">{m?.leads_count ?? "—"}</p>
                    Leads
                  </div>
                  <div>
                    <p className="text-body-medium font-semibold text-neutral-950">{m?.deals_count ?? "—"}</p>
                    Deals
                  </div>
                  <div>
                    <p className="text-body-medium font-semibold text-neutral-950">{m ? fmtMoney(m.revenue_won, c.currency) : "—"}</p>
                    Revenue
                  </div>
                  <div>
                    <p className="text-body-medium font-semibold text-neutral-950">{m?.roi_percent !== null && m?.roi_percent !== undefined ? `${Math.round(m.roi_percent)}%` : "—"}</p>
                    ROI
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-caption text-neutral-500">
                    <span>{fmtMoney(spent, c.currency)} spent</span>
                    <span>{fmtMoney(allocated, c.currency)} allocated</span>
                  </div>
                  <div className="mt-1 h-2 rounded-sm bg-neutral-200">
                    <div className={`h-2 rounded-sm ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </CardButton>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewCampaignModal
          orgId={selectedOrgId}
          employees={employees}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewCampaignModal({
  orgId,
  employees,
  onClose,
  onSaved,
}: {
  orgId: string;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("email");
  const [status, setStatus] = useState<string>("draft");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetAllocated, setBudgetAllocated] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [targetAudience, setTargetAudience] = useState("");
  const [channel, setChannel] = useState<string>("email");
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        type,
        status,
        description: description || null,
        start_date: startDate || null,
        end_date: endDate || null,
        budget_allocated: budgetAllocated ? Number(budgetAllocated) : null,
        currency,
        target_audience: targetAudience || null,
        channel,
        owner_id: ownerId || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to create campaign");
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">New Campaign</h2>
      <div className="mt-4 space-y-3">
        <Field label="Campaign name">
          <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select className="w-full" value={type} onChange={(e) => setType(e.target.value)}>
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea className="w-full" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input className="w-full" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date">
            <Input className="w-full" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget allocated">
            <Input className="w-full" type="number" value={budgetAllocated} onChange={(e) => setBudgetAllocated(e.target.value)} />
          </Field>
          <Field label="Currency">
            <Input className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
        </div>
        <Field label="Target audience">
          <Input className="w-full" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </Field>
        <Field label="Channel">
          <Select className="w-full" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CAMPAIGN_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner">
          <Select className="w-full" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving || !name}>
            {saving ? "Saving…" : "Create Campaign"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
