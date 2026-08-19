"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar, ViewIconLink } from "@/components/ui/Avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { PageSkeleton } from "@/components/ui/skeleton";

const STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"] as const;
export const STAGE_LABEL: Record<string, string> = {
  prospecting: "Prospecting",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  contract_sent: "Contract Sent",
  won: "Won",
  lost: "Lost",
};
export const STAGE_BADGE_COLOR: Record<string, "neutral" | "info" | "warning" | "danger" | "success"> = {
  prospecting: "neutral",
  discovery: "info",
  proposal: "info",
  negotiation: "warning",
  contract_sent: "warning",
  won: "success",
  lost: "danger",
};

export type Deal = {
  id: string;
  name: string;
  accountId: string | null;
  primaryContactId: string | null;
  ownerId: string | null;
  stage: string;
  probability: number | null;
  value: number | null;
  currency: string;
  expectedCloseDate: string | null;
  stageChangedAt: string;
  nextStep: string | null;
};
type Account = { id: string; name: string };
type Contact = { id: string; fullName: string; accountId: string | null };
type Employee = { id: string; fullName: string };
type StageStat = { stage: string; count: number; total_value: number; avg_days_in_stage: number };
type PipelineStats = {
  stages: StageStat[];
  total_pipeline_value: number;
  weighted_pipeline_value: number;
  avg_deal_cycle_days: number;
  win_rate_percent: number;
};

