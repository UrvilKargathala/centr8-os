"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Badge, DealStageBadge, LeadStatusBadge, type BadgeColor } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { useToast } from "@/components/ui/Toast";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "../../deals/page";

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
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetAllocated: number | null;
  budgetSpent: number;
  currency: string;
  targetAudience: string | null;
  channel: string | null;
  ownerId: string | null;
  notes: string | null;
};
type CampaignDetail = {
  campaign: Campaign;
  leads_count: number;
  deals_count: number;
  revenue_won: number;
  roi_percent: number | null;
  cost_per_lead: number | null;
};
type Lead = { id: string; fullName: string; companyName: string | null; status: string; score: number | null; ownerId: string | null; createdAt: string };
type Deal = { id: string; name: string; accountId: string | null; value: number | null; currency: string; stage: string; probability: number | null; expectedCloseDate: string | null };
type Account = { id: string; name: string };
type Employee = { id: string; fullName: string };

const TABS = ["Overview", "Leads", "Deals", "AI Insights"] as const;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const { show: showToast } = useToast();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const canUpdate = can("campaign", "update");

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/campaigns/${id}`).then((r) => r.json()),
      fetch(`/api/crm/campaigns/${id}/leads`).then((r) => r.json()),
      fetch(`/api/crm/campaigns/${id}/deals`).then((r) => r.json()),
    ])
      .then(([d, l, deals]) => {
        setDetail(d.data ?? null);
        setEditForm(d.data?.campaign ?? null);
        setLeads(l.data ?? []);
        setDeals(deals.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedOrgId) return;
    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/accounts?org_id=${selectedOrgId}`).then((r) => r.json()),
    ]).then(([e, a]) => {
      setEmployees(e.data ?? []);
      setAccounts(a.data ?? []);
    });
  }, [selectedOrgId]);

  const employeeName = (empId: string | null) => employees.find((e) => e.id === empId)?.fullName ?? "Unassigned";
  const accountName = (accId: string | null) => accounts.find((a) => a.id === accId)?.name ?? "No account";

  const analyzeAI = useAiCall<string>("Analyst", "analyze_campaign");
  const improveAI = useAiCall<{ improvements: { suggestion: string; reasoning: string; expected_impact: string }[] }>("Planner", "suggest_campaign_improvements");
  const copyAI = useAiCall<{ subject: string | null; body: string; channel_note: string; reasoning: string }>("Writer", "draft_campaign_copy");

  async function saveOverview() {
    if (!editForm) return;
    setSaving(true);
    await fetch(`/api/crm/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        type: editForm.type,
        status: editForm.status,
        description: editForm.description,
        start_date: editForm.startDate,
        end_date: editForm.endDate,
        budget_allocated: editForm.budgetAllocated,
        budget_spent: editForm.budgetSpent,
        currency: editForm.currency,
        target_audience: editForm.targetAudience,
        channel: editForm.channel,
        owner_id: editForm.ownerId,
        notes: editForm.notes,
      }),
    });
    setSaving(false);
    setEditing(false);
    showToast("Campaign saved");
    load();
  }

  async function setStatus(status: string) {
    await fetch(`/api/crm/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    showToast(`Campaign ${humanize(status)}`);
    load();
  }

  if (orgLoading || loading) return <PageSkeleton variant="detail" />;
  if (!detail) return <p className="text-body text-neutral-600">Campaign not found.</p>;

  const campaign = detail.campaign;
  const spent = campaign.budgetSpent ?? 0;
  const allocated = campaign.budgetAllocated ?? 0;
  const pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
  const barColor = allocated > 0 && spent > allocated ? "bg-danger-600" : pct > 80 ? "bg-warning-600" : "bg-success-600";

  const qualifiedCount = leads.filter((l) => l.status === "qualified" || l.status === "converted").length;
  const convertedCount = leads.filter((l) => l.status === "converted").length;
  const totalDealValue = deals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const wonDealsCount = deals.filter((d) => d.stage === "won").length;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 font-semibold text-neutral-950">{campaign.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge color="neutral">{humanize(campaign.type ?? "other")}</Badge>
              <Badge color={STATUS_COLOR[campaign.status] ?? "neutral"}>{humanize(campaign.status)}</Badge>
            </div>
            <p className="mt-2 text-small text-neutral-600">
              {campaign.startDate ?? "No start"} – {campaign.endDate ?? "No end"} · Owner: {employeeName(campaign.ownerId)}
            </p>
            <div className="mt-2 max-w-sm">
              <div className="flex items-center justify-between text-caption text-neutral-500">
                <span>{fmtMoney(spent, campaign.currency)} spent</span>
                <span>{fmtMoney(allocated, campaign.currency)} allocated</span>
              </div>
              <div className="mt-1 h-2 rounded-sm bg-neutral-200">
                <div className={`h-2 rounded-sm ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          {canUpdate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancel Edit" : "Edit"}
              </Button>
              {campaign.status === "active" ? (
                <Button variant="secondary" onClick={() => setStatus("paused")}>
                  Pause
                </Button>
              ) : campaign.status === "paused" ? (
                <Button variant="secondary" onClick={() => setStatus("active")}>
                  Resume
                </Button>
              ) : null}
              {campaign.status !== "completed" && campaign.status !== "cancelled" && (
                <Button variant="secondary" onClick={() => setStatus("completed")}>
                  Complete
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-body-medium font-medium ${tab === t ? "border-b-2 border-danger-600 text-neutral-950" : "text-neutral-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <Card>
          {editing && canUpdate && editForm ? (
            <div className="space-y-3">
              <Field label="Name">
                <Input className="w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select className="w-full" value={editForm.type ?? "other"} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                    {CAMPAIGN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {humanize(t)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select className="w-full" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    {CAMPAIGN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Description">
                <Textarea className="w-full" value={editForm.description ?? ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <Input className="w-full" type="date" value={editForm.startDate ?? ""} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                </Field>
                <Field label="End date">
                  <Input className="w-full" type="date" value={editForm.endDate ?? ""} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Budget allocated">
                  <Input
                    type="number"
                    value={editForm.budgetAllocated ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, budgetAllocated: e.target.value ? Number(e.target.value) : null })}
                  />
                </Field>
                <Field label="Budget spent">
                  <Input
                    type="number"
                    value={editForm.budgetSpent ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, budgetSpent: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Currency">
                  <Input className="w-full" value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} />
                </Field>
              </div>
              <Field label="Target audience">
                <Input className="w-full" value={editForm.targetAudience ?? ""} onChange={(e) => setEditForm({ ...editForm, targetAudience: e.target.value })} />
              </Field>
              <Field label="Channel">
                <Select className="w-full" value={editForm.channel ?? "other"} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })}>
                  {CAMPAIGN_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Owner">
                <Select className="w-full" value={editForm.ownerId ?? ""} onChange={(e) => setEditForm({ ...editForm, ownerId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea className="w-full" value={editForm.notes ?? ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
              </Field>
              <Button onClick={saveOverview} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-small sm:grid-cols-3">
              <div>
                <p className="text-caption text-neutral-500">Description</p>
                <p className="text-neutral-950">{campaign.description ?? "—"}</p>
              </div>
              <div>
                <p className="text-caption text-neutral-500">Target audience</p>
                <p className="text-neutral-950">{campaign.targetAudience ?? "—"}</p>
              </div>
              <div>
                <p className="text-caption text-neutral-500">Channel</p>
                <p className="text-neutral-950">{campaign.channel ? humanize(campaign.channel) : "—"}</p>
              </div>
              <div>
                <p className="text-caption text-neutral-500">Notes</p>
                <p className="text-neutral-950">{campaign.notes ?? "—"}</p>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-5">
            <div>
              <p className="text-caption text-neutral-600">Leads generated</p>
              <p className="text-h3 font-semibold text-neutral-950">{detail.leads_count}</p>
            </div>
            <div>
              <p className="text-caption text-neutral-600">Deals created</p>
              <p className="text-h3 font-semibold text-neutral-950">{detail.deals_count}</p>
            </div>
            <div>
              <p className="text-caption text-neutral-600">Revenue won</p>
              <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(detail.revenue_won, campaign.currency)}</p>
            </div>
            <div>
              <p className="text-caption text-neutral-600">ROI</p>
              <p className="text-h3 font-semibold text-neutral-950">{detail.roi_percent !== null ? `${Math.round(detail.roi_percent)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-caption text-neutral-600">Cost per lead</p>
              <p className="text-h3 font-semibold text-neutral-950">{detail.cost_per_lead !== null ? fmtMoney(detail.cost_per_lead, campaign.currency) : "—"}</p>
            </div>
          </div>
        </Card>
      )}

      {tab === "Leads" && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-small text-neutral-600">
            <span>{leads.length} total leads</span>
            <span>→</span>
            <span>{qualifiedCount} qualified</span>
            <span>→</span>
            <span>{convertedCount} converted</span>
            <span>→</span>
            <span>{detail.deals_count} deals created</span>
            <span>→</span>
            <span>{wonDealsCount} won</span>
          </div>
          {leads.length === 0 ? (
            <p className="text-small text-neutral-600">No leads attributed to this campaign yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => router.push(`/crm/leads`)}>
                    <TableCell>{l.fullName}</TableCell>
                    <TableCell>{l.companyName ?? "—"}</TableCell>
                    <TableCell>
                      <LeadStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell>{l.score ?? "—"}</TableCell>
                    <TableCell>{employeeName(l.ownerId)}</TableCell>
                    <TableCell>{new Date(l.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </Card>
      )}

      {tab === "Deals" && (
        <Card>
          <p className="mb-3 text-small text-neutral-600">Total deal value: {fmtMoney(totalDealValue, campaign.currency)}</p>
          {deals.length === 0 ? (
            <p className="text-small text-neutral-600">No deals attributed to this campaign yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Expected close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/crm/deals/${d.id}`)}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{accountName(d.accountId)}</TableCell>
                    <TableCell>{fmtMoney(d.value, d.currency)}</TableCell>
                    <TableCell>
                      <DealStageBadge stage={d.stage} />
                    </TableCell>
                    <TableCell>{d.probability ?? 0}%</TableCell>
                    <TableCell>{d.expectedCloseDate ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </Card>
      )}

      {tab === "AI Insights" && (
        <Card>
          <div className="flex flex-wrap gap-2">
            <AiButton
              label="Analyze campaign performance"
              loading={analyzeAI.loading}
              onClick={() =>
                analyzeAI.run({
                  name: campaign.name,
                  leads_count: detail.leads_count,
                  deals_count: detail.deals_count,
                  cost_per_lead: detail.cost_per_lead,
                  roi_percent: detail.roi_percent,
                })
              }
            />
            <AiButton
              label="Suggest campaign improvements"
              loading={improveAI.loading}
              onClick={() => improveAI.run({ type: campaign.type, cost_per_lead: detail.cost_per_lead, roi_percent: detail.roi_percent })}
            />
            <AiButton
              label="Draft campaign copy"
              loading={copyAI.loading}
              onClick={() => {
                setShowCopyModal(true);
                copyAI.run({ type: campaign.type, target_audience: campaign.targetAudience, description: campaign.description });
              }}
            />
          </div>

          {analyzeAI.result && (
            <AiSuggestionCard onAccept={() => analyzeAI.setResult(null)} onReject={() => analyzeAI.setResult(null)}>
              <p className="text-body text-neutral-950">{analyzeAI.result}</p>
            </AiSuggestionCard>
          )}

          {improveAI.result && (
            <AiSuggestionCard onAccept={() => improveAI.setResult(null)} onReject={() => improveAI.setResult(null)}>
              <div className="space-y-2">
                {improveAI.result.improvements.map((imp, i) => (
                  <div key={i} className="glass-card rounded-sm p-2">
                    <p className="text-body-medium font-medium text-neutral-950">{imp.suggestion}</p>
                    <p className="text-caption text-neutral-500">{imp.reasoning}</p>
                    <p className="text-caption text-neutral-500">Expected impact: {imp.expected_impact}</p>
                  </div>
                ))}
              </div>
            </AiSuggestionCard>
          )}
        </Card>
      )}

      {showCopyModal && (
        <Modal onClose={() => setShowCopyModal(false)}>
          <h2 className="text-h3 font-semibold text-neutral-950">Draft Campaign Copy</h2>
          {copyAI.loading && <p className="mt-4 text-small text-neutral-600">Thinking…</p>}
          {copyAI.result && (
            <AiSuggestionCard
              reasoning={copyAI.result.reasoning}
              onAccept={() => {
                const text = copyAI.result!.subject ? `${copyAI.result!.subject}\n\n${copyAI.result!.body}` : copyAI.result!.body;
                navigator.clipboard.writeText(text);
                showToast("Copied to clipboard");
                copyAI.setResult(null);
                setShowCopyModal(false);
              }}
              onReject={() => {
                copyAI.setResult(null);
                setShowCopyModal(false);
              }}
            >
              {copyAI.result.subject && <p className="text-body-medium font-medium text-neutral-950">{copyAI.result.subject}</p>}
              <p className="whitespace-pre-wrap text-small text-neutral-700">{copyAI.result.body}</p>
              <p className="text-caption text-neutral-500">{copyAI.result.channel_note}</p>
            </AiSuggestionCard>
          )}
        </Modal>
      )}

      <p className="text-caption text-neutral-500">
        <Link href="/crm/campaigns" className="underline">
          Back to Campaigns
        </Link>
      </p>
    </div>
  );
}
