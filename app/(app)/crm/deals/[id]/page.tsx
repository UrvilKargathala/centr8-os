"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { useToast } from "@/components/ui/Toast";
import { PageSkeleton } from "@/components/ui/skeleton";
import { LogActivityForm } from "../../leads/LeadsPageClient";
import { STAGE_LABEL, STAGE_BADGE_COLOR, fmtMoney, isStale } from "../page";

type Deal = {
  id: string;
  name: string;
  accountId: string | null;
  primaryContactId: string | null;
  ownerId: string | null;
  stage: string;
  probability: number | null;
  value: number | null;
  currency: string;
  recurringRevenue: number | null;
  recurringFrequency: string | null;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  source: string | null;
  lostReason: string | null;
  wonNotes: string | null;
  nextStep: string | null;
  nextStepDueDate: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  stageChangedAt: string;
};
type Account = { id: string; name: string };
type Contact = { id: string; fullName: string; isPrimaryContact?: boolean; isDecisionMaker?: boolean };
type Employee = { id: string; fullName: string };
type Activity = {
  id: string;
  type: string;
  subject: string | null;
  description: string | null;
  outcome: string | null;
  performedBy: string | null;
  activityDate: string;
  durationMinutes: number | null;
};
type StageHistory = {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  changedBy: string | null;
  durationInPreviousStageMinutes: number | null;
};