export function isStale(stageChangedAt: string) {
  return (Date.now() - new Date(stageChangedAt).getTime()) / 86400000 > 14;
}
function daysInStage(stageChangedAt: string) {
  return Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000);
}
export function fmtMoney(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export default function DealsPage() {
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const { show: showToast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table" | "forecast">("kanban");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newDefaults, setNewDefaults] = useState<{ stage: string; accountId?: string } | null>(null);
  const [sortKey, setSortKey] = useState<keyof Deal>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const canCreate = can("deal", "create");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/deals?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/accounts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/contacts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/crm/deals/pipeline-stats?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([d, a, c, e, s]) => {
        setDeals(d.data ?? []);
        setAccounts(a.data ?? []);
        setContacts(c.data ?? []);
        setEmployees(e.data ?? []);
        setStats(s.data ?? null);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "No account";
  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "Unassigned";

  const filteredDeals = useMemo(
    () => deals.filter((d) => (search ? d.name.toLowerCase().includes(search.toLowerCase()) : true)),
    [deals, search],
  );

  const kpis = useMemo(() => {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfNextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    const closingThisMonth = deals.filter((d) => {
      if (!d.expectedCloseDate || d.stage === "won" || d.stage === "lost") return false;
      const dt = new Date(d.expectedCloseDate);
      return dt >= startOfMonth && dt < startOfNextMonth;
    }).length;
    return {
      openPipeline: stats?.total_pipeline_value ?? 0,
      weighted: stats?.weighted_pipeline_value ?? 0,
      closingThisMonth,
      winRate: stats?.win_rate_percent ?? 0,
      avgCycle: stats?.avg_deal_cycle_days ?? 0,
    };
  }, [deals, stats]);

  async function moveStage(id: string, stage: string) {
    const prev = deals;
    setDeals((cur) => cur.map((d) => (d.id === id ? { ...d, stage, stageChangedAt: new Date().toISOString() } : d)));
    const res = await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      setDeals(prev);
      showToast("Failed to move deal", "error");
    } else {
      load();
    }
  }

  const sortedDeals = useMemo(() => {
    return [...filteredDeals].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
  }, [filteredDeals, sortKey, sortDir]);
  function toggleSort(key: keyof Deal) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const { page, setPage, pageSize, total, paged } = usePagination(sortedDeals, 10);

  if (orgLoading || loading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("deal", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to deals.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Deals</h1>
          <p className="text-body text-neutral-600">Manage your sales pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search deals…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canCreate && (
            <Button
              onClick={() => {
                setNewDefaults({ stage: "prospecting" });
                setShowNew(true);
              }}
            >
              + New Deal
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Open Pipeline</p>
          <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(kpis.openPipeline, "INR")}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Weighted Pipeline</p>
          <p className="text-h3 font-semibold text-neutral-950">{fmtMoney(kpis.weighted, "INR")}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Closing This Month</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.closingThisMonth}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Win Rate</p>
          <p className="text-h3 font-semibold text-neutral-950">{Math.round(kpis.winRate)}%</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Avg Deal Cycle</p>
          <p className="text-h3 font-semibold text-neutral-950">{Math.round(kpis.avgCycle)} days</p>
        </Card>
      </div>

      <div className="flex w-fit gap-1 glass p-0.5">
        {(["kanban", "table", "forecast"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-sm px-3 py-1 text-small font-medium capitalize ${view === v ? "bg-danger-600 text-neutral-50" : "text-neutral-600"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {filteredDeals.length === 0 && view !== "forecast" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No deals found</EmptyTitle>
            <EmptyDescription>Try adjusting your search, or add your first deal.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((s) => {
            const stat = stats?.stages.find((st) => st.stage === s);
            return (
              <div
                key={s}
                className="glass min-h-[12rem] p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveStage(id, s);
                }}
              >
                <p className="mb-1 text-caption font-semibold uppercase text-neutral-600">{STAGE_LABEL[s]}</p>
                <p className="mb-2 text-caption text-neutral-500">
                  {stat?.count ?? 0} deals · {fmtMoney(stat?.total_value ?? 0, "INR")}
                </p>
                <div className="space-y-2">
                  {filteredDeals
                    .filter((d) => d.stage === s)
                    .map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", deal.id)}
                        onClick={() => router.push(`/crm/deals/${deal.id}`)}
                        title={`${deal.name} · ${accountName(deal.accountId)}\n${fmtMoney(deal.value, deal.currency)} · ${deal.probability ?? 0}% probability\nExpected close: ${deal.expectedCloseDate ?? "No date"}\nOwner: ${employeeName(deal.ownerId)}${isStale(deal.stageChangedAt) ? "\nStale — no stage change in a while" : ""}`}
                        className="glass-card cursor-pointer p-2 text-body hover:shadow-md"
                      >
                        <p className="font-medium text-neutral-950">{deal.name}</p>
                        <p className="text-caption text-neutral-500">{accountName(deal.accountId)}</p>
                        <p className="mt-1 text-body-medium font-semibold text-neutral-950">{fmtMoney(deal.value, deal.currency)}</p>
                        <div className="mt-1 flex items-center justify-between text-caption text-neutral-500">
                          <span className={deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date() ? "text-danger-600" : ""}>
                            {deal.expectedCloseDate ?? "No date"}
                          </span>
                          <span>{employeeName(deal.ownerId)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <Badge color="neutral">{deal.probability ?? 0}%</Badge>
                          {isStale(deal.stageChangedAt) && <Badge color="warning">Stale</Badge>}
                        </div>
                      </div>
                    ))}
                </div>
                {canCreate && (
                  <button
                    className="mt-2 w-full rounded-sm border border-dashed border-neutral-400 py-1 text-caption text-neutral-600 hover:bg-neutral-200"
                    onClick={() => {
                      setNewDefaults({ stage: s });
                      setShowNew(true);
                    }}
                  >
                    + Add deal
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto glass-table">
          <Table>
            <TableHeader>
              <TableRow className="text-caption font-medium uppercase tracking-wide text-neutral-500">
                <TableHead onClick={() => toggleSort("name")} className="cursor-pointer">
                  Deal
                </TableHead>
                <TableHead onClick={() => toggleSort("value")} className="cursor-pointer">
                  Value
                </TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead onClick={() => toggleSort("expectedCloseDate")} className="cursor-pointer">
                  Expected Close
                </TableHead>
                <TableHead>Days in Stage</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Next Step</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((deal) => (
                <TableRow key={deal.id} className="cursor-pointer" onClick={() => router.push(`/crm/deals/${deal.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={deal.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-950">{deal.name}</p>
                        <p className="truncate text-small text-neutral-600">{accountName(deal.accountId)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{fmtMoney(deal.value, deal.currency)}</TableCell>
                  <TableCell>
                    <Badge color={STAGE_BADGE_COLOR[deal.stage] ?? "neutral"}>{STAGE_LABEL[deal.stage] ?? deal.stage}</Badge>
                  </TableCell>
                  <TableCell>{deal.probability ?? 0}%</TableCell>
                  <TableCell>{deal.expectedCloseDate ?? "—"}</TableCell>
                  <TableCell>{daysInStage(deal.stageChangedAt)}d</TableCell>
                  <TableCell>{employeeName(deal.ownerId)}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{deal.nextStep ?? "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <ViewIconLink href={`/crm/deals/${deal.id}`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      ) : (
        <ForecastView deals={deals} stats={stats} />
      )}

      {showNew && newDefaults && (
        <NewDealModal
          orgId={selectedOrgId}
          accounts={accounts}
          contacts={contacts}
          employees={employees}
          defaults={newDefaults}
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

function ForecastView({ deals, stats }: { deals: Deal[]; stats: PipelineStats | null }) {
  const shades = ["bg-danger-200", "bg-danger-300", "bg-danger-400", "bg-danger-500", "bg-danger-600"];
  const totalOpen = stats?.total_pipeline_value ?? 0;
  const openStages = stats?.stages ?? [];

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      if (d.stage === "won" || d.stage === "lost") continue;
      const key = d.expectedCloseDate ? d.expectedCloseDate.slice(0, 7) : "No date set";
      map.set(key, (map.get(key) ?? 0) + Number(d.value ?? 0));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [deals]);
  const maxMonth = Math.max(1, ...byMonth.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-body-medium font-semibold text-neutral-950">Pipeline by Stage</h3>
        <div className="mt-3 flex h-6 w-full overflow-hidden rounded-sm">
          {openStages.map((s, i) => (
            <div
              key={s.stage}
              className={shades[i % shades.length]}
              style={{ width: totalOpen > 0 ? `${(s.total_value / totalOpen) * 100}%` : 0 }}
              title={`${STAGE_LABEL[s.stage]}: ${fmtMoney(s.total_value, "INR")}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-caption text-neutral-600">
          {openStages.map((s, i) => (
            <span key={s.stage} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${shades[i % shades.length]}`} />
              {STAGE_LABEL[s.stage]}: {fmtMoney(s.total_value, "INR")}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-body-medium font-semibold text-neutral-950">Expected Close by Month</h3>
        <div className="mt-3 space-y-2">
          {byMonth.map(([month, value]) => (
            <div key={month} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-caption text-neutral-600">{month}</span>
              <div className="bar-track h-4 flex-1 rounded-sm bg-neutral-200">
                <div className="h-4 rounded-sm bg-danger-600" style={{ width: `${(value / maxMonth) * 100}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-caption text-neutral-600">{fmtMoney(value, "INR")}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function NewDealModal({
  orgId,
  accounts,
  contacts,
  employees,
  defaults,
  onClose,
  onSaved,
}: {
  orgId: string;
  accounts: Account[];
  contacts: Contact[];
  employees: Employee[];
  defaults: { stage: string; accountId?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(defaults.accountId ?? "");
  const [contactId, setContactId] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [stage] = useState(defaults.stage);
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredContacts = accountId ? contacts.filter((c) => c.accountId === accountId) : contacts;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        name,
        account_id: accountId || null,
        primary_contact_id: contactId || null,
        value: value ? Number(value) : null,
        currency,
        expected_close_date: expectedCloseDate || null,
        stage,
        owner_id: ownerId || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to create deal");
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">New Deal</h2>
      <div className="mt-4 space-y-3">
        <Field label="Deal name">
          <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!defaults.accountId && (
          <Field label="Account">
            <Select className="w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Primary contact">
          <Select className="w-full" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">No contact</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Value">
            <Input className="w-full" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Currency">
            <Input className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
        </div>
        <Field label="Expected close date">
          <Input className="w-full" type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
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
            {saving ? "Saving…" : "Create Deal"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
