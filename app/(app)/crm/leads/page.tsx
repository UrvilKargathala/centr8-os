"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { LeadStatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { LEAD_STATUSES, ACTIVITY_TYPES } from "@/lib/constants";
import { PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";

const KANBAN_STATUSES = ["new", "contacted", "qualified", "unqualified"] as const;
const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
  lost: "Lost",
};

type Lead = {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  source: string | null;
  sourceDetail: string | null;
  status: string;
  score: number | null;
  scoreReasoning: string | null;
  ownerId: string | null;
  notes: string | null;
  createdAt: string;
};
type Activity = {
  id: string;
  type: string;
  subject: string | null;
  description: string | null;
  outcome: string | null;
  activityDate: string;
};
type Employee = { id: string; fullName: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function LeadsPage() {
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

  const canCreate = can("lead", "create");
  const canUpdate = can("lead", "update");
  const canConvert = can("lead", "convert");
  const canAssign = can("lead", "assign");
  const canDelete = can("lead", "delete");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    if (ownerId) params.set("owner_id", ownerId);
    if (scoreMin) params.set("score_min", scoreMin);
    if (scoreMax) params.set("score_max", scoreMax);
    if (search) params.set("search", search);
    Promise.all([
      fetch(`/api/crm/leads?${params}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([leadsBody, empBody]) => {
        setLeads(leadsBody.data ?? []);
        setEmployees(empBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [selectedOrgId, status, source, ownerId, scoreMin, scoreMax, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "Unassigned";

  const kpis = useMemo(() => {
    const active = leads.filter((l) => l.status !== "lost" && l.status !== "converted");
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newThisMonth = leads.filter((l) => new Date(l.createdAt) >= startOfMonth).length;
    const qualified = leads.filter((l) => l.status === "qualified").length;
    const converted = leads.filter((l) => l.status === "converted").length;
    const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;
    return { total: active.length, newThisMonth, qualified, conversionRate };
  }, [leads]);

  async function moveStatus(id: string, newStatus: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    await fetch(`/api/crm/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
  }

  const { page, setPage, pageSize, total, paged } = usePagination(leads, 10);

  if (orgLoading || loading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("lead", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to leads.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Leads</h1>
          <p className="text-body text-neutral-600">Track and qualify your prospects.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canCreate && <Button onClick={() => setShowNew(true)}>+ New Lead</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Total Leads</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">New This Month</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.newThisMonth}</p>
        </Card>
        <Card padding="sm">
          <button className="w-full text-left" onClick={() => setStatus("qualified")}>
            <p className="text-caption text-neutral-600">Qualified</p>
            <p className="text-h3 font-semibold text-neutral-950">{kpis.qualified}</p>
          </button>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Conversion Rate</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.conversionRate}%</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="campaign">Campaign</option>
            <option value="job_board">Job Board</option>
            <option value="manual">Manual</option>
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Score min">
          <Input type="number" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} className="w-20" />
        </Field>
        <Field label="Score max">
          <Input type="number" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} className="w-20" />
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            setStatus("");
            setSource("");
            setOwnerId("");
            setScoreMin("");
            setScoreMax("");
            setSearch("");
          }}
        >
          Clear all
        </Button>
        <div className="ml-auto flex gap-1 rounded-md border border-neutral-300 p-0.5">
          <button
            onClick={() => setView("table")}
            className={`rounded-sm px-3 py-1 text-small font-medium ${view === "table" ? "bg-danger-600 text-neutral-50" : "text-neutral-600"}`}
          >
            Table
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`rounded-sm px-3 py-1 text-small font-medium ${view === "kanban" ? "bg-danger-600 text-neutral-50" : "text-neutral-600"}`}
          >
            Kanban
          </button>
        </div>
      </div>

      {leads.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No leads found</EmptyTitle>
            <EmptyDescription>Try adjusting filters, or add your first lead.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "table" ? (
        <div className="overflow-x-auto glass-table">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-100 text-caption font-medium uppercase tracking-wide text-neutral-500">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody className="bg-neutral-50">
              {paged.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelected(lead)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={lead.fullName} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-950">{lead.fullName}</p>
                        {lead.companyName && <p className="truncate text-small text-neutral-600">{lead.companyName}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{lead.email ?? "—"}</TableCell>
                  <TableCell className="capitalize">{lead.source ?? "—"}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>{lead.score ?? "—"}</TableCell>
                  <TableCell>{employeeName(lead.ownerId)}</TableCell>
                  <TableCell>{timeAgo(lead.createdAt)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setSelected(lead)}
                        title="View"
                        aria-label="View"
                        className="rounded-md p-1.5 text-neutral-600 hover:bg-primary-100 hover:text-primary-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KANBAN_STATUSES.map((s) => (
            <div
              key={s}
              className="min-h-[10rem] rounded-md border border-neutral-300 bg-neutral-100 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveStatus(id, s);
              }}
            >
              <p className="mb-2 text-caption font-semibold uppercase text-neutral-600">{STATUS_LABEL[s]}</p>
              <div className="space-y-2">
                {leads.filter((l) => l.status === s).map((lead) => (
                  <div
                    key={lead.id}
                    draggable={canUpdate}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
                    onClick={() => setSelected(lead)}
                    className="cursor-pointer rounded-sm border border-neutral-300 bg-neutral-50 p-2 text-body shadow-sm hover:shadow-md"
                  >
                    <p className="font-medium text-neutral-950">{lead.fullName}</p>
                    {lead.companyName && <p className="text-caption text-neutral-500">{lead.companyName}</p>}
                    <div className="mt-1 flex items-center justify-between text-caption text-neutral-500">
                      <span>{lead.score !== null ? `Score ${lead.score}` : ""}</span>
                      <span>{employeeName(lead.ownerId)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewLeadModal
          orgId={selectedOrgId}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {selected && (
        <LeadDetailModal
          orgId={selectedOrgId}
          lead={selected}
          employees={employees}
          canUpdate={canUpdate}
          canConvert={canConvert}
          canAssign={canAssign}
          canDelete={canDelete}
          onClose={() => setSelected(null)}
          onChanged={load}
          onConverted={(accountId) => router.push(`/crm/accounts/${accountId}`)}
        />
      )}
    </div>
  );
}

function NewLeadModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("manual");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/crm/campaigns?org_id=${orgId}&status=active`)
      .then((r) => r.json())
      .then((b) => setCampaigns(b.data ?? []));
  }, [orgId]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        full_name: fullName,
        company_name: companyName || null,
        email: email || null,
        phone: phone || null,
        source,
        campaign_id: campaignId || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to create lead");
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">New Lead</h2>
      <div className="mt-4 space-y-3">
        <Field label="Full name">
          <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Company">
          <Input className="w-full" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input className="w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Source">
          <Select className="w-full" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="manual">Manual</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="campaign">Campaign</option>
            <option value="job_board">Job Board</option>
          </Select>
        </Field>
        <Field label="Campaign">
          <Select className="w-full" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving || !fullName}>
            {saving ? "Saving…" : "Create Lead"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LeadDetailModal({
  orgId,
  lead,
  employees,
  canUpdate,
  canConvert,
  canAssign,
  canDelete,
  onClose,
  onChanged,
  onConverted,
}: {
  orgId: string;
  lead: Lead;
  employees: Employee[];
  canUpdate: boolean;
  canConvert: boolean;
  canAssign: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
  onConverted: (accountId: string) => void;
}) {
  const [form, setForm] = useState(lead);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [enrichPreview, setEnrichPreview] = useState<{ industry: string; website: string | null; employee_count_range: string } | null>(null);

  function loadTimeline() {
    setLoadingTimeline(true);
    fetch(`/api/crm/leads/${lead.id}`)
      .then((r) => r.json())
      .then((body) => setActivities(body.data?.activities ?? []))
      .finally(() => setLoadingTimeline(false));
  }
  useEffect(loadTimeline, [lead.id]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/crm/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.fullName,
        company_name: form.companyName,
        email: form.email,
        phone: form.phone,
        job_title: form.jobTitle,
        score: form.score,
        score_reasoning: form.scoreReasoning,
        notes: form.notes,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to save");
    onChanged();
    onClose();
  }

  async function assign(ownerId: string) {
    await fetch(`/api/crm/leads/${lead.id}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner_id: ownerId }) });
    onChanged();
  }

  async function markLost() {
    await fetch(`/api/crm/leads/${lead.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    onChanged();
    onClose();
  }

  const activityCount = activities.length;
  const daysSinceActivity = activities.length
    ? Math.floor((Date.now() - new Date(activities[0].activityDate).getTime()) / 86400000)
    : 9999;

  const scoreAI = useAiCall<{ score: number; reasoning: string }>("Analyst", "score_lead");
  const enrichAI = useAiCall<{ industry: string; website: string | null; employee_count_range: string; job_title: string; reasoning: string }>("Analyst", "enrich_lead");
  const suggestAI = useAiCall<{ action: string; reasoning: string }>("Planner", "suggest_lead_action");

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-h3 font-semibold text-neutral-950">{lead.fullName}</h2>
          {lead.companyName && <p className="text-body text-neutral-600">{lead.companyName}</p>}
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input className="w-full" value={form.fullName} disabled={!canUpdate} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Company">
          <Input className="w-full" value={form.companyName ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input className="w-full" value={form.email ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input className="w-full" value={form.phone ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Job title">
          <Input className="w-full" value={form.jobTitle ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </Field>
        <Field label="Score">
          <Input className="w-full" type="number" value={form.score ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, score: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Notes">
          <Textarea className="w-full" value={form.notes ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </Field>
      </div>

      {canUpdate && (
        <div className="mt-3 flex flex-wrap gap-2">
          <AiButton
            label="Score this lead"
            loading={scoreAI.loading}
            onClick={() => scoreAI.run({ source: lead.source, company_name: lead.companyName, activity_count: activityCount })}
          />
          <AiButton
            label="Enrich lead data"
            loading={enrichAI.loading}
            onClick={() => enrichAI.run({ company_name: lead.companyName, email: lead.email, job_title: lead.jobTitle })}
          />
          <AiButton
            label="Suggest next action"
            loading={suggestAI.loading}
            onClick={() => suggestAI.run({ status: lead.status, days_since_last_activity: daysSinceActivity })}
          />
        </div>
      )}
      {scoreAI.result && (
        <AiSuggestionCard
          reasoning={scoreAI.result.reasoning}
          onAccept={() => {
            setForm({ ...form, score: scoreAI.result!.score, scoreReasoning: scoreAI.result!.reasoning });
            scoreAI.setResult(null);
          }}
          onReject={() => scoreAI.setResult(null)}
        >
          <p className="text-body-medium text-neutral-950">Suggested score: {scoreAI.result.score}/100</p>
        </AiSuggestionCard>
      )}
      {enrichAI.result && (
        <AiSuggestionCard
          reasoning={enrichAI.result.reasoning}
          onAccept={() => {
            setForm({ ...form, jobTitle: enrichAI.result!.job_title });
            setEnrichPreview({ industry: enrichAI.result!.industry, website: enrichAI.result!.website, employee_count_range: enrichAI.result!.employee_count_range });
            enrichAI.setResult(null);
          }}
          onReject={() => enrichAI.setResult(null)}
        >
          <p className="text-body-medium text-neutral-950">Job title: {enrichAI.result.job_title}</p>
          <p className="text-small text-neutral-600">
            Informational only (no lead columns for these): industry {enrichAI.result.industry}, website {enrichAI.result.website ?? "—"}, size {enrichAI.result.employee_count_range}
          </p>
        </AiSuggestionCard>
      )}
      {enrichPreview && (
        <p className="mt-1 text-caption text-neutral-500">
          Enrichment notes — industry: {enrichPreview.industry}, website: {enrichPreview.website ?? "—"}, size: {enrichPreview.employee_count_range}
        </p>
      )}
      {suggestAI.result && (
        <AiSuggestionCard reasoning={suggestAI.result.reasoning} onAccept={() => suggestAI.setResult(null)} onReject={() => suggestAI.setResult(null)}>
          <p className="text-body-medium text-neutral-950">{suggestAI.result.action}</p>
        </AiSuggestionCard>
      )}

      {error && <p className="mt-2 text-small text-danger-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {canUpdate && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
        {canConvert && (lead.status === "qualified" || lead.status === "contacted") && (
          <Button variant="primary" className="!bg-success-600 hover:!bg-success-600/90" onClick={() => setShowConvert(true)}>
            Convert to Account + Contact
          </Button>
        )}
        {canAssign && (
          <Select value={form.ownerId ?? ""} onChange={(e) => assign(e.target.value)} className="w-48">
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        )}
        {canDelete && lead.status !== "lost" && lead.status !== "converted" && (
          <Button variant="danger" onClick={markLost}>
            Mark Lost
          </Button>
        )}
      </div>

      <div className="mt-6 border-t border-neutral-200 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-body-medium font-semibold text-neutral-950">Activity Timeline</h3>
          <Button variant="secondary" onClick={() => setShowLogActivity((v) => !v)}>
            + Log Activity
          </Button>
        </div>
        {showLogActivity && (
          <LogActivityForm
            orgId={orgId}
            relatedType="lead"
            relatedId={lead.id}
            onLogged={() => {
              setShowLogActivity(false);
              loadTimeline();
            }}
          />
        )}
        <div className="mt-3 space-y-2">
          {loadingTimeline ? (
            <SectionSkeleton variant="text" />
          ) : activities.length === 0 ? (
            <p className="text-small text-neutral-600">No activity logged yet.</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="rounded-sm border border-neutral-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-semibold uppercase text-neutral-600">{a.type}</span>
                  <span className="text-caption text-neutral-500">{timeAgo(a.activityDate)}</span>
                </div>
                {a.subject && <p className="text-body-medium text-neutral-950">{a.subject}</p>}
                {a.description && <p className="text-small text-neutral-600">{a.description}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {showConvert && (
        <ConvertConfirmModal
          lead={lead}
          onClose={() => setShowConvert(false)}
          onConfirmed={(accountId) => {
            setShowConvert(false);
            onClose();
            onConverted(accountId);
          }}
        />
      )}
    </Modal>
  );
}

function ConvertConfirmModal({ lead, onClose, onConfirmed }: { lead: Lead; onClose: () => void; onConfirmed: (accountId: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDeal, setCreateDeal] = useState(true);
  const [dealName, setDealName] = useState(`${lead.companyName || lead.fullName} — New Deal`);
  const [dealValue, setDealValue] = useState("");

  async function confirm() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/crm/leads/${lead.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        create_deal: createDeal,
        deal_name: createDeal ? dealName : undefined,
        deal_value: createDeal && dealValue ? Number(dealValue) : null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to convert");
    onConfirmed(body.data.account.id);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">Convert Lead</h2>
      <p className="mt-2 text-body text-neutral-600">This will create:</p>
      <ul className="mt-2 space-y-1 text-body text-neutral-950">
        <li>
          <span className="font-medium">Account:</span> {lead.companyName || lead.fullName}
        </li>
        <li>
          <span className="font-medium">Contact:</span> {lead.fullName} {lead.email ? `· ${lead.email}` : ""} {lead.phone ? `· ${lead.phone}` : ""}
        </li>
      </ul>

      <label className="mt-4 flex items-center gap-2 text-body text-neutral-950">
        <input type="checkbox" checked={createDeal} onChange={(e) => setCreateDeal(e.target.checked)} />
        Also create a deal
      </label>
      {createDeal && (
        <div className="mt-2 space-y-2">
          <Field label="Deal name">
            <Input className="w-full" value={dealName} onChange={(e) => setDealName(e.target.value)} />
          </Field>
          <Field label="Initial value (optional)">
            <Input className="w-full" type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
          </Field>
        </div>
      )}

      {error && <p className="mt-2 text-small text-danger-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button className="!bg-success-600 hover:!bg-success-600/90" onClick={confirm} disabled={saving}>
          {saving ? "Converting…" : "Confirm Conversion"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

export function LogActivityForm({
  orgId,
  relatedType,
  relatedId,
  onLogged,
}: {
  orgId: string;
  relatedType: "lead" | "account" | "contact" | "deal";
  relatedId: string;
  onLogged: () => void;
}) {
  const [type, setType] = useState<string>("note");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [saving, setSaving] = useState(false);

  async function log() {
    setSaving(true);
    await fetch("/api/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        related_type: relatedType,
        related_id: relatedId,
        activity_type: type,
        subject: subject || null,
        description: description || null,
        outcome: outcome || null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      }),
    });
    setSaving(false);
    onLogged();
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-neutral-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <Select className="w-full" value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duration (min)">
          <Input className="w-full" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </Field>
      </div>
      <Field label="Subject">
        <Input className="w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea className="w-full" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
      <Field label="Outcome">
        <Input className="w-full" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </Field>
      <Button onClick={log} disabled={saving}>
        {saving ? "Logging…" : "Log Activity"}
      </Button>
    </div>
  );
}