const TABS = ["Overview", "Activities", "Stage History", "Contacts", "AI Insights"] as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
function humanDuration(mins: number | null) {
  if (mins === null) return "—";
  if (mins < 60) return `${mins} minutes`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)} hours`;
  return `${Math.round(hrs / 24)} days`;
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const { show: showToast } = useToast();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [stageHistory, setStageHistory] = useState<StageHistory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accountContacts, setAccountContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [editForm, setEditForm] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showWon, setShowWon] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const canUpdate = can("deal", "update");
  const canClose = can("deal", "close");
  const canAssign = can("deal", "assign");

  function load() {
    setLoading(true);
    fetch(`/api/crm/deals/${id}`)
      .then((r) => r.json())
      .then((body) => {
        setDeal(body.data?.deal ?? null);
        setAccount(body.data?.account ?? null);
        setContact(body.data?.contact ?? null);
        setStageHistory(body.data?.stageHistory ?? []);
        setActivities(body.data?.activities ?? []);
        setEditForm(body.data?.deal ?? null);
        if (body.data?.deal?.accountId) {
          fetch(`/api/crm/contacts?account_id=${body.data.deal.accountId}`)
            .then((r) => r.json())
            .then((cb) => setAccountContacts(cb.data ?? []));
        }
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((b) => setEmployees(b.data ?? []));
  }, [selectedOrgId]);

  const employeeName = (empId: string | null) => employees.find((e) => e.id === empId)?.fullName ?? "Unassigned";
  const daysSinceLastActivity = activities.length
    ? Math.floor((Date.now() - new Date(activities[0].activityDate).getTime()) / 86400000)
    : 999;

  const riskAI = useAiCall<{ risk_level: "low" | "medium" | "high"; reasoning: string; suggested_actions: string[] }>("Monitor", "assess_deal_risk");
  const proposalAI = useAiCall<{ subject: string; body: string }>("Writer", "draft_deal_proposal");
  const nextStepAI = useAiCall<{ next_step: string; due_date: string; reasoning: string }>("Planner", "suggest_deal_next_step");
  const closeAI = useAiCall<{ predicted_close_date: string; confidence_percent: number; reasoning: string }>("Analyst", "predict_deal_close");

  async function saveOverview() {
    if (!editForm) return;
    setSaving(true);
    await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        account_id: editForm.accountId,
        primary_contact_id: editForm.primaryContactId,
        value: editForm.value,
        currency: editForm.currency,
        recurring_revenue: editForm.recurringRevenue,
        recurring_frequency: editForm.recurringFrequency,
        expected_close_date: editForm.expectedCloseDate,
        source: editForm.source,
        tags: editForm.tags,
        notes: editForm.notes,
      }),
    });
    setSaving(false);
    showToast("Deal saved");
    load();
  }

  async function saveNextStep(nextStep: string, dueDate: string | null) {
    await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_step: nextStep, next_step_due_date: dueDate }),
    });
    showToast("Next step saved");
    load();
  }

  if (orgLoading || loading) return <PageSkeleton variant="detail" />;
  if (!deal || !editForm) return <p className="text-body text-neutral-600">Deal not found.</p>;

  const closed = deal.stage === "won" || deal.stage === "lost";
  const overdue = !closed && !!deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date();
  const stale = !closed && isStale(deal.stageChangedAt);
  const daysOpen = Math.floor(
    (new Date(deal.actualCloseDate ?? new Date()).getTime() - new Date(deal.createdAt).getTime()) / 86400000,
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 font-semibold text-neutral-950">{deal.name}</h1>
            <p className="mt-1 text-h3 font-semibold text-neutral-950">{fmtMoney(deal.value, deal.currency)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color={STAGE_BADGE_COLOR[deal.stage] ?? "neutral"}>{STAGE_LABEL[deal.stage] ?? deal.stage}</Badge>
              <Badge color="neutral">{deal.probability ?? 0}%</Badge>
              {stale && <Badge color="warning">Stale</Badge>}
              {deal.expectedCloseDate && (
                <span className={`text-small ${overdue ? "text-danger-600" : "text-neutral-600"}`}>
                  Expected close: {deal.expectedCloseDate}
                </span>
              )}
            </div>
            {deal.nextStep && (
              <p className="mt-2 text-small text-neutral-700">
                <span className="font-medium">Next step:</span> {deal.nextStep} {deal.nextStepDueDate ? `(due ${deal.nextStepDueDate})` : ""}
              </p>
            )}
            {closed && (
              <p className="mt-2 text-small text-neutral-700">
                {deal.stage === "won" ? (
                  <>Won on {deal.actualCloseDate}. {deal.wonNotes && <>Notes: {deal.wonNotes}</>}</>
                ) : (
                  <>Lost on {deal.actualCloseDate}. Reason: {deal.lostReason}</>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {!closed && canClose && (
              <>
                <Button className="!bg-success-600 hover:!bg-success-600/90" onClick={() => setShowWon(true)}>
                  Mark Won
                </Button>
                <Button variant="danger" onClick={() => setShowLost(true)}>
                  Mark Lost
                </Button>
              </>
            )}
            {canAssign && (
              <Button variant="secondary" onClick={() => setShowAssign(true)}>
                Assign
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-3 text-small sm:grid-cols-4">
          <div>
            <p className="text-caption text-neutral-500">Account</p>
            {account ? (
              <Link href={`/crm/accounts/${account.id}`} className="text-danger-600 underline">
                {account.name}
              </Link>
            ) : (
              <p className="text-neutral-950">—</p>
            )}
          </div>
          <div>
            <p className="text-caption text-neutral-500">Primary contact</p>
            <p className="text-neutral-950">{contact?.fullName ?? "—"}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500">Owner</p>
            <p className="text-neutral-950">{employeeName(deal.ownerId)}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500">Source</p>
            <p className="text-neutral-950">{deal.source ?? "—"}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500">Created</p>
            <p className="text-neutral-950">{new Date(deal.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500">Days open</p>
            <p className="text-neutral-950">{daysOpen}d</p>
          </div>
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

      {tab === "Overview" && (
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input className="w-full" value={editForm.name} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Value">
              <Input
                className="w-full"
                type="number"
                value={editForm.value ?? ""}
                disabled={!canUpdate}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Currency">
              <Input className="w-full" value={editForm.currency} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} />
            </Field>
            <Field label="Recurring revenue">
              <Input
                className="w-full"
                type="number"
                value={editForm.recurringRevenue ?? ""}
                disabled={!canUpdate}
                onChange={(e) => setEditForm({ ...editForm, recurringRevenue: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Recurring frequency">
              <Input
                className="w-full"
                value={editForm.recurringFrequency ?? ""}
                disabled={!canUpdate}
                onChange={(e) => setEditForm({ ...editForm, recurringFrequency: e.target.value })}
              />
            </Field>
            <Field label="Expected close date">
              <Input
                className="w-full"
                type="date"
                value={editForm.expectedCloseDate ?? ""}
                disabled={!canUpdate}
                onChange={(e) => setEditForm({ ...editForm, expectedCloseDate: e.target.value })}
              />
            </Field>
            <Field label="Source">
              <Input className="w-full" value={editForm.source ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Notes">
              <Textarea className="w-full" value={editForm.notes ?? ""} disabled={!canUpdate} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
            </Field>
          </div>
          {canUpdate && (
            <Button className="mt-3" onClick={saveOverview} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}

          <NextStepMiniForm deal={deal} canUpdate={canUpdate} onSave={saveNextStep} />
        </Card>
      )}

      {tab === "Activities" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-body-medium font-semibold text-neutral-950">Activities</h3>
            <Button variant="secondary" onClick={() => setShowLogActivity((v) => !v)}>
              + Log Activity
            </Button>
          </div>
          {showLogActivity && selectedOrgId && (
            <LogActivityForm
              orgId={selectedOrgId}
              relatedType="deal"
              relatedId={deal.id}
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
                  <div className="mt-1 flex gap-3 text-caption text-neutral-500">
                    {a.outcome && <Badge color="neutral">{a.outcome}</Badge>}
                    <span>{employeeName(a.performedBy)}</span>
                    {a.durationMinutes !== null && <span>{a.durationMinutes} min</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {tab === "Stage History" && (
        <Card>
          <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">Stage History</h3>
          {stageHistory.length === 0 ? (
            <p className="text-small text-neutral-600">No stage changes yet.</p>
          ) : (
            <div className="relative space-y-4 border-l-2 border-neutral-200 pl-4">
              {stageHistory.map((h) => (
                <div key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-danger-600" />
                  <p className="text-body-medium font-medium text-neutral-950">
                    {h.fromStage ? `${STAGE_LABEL[h.fromStage] ?? h.fromStage} → ${STAGE_LABEL[h.toStage] ?? h.toStage}` : `Created in ${STAGE_LABEL[h.toStage] ?? h.toStage}`}
                  </p>
                  <p className="text-caption text-neutral-500">
                    {new Date(h.changedAt).toLocaleString()} · {employeeName(h.changedBy)}
                  </p>
                  {h.durationInPreviousStageMinutes !== null && (
                    <p className="text-caption text-neutral-500">Time in previous stage: {humanDuration(h.durationInPreviousStageMinutes)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-small font-medium text-neutral-700">Open for {daysOpen} days total</p>
        </Card>
      )}

      {tab === "Contacts" && (
        <Card>
          <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">Contacts</h3>
          {!deal.accountId ? (
            <p className="text-small text-neutral-600">This deal has no linked account, so there are no account contacts to show.</p>
          ) : accountContacts.length === 0 ? (
            <p className="text-small text-neutral-600">No contacts linked to this account yet.</p>
          ) : (
            <div className="space-y-2">
              {accountContacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0">
                  <p className="text-body-medium font-medium text-neutral-950">{c.fullName}</p>
                  <div className="flex gap-1">
                    {c.isPrimaryContact && <Badge color="info">Primary</Badge>}
                    {c.isDecisionMaker && <Badge color="warning">Decision Maker</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "AI Insights" && (
        <Card>
          <div className="flex flex-wrap gap-2">
            <AiButton
              label="Assess deal risk"
              loading={riskAI.loading}
              onClick={() =>
                riskAI.run({
                  days_in_stage: Math.floor((Date.now() - new Date(deal.stageChangedAt).getTime()) / 86400000),
                  days_since_last_activity: daysSinceLastActivity,
                  is_past_due: overdue,
                  stage: deal.stage,
                })
              }
            />
            <AiButton
              label="Draft proposal email"
              loading={proposalAI.loading}
              onClick={() =>
                proposalAI.run({ deal_name: deal.name, contact_name: contact?.fullName, value: deal.value, currency: deal.currency })
              }
            />
            <AiButton
              label="Suggest next step"
              loading={nextStepAI.loading}
              onClick={() => nextStepAI.run({ stage: deal.stage, days_since_last_activity: daysSinceLastActivity })}
            />
            <AiButton label="Predict close date" loading={closeAI.loading} onClick={() => closeAI.run({ stage: deal.stage })} />
          </div>

          {riskAI.result && (
            <AiSuggestionCard reasoning={riskAI.result.reasoning} onAccept={() => riskAI.setResult(null)} onReject={() => riskAI.setResult(null)}>
              <Badge color={riskAI.result.risk_level === "low" ? "success" : riskAI.result.risk_level === "medium" ? "warning" : "danger"}>
                {riskAI.result.risk_level} risk
              </Badge>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-neutral-700">
                {riskAI.result.suggested_actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </AiSuggestionCard>
          )}

          {proposalAI.result && (
            <AiSuggestionCard
              onAccept={() => {
                navigator.clipboard.writeText(`Subject: ${proposalAI.result!.subject}\n\n${proposalAI.result!.body}`);
                showToast("Copied — send via your email client.");
                proposalAI.setResult(null);
              }}
              onReject={() => proposalAI.setResult(null)}
            >
              <p className="text-body-medium font-medium text-neutral-950">{proposalAI.result.subject}</p>
              <p className="whitespace-pre-wrap text-small text-neutral-700">{proposalAI.result.body}</p>
            </AiSuggestionCard>
          )}

          {nextStepAI.result && (
            <AiSuggestionCard
              reasoning={nextStepAI.result.reasoning}
              onAccept={() => {
                saveNextStep(nextStepAI.result!.next_step, nextStepAI.result!.due_date);
                nextStepAI.setResult(null);
              }}
              onReject={() => nextStepAI.setResult(null)}
            >
              <p className="text-body-medium text-neutral-950">{nextStepAI.result.next_step}</p>
              <p className="text-small text-neutral-600">Due: {nextStepAI.result.due_date}</p>
            </AiSuggestionCard>
          )}

          {closeAI.result && (
            <AiSuggestionCard reasoning={closeAI.result.reasoning} onAccept={() => closeAI.setResult(null)} onReject={() => closeAI.setResult(null)}>
              <p className="text-body-medium text-neutral-950">Predicted close: {closeAI.result.predicted_close_date}</p>
              <p className="text-small text-neutral-600">Confidence: {closeAI.result.confidence_percent}%</p>
            </AiSuggestionCard>
          )}
        </Card>
      )}

      {showWon && (
        <CloseModal
          outcome="won"
          onClose={() => setShowWon(false)}
          onDone={() => {
            setShowWon(false);
            load();
          }}
          dealId={deal.id}
        />
      )}
      {showLost && (
        <CloseModal
          outcome="lost"
          onClose={() => setShowLost(false)}
          onDone={() => {
            setShowLost(false);
            load();
          }}
          dealId={deal.id}
        />
      )}
      {showAssign && (
        <AssignModal
          employees={employees}
          dealId={deal.id}
          onClose={() => setShowAssign(false)}
          onDone={() => {
            setShowAssign(false);
            load();
          }}
        />
      )}

      <p className="text-caption text-neutral-500">
        <Link href="/crm/deals" className="underline">
          Back to Deals
        </Link>
      </p>
    </div>
  );
}

function NextStepMiniForm({
  deal,
  canUpdate,
  onSave,
}: {
  deal: Deal;
  canUpdate: boolean;
  onSave: (nextStep: string, dueDate: string | null) => void;
}) {
  const [nextStep, setNextStep] = useState(deal.nextStep ?? "");
  const [dueDate, setDueDate] = useState(deal.nextStepDueDate ?? "");

  if (!canUpdate) return null;

  return (
    <div className="glass-card mt-4 p-3">
      <p className="text-body-medium font-semibold text-neutral-950">Next step</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Field label="Next step">
          <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} className="w-64" />
        </Field>
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={() => onSave(nextStep, dueDate || null)}>
          Save
        </Button>
      </div>
    </div>
  );
}

function CloseModal({
  outcome,
  dealId,
  onClose,
  onDone,
}: {
  outcome: "won" | "lost";
  dealId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (outcome === "lost" && !lostReason) {
      setError("A lost reason is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/crm/deals/${dealId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outcome === "won" ? { outcome, won_notes: notes || null } : { outcome, lost_reason: lostReason }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Failed to close deal");
    onDone();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">{outcome === "won" ? "Mark Deal Won" : "Mark Deal Lost"}</h2>
      <div className="mt-4 space-y-3">
        {outcome === "won" ? (
          <Field label="Won notes (optional)">
            <Textarea className="w-full" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        ) : (
          <Field label="Lost reason (required)">
            <Textarea className="w-full" value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={3} />
          </Field>
        )}
        {error && <p className="text-small text-danger-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button
            className={outcome === "won" ? "!bg-success-600 hover:!bg-success-600/90" : undefined}
            variant={outcome === "won" ? "primary" : "danger"}
            onClick={confirm}
            disabled={saving}
          >
            {saving ? "Saving…" : "Confirm"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({
  employees,
  dealId,
  onClose,
  onDone,
}: {
  employees: Employee[];
  dealId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!ownerId) return;
    setSaving(true);
    await fetch(`/api/crm/deals/${dealId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: ownerId }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-h3 font-semibold text-neutral-950">Assign Deal</h2>
      <div className="mt-4 space-y-3">
        <Field label="Owner">
          <Select className="w-full" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Select owner…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2 pt-2">
          <Button onClick={confirm} disabled={saving || !ownerId}>
            {saving ? "Assigning…" : "Assign"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
