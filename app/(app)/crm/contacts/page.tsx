"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { LogActivityForm } from "../leads/page";
import { PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";

type Contact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  accountId: string | null;
  isPrimaryContact: boolean;
  isDecisionMaker: boolean;
  lastContactedAt: string | null;
  ownerId: string | null;
  notes: string | null;
};
type Account = { id: string; name: string };
type Employee = { id: string; fullName: string };
type Activity = { id: string; type: string; subject: string | null; description: string | null; activityDate: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ContactsPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [decisionMakerOnly, setDecisionMakerOnly] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  const canCreate = can("contact", "create");
  const canUpdate = can("contact", "update");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    if (accountId) params.set("account_id", accountId);
    if (ownerId) params.set("owner_id", ownerId);
    if (decisionMakerOnly) params.set("is_decision_maker", "true");
    if (search) params.set("search", search);
    Promise.all([
      fetch(`/api/crm/contacts?${params}`).then((r) => r.json()),
      fetch(`/api/crm/accounts?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([contBody, accBody, empBody]) => {
        setContacts(contBody.data ?? []);
        setAccounts(accBody.data ?? []);
        setEmployees(empBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [selectedOrgId, accountId, ownerId, decisionMakerOnly, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "Unassigned";
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? null;

  const kpis = useMemo(
    () => ({
      total: contacts.length,
      decisionMakers: contacts.filter((c) => c.isDecisionMaker).length,
      unlinked: contacts.filter((c) => !c.accountId).length,
    }),
    [contacts],
  );

  const { page, setPage, pageSize, total, paged } = usePagination(contacts, 10);

  if (orgLoading || loading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("contact", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to contacts.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-950">Contacts</h1>
          <p className="text-body text-neutral-600">Your people at customer and prospect accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canCreate && <Button onClick={() => setShowNew(true)}>+ New Contact</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="sm" color="danger">
          <p className="text-caption text-neutral-600">Total Contacts</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Decision Makers</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.decisionMakers}</p>
        </Card>
        <Card padding="sm">
          <p className="text-caption text-neutral-600">Unlinked</p>
          <p className="text-h3 font-semibold text-neutral-950">{kpis.unlinked}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Account">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
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
        <label className="flex items-center gap-2 pb-2 text-body-medium text-neutral-800">
          <input type="checkbox" checked={decisionMakerOnly} onChange={(e) => setDecisionMakerOnly(e.target.checked)} />
          Decision makers only
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            setAccountId("");
            setOwnerId("");
            setDecisionMakerOnly(false);
            setSearch("");
          }}
        >
          Clear all
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No contacts found</EmptyTitle>
            <EmptyDescription>Try adjusting filters, or add your first contact.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-300">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-100 text-caption font-medium uppercase tracking-wide text-neutral-500">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead>Decision Maker</TableHead>
                <TableHead>Last Contacted</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody className="bg-neutral-50">
              {paged.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.fullName} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-950">{c.fullName}</p>
                        {c.jobTitle && <p className="truncate text-small text-neutral-600">{c.jobTitle}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {c.accountId ? (
                      <Link href={`/crm/accounts/${c.accountId}`} className="text-danger-600 underline" onClick={(e) => e.stopPropagation()}>
                        {accountName(c.accountId) ?? "View account"}
                      </Link>
                    ) : (
                      <span className="text-neutral-500">No account</span>
                    )}
                  </TableCell>
                  <TableCell>{c.isPrimaryContact && <Badge color="info">Primary</Badge>}</TableCell>
                  <TableCell>{c.isDecisionMaker && <Badge color="success">Decision Maker</Badge>}</TableCell>
                  <TableCell>{c.lastContactedAt ? timeAgo(c.lastContactedAt) : "Never"}</TableCell>
                  <TableCell>{employeeName(c.ownerId)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setSelected(c)}
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
      )}

      {showNew && (
        <NewContactModal
          orgId={selectedOrgId}
          accounts={accounts}
          employees={employees}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {selected && (
        <ContactDetailModal
          orgId={selectedOrgId}
          contact={selected}
          accountName={accountName(selected.accountId)}
          canUpdate={canUpdate}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function NewContactModal({
  orgId,
  accounts,
  employees,
  onClose,
  onSaved,
}: {
  orgId: string;
  accounts: Account[];
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [accountId, setAccountId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [isDecisionMaker, setIsDecisionMaker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        mobile: mobile || null,
        job_title: jobTitle || null,
        department: department || null,
        account_id: accountId || null,
        owner_id: ownerId || null,
        is_primary_contact: isPrimaryContact,
        is_decision_maker: isDecisionMaker,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to create contact");
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">New Contact</h2>
      <div className="mt-4 space-y-3">
        <Field label="Full name">
          <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input className="w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Mobile">
            <Input className="w-full" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </Field>
          <Field label="Job title">
            <Input className="w-full" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          <Field label="Department">
            <Input className="w-full" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
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
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-body text-neutral-950">
            <input type="checkbox" checked={isPrimaryContact} onChange={(e) => setIsPrimaryContact(e.target.checked)} />
            Primary contact
          </label>
          <label className="flex items-center gap-2 text-body text-neutral-950">
            <input type="checkbox" checked={isDecisionMaker} onChange={(e) => setIsDecisionMaker(e.target.checked)} />
            Decision maker
          </label>
        </div>
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving || !fullName}>
            {saving ? "Saving…" : "Create Contact"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ContactDetailModal({
  orgId,
  contact,
  accountName,
  canUpdate,
  onClose,
  onChanged,
}: {
  orgId: string;
  contact: Contact;
  accountName: string | null;
  canUpdate: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState(contact);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showDraftEmail, setShowDraftEmail] = useState(false);

  function loadTimeline() {
    setLoadingTimeline(true);
    fetch(`/api/crm/contacts/${contact.id}`)
      .then((r) => r.json())
      .then((body) => setActivities(body.data?.activities ?? []))
      .finally(() => setLoadingTimeline(false));
  }
  useEffect(loadTimeline, [contact.id]);

  async function save() {
    setSaving(true);
    await fetch(`/api/crm/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: form.fullName, email: form.email, phone: form.phone, job_title: form.jobTitle, notes: form.notes }),
    });
    setSaving(false);
    onChanged();
    onClose();
  }

  const lastContactedDaysAgo = contact.lastContactedAt ? Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000) : undefined;
  const recentActivitySummary = activities[0]?.subject || (activities[0] ? `a ${activities[0].type}` : "");

  const summarizeAI = useAiCall<string>("Analyst", "summarize_contact");
  const draftAI = useAiCall<{ subject: string; body: string; reasoning: string }>("Writer", "draft_crm_email");

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <h2 className="text-h3 font-semibold text-neutral-950">{contact.fullName}</h2>
      {accountName && <p className="text-body text-neutral-600">{accountName}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input className="w-full" value={form.fullName} disabled={!canUpdate} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Job title">
          <Input className="w-full" value={form.jobTitle ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input className="w-full" value={form.email ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input className="w-full" value={form.phone ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <Textarea className="w-full" value={form.notes ?? ""} disabled={!canUpdate} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </Field>
      </div>

      {form.accountId && (
        <p className="mt-3 text-small">
          <Link href={`/crm/accounts/${form.accountId}`} className="text-danger-600 underline">
            View account
          </Link>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <AiButton
          label="Summarize contact history"
          loading={summarizeAI.loading}
          onClick={() => summarizeAI.run({ name: contact.fullName, activity_count: activities.length, last_contacted_days_ago: lastContactedDaysAgo })}
        />
        <AiButton label="Draft follow-up email" loading={draftAI.loading} onClick={() => { setShowDraftEmail(true); draftAI.run({ name: contact.fullName, recent_activity_summary: recentActivitySummary }); }} />
      </div>
      {summarizeAI.result && (
        <AiSuggestionCard onAccept={() => summarizeAI.setResult(null)} onReject={() => summarizeAI.setResult(null)}>
          <p className="text-body text-neutral-950">{summarizeAI.result}</p>
        </AiSuggestionCard>
      )}
      {showDraftEmail && (
        <DraftEmailModal loading={draftAI.loading} result={draftAI.result} onClose={() => { setShowDraftEmail(false); draftAI.setResult(null); }} />
      )}

      {canUpdate && (
        <Button className="mt-3" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      )}

      <div className="mt-6 border-t border-neutral-200 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-body-medium font-semibold text-neutral-950">Activity Timeline</h3>
          <Button variant="secondary" onClick={() => setShowLogActivity((v) => !v)}>+ Log Activity</Button>
        </div>
        {showLogActivity && (
          <LogActivityForm
            orgId={orgId}
            relatedType="contact"
            relatedId={contact.id}
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
    </Modal>
  );
}

function DraftEmailModal({
  loading,
  result,
  onClose,
}: {
  loading: boolean;
  result: { subject: string; body: string; reasoning: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function accept() {
    if (!result) return;
    await navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
    setCopied(true);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">Draft Follow-up Email</h2>
      {loading || !result ? (
        <p className="mt-3 text-body text-neutral-600">Thinking…</p>
      ) : (
        <div className="mt-3 space-y-3">
          <Field label="Subject">
            <Input value={result.subject} readOnly />
          </Field>
          <Field label="Body">
            <Textarea value={result.body} readOnly rows={8} />
          </Field>
          <p className="text-small text-neutral-600">{result.reasoning}</p>
          {copied && <p className="text-small text-success-600">Copied — send via your email client. Direct sending available when Gmail is connected.</p>}
          <div className="flex gap-2">
            <Button onClick={accept}>Accept &amp; Copy</Button>
            <Button variant="secondary" onClick={onClose}>
              Reject
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
