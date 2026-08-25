"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { AccountTypeBadge, AccountStatusBadge, Badge } from "@/components/ui/Badge";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES } from "@/lib/constants";
import { PageSkeleton } from "@/components/ui/skeleton";
import { LogActivityForm } from "../../leads/LeadsPageClient";
import { NewDealModal, STAGE_LABEL, STAGE_BADGE_COLOR, fmtMoney } from "../../deals/DealsPageClient";

type Account = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  type: string;
  status: string;
  annualRevenue: number | null;
  currency: string;
  ownerId: string | null;
  notes: string | null;
};
type Contact = { id: string; fullName: string; email: string | null; jobTitle: string | null; accountId?: string | null };
type Activity = { id: string; type: string; relatedType: string; subject: string | null; description: string | null; activityDate: string };
type Deal = { id: string; name: string; stage: string; value: number | null; currency: string; expectedCloseDate: string | null };
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

const TABS = ["Overview", "Contacts", "Activities", "Deals", "AI Insights"] as const;

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [editForm, setEditForm] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);

  const canUpdate = can("account", "update");
  const canCreateContact = can("contact", "create");
  const canCreateDeal = can("deal", "create");

  function load() {
    setLoading(true);
    fetch(`/api/crm/accounts/${id}`)
      .then((r) => r.json())
      .then((body) => {
        setAccount(body.data?.account ?? null);
        setContacts(body.data?.contacts ?? []);
        setActivities(body.data?.activities ?? []);
        setDeals(body.data?.deals ?? []);
        setEditForm(body.data?.account ?? null);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);
  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((b) => setEmployees(b.data ?? []));
  }, [selectedOrgId]);

  const summarizeAI = useAiCall<string>("Analyst", "summarize_account");
  const suggestAI = useAiCall<{ action: string; reasoning: string }>("Planner", "suggest_account_action");

  async function save() {
    if (!editForm) return;
    setSaving(true);
    await fetch(`/api/crm/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        industry: editForm.industry,
        website: editForm.website,
        phone: editForm.phone,
        email: editForm.email,
        address_line1: editForm.addressLine1,
        address_line2: editForm.addressLine2,
        city: editForm.city,
        state: editForm.state,
        country: editForm.country,
        postal_code: editForm.postalCode,
        type: editForm.type,
        status: editForm.status,
        annual_revenue: editForm.annualRevenue,
        notes: editForm.notes,
      }),
    });
    setSaving(false);
    load();
  }

  if (orgLoading || loading) return <PageSkeleton variant="detail" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!account) return <p className="text-body text-neutral-600">Account not found.</p>;

  const lastActivityDaysAgo = activities.length ? Math.floor((Date.now() - new Date(activities[0].activityDate).getTime()) / 86400000) : undefined;
  const addressParts = [account.addressLine1, account.addressLine2, account.city, account.state, account.postalCode, account.country].filter(Boolean);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-h2 font-semibold text-neutral-950">{account.name}</h1>
            <p className="text-body text-neutral-600">{account.industry ?? "No industry set"}</p>
            {account.website && (
              <a href={account.website} target="_blank" rel="noreferrer" className="text-small text-danger-600 underline">
                {account.website}
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <AccountTypeBadge type={account.type} />
            <AccountStatusBadge status={account.status} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-small text-neutral-600">
          {addressParts.length > 0 && <span>{addressParts.join(", ")}</span>}
        </div>
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap px-4 py-2 text-body-medium font-medium ${tab === t ? "border-b-2 border-danger-600 text-neutral-950" : "text-neutral-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && editForm && (
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input className="w-full" value={editForm.name} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Industry">
              <Input className="w-full" value={editForm.industry ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input className="w-full" value={editForm.website ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input className="w-full" value={editForm.phone ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input className="w-full" value={editForm.email ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select className="w-full" value={editForm.type} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select className="w-full" value={editForm.status} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {ACCOUNT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Annual Revenue">
              <Input
                className="w-full"
                type="number"
                value={editForm.annualRevenue ?? ""}
                disabled={!canUpdate}
                onChange={(e) => setEditForm({ ...editForm, annualRevenue: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Address line 1">
              <Input className="w-full" value={editForm.addressLine1 ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })} />
            </Field>
            <Field label="City">
              <Input className="w-full" value={editForm.city ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input className="w-full" value={editForm.state ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </Field>
            <Field label="Postal code">
              <Input className="w-full" value={editForm.postalCode ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Notes">
              <Textarea className="w-full" value={editForm.notes ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
            </Field>
          </div>
          {canUpdate && (
            <Button className="mt-3" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </Card>
      )}

      {tab === "Contacts" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-body-medium font-semibold text-neutral-950">Contacts</h3>
            {canCreateContact && <Button variant="secondary" onClick={() => setShowAddContact(true)}>+ Add Contact</Button>}
          </div>
          {contacts.length === 0 ? (
            <p className="text-small text-neutral-600">No contacts linked to this account yet.</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0">
                  <div>
                    <p className="text-body-medium font-medium text-neutral-950">{c.fullName}</p>
                    {c.jobTitle && <p className="text-caption text-neutral-500">{c.jobTitle}</p>}
                  </div>
                  <span className="text-small text-neutral-600">{c.email ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
          {showAddContact && (
            <QuickAddContactModal
              orgId={selectedOrgId}
              accountId={account.id}
              onClose={() => setShowAddContact(false)}
              onSaved={() => {
                setShowAddContact(false);
                load();
              }}
            />
          )}
        </Card>
      )}

      {tab === "Activities" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-body-medium font-semibold text-neutral-950">Activities</h3>
            <Button variant="secondary" onClick={() => setShowLogActivity((v) => !v)}>+ Log Activity</Button>
          </div>
          {showLogActivity && (
            <LogActivityForm
              orgId={selectedOrgId}
              relatedType="account"
              relatedId={account.id}
              onLogged={() => {
                setShowLogActivity(false);
                load();
              }}
            />
          )}
          <div className="mt-3 space-y-2">
            {activities.length === 0 ? (
              <p className="text-small text-neutral-600">No activity logged yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="glass-card rounded-sm p-2">
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
        </Card>
      )}

      {tab === "Deals" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-body-medium font-semibold text-neutral-950">Deals</h3>
            {canCreateDeal && (
              <Button variant="secondary" onClick={() => setShowNewDeal(true)}>
                + New Deal for this Account
              </Button>
            )}
          </div>
          {deals.length === 0 ? (
            <p className="text-small text-neutral-600">No deals for this account yet.</p>
          ) : (
            <div className="space-y-2">
              {deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/crm/deals/${d.id}`}
                  className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 hover:bg-neutral-100"
                >
                  <p className="text-body-medium font-medium text-neutral-950">{d.name}</p>
                  <div className="flex items-center gap-3 text-small text-neutral-600">
                    <Badge color={STAGE_BADGE_COLOR[d.stage] ?? "neutral"}>{STAGE_LABEL[d.stage] ?? d.stage}</Badge>
                    <span>{fmtMoney(d.value, d.currency)}</span>
                    <span>{d.expectedCloseDate ?? "—"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {showNewDeal && (
            <NewDealModal
              orgId={selectedOrgId!}
              accounts={[{ id: account.id, name: account.name }]}
              contacts={contacts.map((c) => ({ ...c, accountId: account.id }))}
              employees={employees}
              defaults={{ stage: "prospecting", accountId: account.id }}
              onClose={() => setShowNewDeal(false)}
              onSaved={() => {
                setShowNewDeal(false);
                load();
              }}
            />
          )}
        </Card>
      )}

      {tab === "AI Insights" && (
        <Card>
          <div className="flex flex-wrap gap-2">
            <AiButton
              label="Summarize account"
              loading={summarizeAI.loading}
              onClick={() => summarizeAI.run({ name: account.name, contact_count: contacts.length, last_activity_days_ago: lastActivityDaysAgo })}
            />
            <AiButton
              label="Suggest next steps"
              loading={suggestAI.loading}
              onClick={() => suggestAI.run({ days_since_last_activity: lastActivityDaysAgo, contact_count: contacts.length })}
            />
          </div>
          {summarizeAI.result && (
            <AiSuggestionCard onAccept={() => summarizeAI.setResult(null)} onReject={() => summarizeAI.setResult(null)}>
              <p className="text-body text-neutral-950">{summarizeAI.result}</p>
            </AiSuggestionCard>
          )}
          {suggestAI.result && (
            <AiSuggestionCard reasoning={suggestAI.result.reasoning} onAccept={() => suggestAI.setResult(null)} onReject={() => suggestAI.setResult(null)}>
              <p className="text-body-medium text-neutral-950">{suggestAI.result.action}</p>
            </AiSuggestionCard>
          )}
        </Card>
      )}

      <p className="text-caption text-neutral-500">
        <Link href="/crm/accounts" className="underline">
          Back to Accounts
        </Link>
      </p>
    </div>
  );
}

function QuickAddContactModal({
  orgId,
  accountId,
  onClose,
  onSaved,
}: {
  orgId: string;
  accountId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, account_id: accountId, full_name: fullName, email: email || null, job_title: jobTitle || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to create contact");
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">Add Contact</h2>
      <div className="mt-4 space-y-3">
        <Field label="Full name">
          <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Job title">
          <Input className="w-full" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </Field>
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving || !fullName}>
            {saving ? "Saving…" : "Add Contact"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
