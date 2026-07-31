"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field } from "@/components/ui/Input";
import { AccountTypeBadge, AccountStatusBadge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES } from "@/lib/constants";

type Account = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  type: string;
  status: string;
  annualRevenue: number | null;
  currency: string;
  ownerId: string | null;
};
type Contact = { id: string; accountId: string | null };
type Employee = { id: string; fullName: string };

export default function AccountsPage() {
  const router = useRouter();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [industry, setIndustry] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [showNew, setShowNew] = useState(false);

  const canCreate = can("account", "create");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (industry) params.set("industry", industry);
    if (ownerId) params.set("owner_id", ownerId);
    if (search) params.set("search", search);
    Promise.all([
      fetch(`/api/crm/accounts?${params}`).then((r) => r.json()),
      fetch(`/api/crm/contacts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([accBody, contBody, empBody]) => {
        setAccounts(accBody.data ?? []);
        setContacts(contBody.data ?? []);
        setEmployees(empBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [selectedOrgId, type, status, industry, ownerId, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "Unassigned";
  const contactCount = (accountId: string) => contacts.filter((c) => c.accountId === accountId).length;

  const kpis = useMemo(
    () => ({
      total: accounts.length,
      customers: accounts.filter((a) => a.type === "customer").length,
      prospects: accounts.filter((a) => a.type === "prospect").length,
    }),
    [accounts],
  );

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("account", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to accounts.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Accounts</h1>
          <p className="text-body text-neutral-600">Your companies and organizations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canCreate && <Button onClick={() => setShowNew(true)}>+ New Account</Button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Total Accounts</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Customers</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.customers}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Prospects</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.prospects}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Industry">
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Technology" />
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
        <Button
          variant="secondary"
          onClick={() => {
            setType("");
            setStatus("");
            setIndustry("");
            setOwnerId("");
            setSearch("");
          }}
        >
          Clear all
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No accounts found</EmptyTitle>
            <EmptyDescription>Try adjusting filters, or add your first account.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Annual Revenue</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/crm/accounts/${a.id}`)}>
                <TableCell>
                  <p className="font-medium text-neutral-950">{a.name}</p>
                  {a.website && <p className="text-caption text-neutral-500">{a.website}</p>}
                </TableCell>
                <TableCell>{a.industry ?? "—"}</TableCell>
                <TableCell>
                  <AccountTypeBadge type={a.type} />
                </TableCell>
                <TableCell>
                  <AccountStatusBadge status={a.status} />
                </TableCell>
                <TableCell>{contactCount(a.id)}</TableCell>
                <TableCell>{a.annualRevenue !== null ? `${a.currency} ${a.annualRevenue.toLocaleString()}` : "—"}</TableCell>
                <TableCell>{employeeName(a.ownerId)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showNew && (
        <NewAccountModal
          orgId={selectedOrgId}
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

export function NewAccountModal({
  orgId,
  onClose,
  onSaved,
}: {
  orgId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name, industry: industry || null, website: website || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to create account");
    onSaved(body.data.id);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">New Account</h2>
      <div className="mt-4 space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Industry">
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving || !name}>
            {saving ? "Saving…" : "Create Account"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
