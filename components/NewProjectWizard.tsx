"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Field } from "@/components/ui/Input";
import { AiBanner } from "@/components/ui/AiBanner";
import { DonutChart } from "@/components/ui/DonutChart";
import { PROJECT_STATUSES } from "@/lib/constants";
import { generateAI } from "@/lib/ai/generate";
import type { mockResponses } from "@/lib/ai/mockResponses";

type StepIndex = 0 | 1 | 2 | 3;
const STEP_TITLES = ["Overview", "Budget & Timeline", "Team & Resources", "Documents & Attachments"] as const;

type WizardState = {
  // Step 1
  name: string;
  code: string;
  description: string;
  status: (typeof PROJECT_STATUSES)[number];
  priority: "Low" | "Medium" | "High" | "Critical";
  portfolioId: string;
  goal: string;
  ownerId: string;
  client: string;
  tags: string;
  // Step 2
  startDate: string;
  endDate: string;
  allocatedBudget: string;
  currency: "INR" | "USD" | "EUR";
  billingType: "" | "Fixed" | "Hourly" | "Retainer" | "Non-billable";
  hourlyRate: string;
  costCentre: string;
  laborBudget: string;
  softwareBudget: string;
  servicesBudget: string;
  otherBudget: string;
  // Step 3
  projectLead: string;
  members: { userId: string; role: string; hoursPerWeek: string; access: "Admin" | "Editor" | "Viewer" }[];
  departments: string[];
  externalCollaborators: string;
  notifyOnCreation: boolean;
  // Step 4
  brief: string;
  referenceDocs: string;
  existingLinks: string;
  contract: string;
  templateId: string;
  kickoffNotes: string;
};

const INITIAL_STATE: WizardState = {
  name: "",
  code: "",
  description: "",
  status: "planning",
  priority: "Medium",
  portfolioId: "",
  goal: "",
  ownerId: "",
  client: "",
  tags: "",
  startDate: "",
  endDate: "",
  allocatedBudget: "",
  currency: "INR",
  billingType: "",
  hourlyRate: "",
  costCentre: "",
  laborBudget: "",
  softwareBudget: "",
  servicesBudget: "",
  otherBudget: "",
  projectLead: "",
  members: [],
  departments: [],
  externalCollaborators: "",
  notifyOnCreation: false,
  brief: "",
  referenceDocs: "",
  existingLinks: "",
  contract: "",
  templateId: "",
  kickoffNotes: "",
};

const CURRENCY_SYMBOL: Record<WizardState["currency"], string> = { INR: "₹", USD: "$", EUR: "€" };

function fmtCurrency(v: number, currency: WizardState["currency"]) {
  return `${CURRENCY_SYMBOL[currency]}${Math.round(v).toLocaleString()}`;
}

export function NewProjectWizard({
  orgId,
  currentUserId,
  onClose,
  onCreated,
}: {
  orgId: string;
  currentUserId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<WizardState>({ ...INITIAL_STATE, ownerId: currentUserId, projectLead: currentUserId });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function validateStep1(): boolean {
    const e: Partial<Record<keyof WizardState, string>> = {};
    if (!state.name.trim()) e.name = "Required";
    if (!state.ownerId.trim()) e.ownerId = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => Math.min(3, s + 1) as StepIndex);
  }
  function handleBack() {
    setStep((s) => Math.max(0, s - 1) as StepIndex);
  }

  async function submitProject(asDraft: boolean) {
    if (!validateStep1()) {
      setStep(0);
      return;
    }
    setSaving(true);
    setSubmitError(null);

    // /api/projects only knows about name/status/portfolio_id/start_date/end_date
    // today. Everything else on this wizard is UI state only — logged so the
    // demo can show it exists, and left as a TODO for the schema follow-up.
    // "Save as draft": projectStatusEnum has no "draft" today, so it falls
    // back to "planning". TODO: add "draft" to project_status enum + migrate.
    const body = {
      org_id: orgId,
      name: state.name,
      status: asDraft ? "planning" : state.status,
      portfolio_id: state.portfolioId || null,
      start_date: state.startDate || null,
      end_date: state.endDate || null,
    };
    console.log("NewProjectWizard: submitting", { asDraft, apiBody: body, fullWizardState: state });

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const respBody = await res.json();
    setSaving(false);
    if (!res.ok) {
      setSubmitError(respBody.error ?? "Failed to create project");
      return;
    }
    onCreated();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-6">
        <Stepper current={step} />

        <h2 className="font-heading text-h2 font-semibold text-neutral-950">{STEP_TITLES[step]}</h2>

        {submitError && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{submitError}</p>}

        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          {step === 0 && <Step1 state={state} patch={patch} errors={errors} />}
          {step === 1 && <Step2 state={state} patch={patch} />}
          {step === 2 && <Step3 state={state} patch={patch} />}
          {step === 3 && <Step4 state={state} patch={patch} />}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => submitProject(true)} disabled={saving}>
              Save as draft
            </Button>
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={handleBack} disabled={saving}>
                Back
              </Button>
            )}
            {step < 3 && (
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            )}
            {step === 3 && (
              <Button type="button" onClick={() => submitProject(false)} disabled={saving}>
                {saving ? "Creating…" : "Create Project"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Stepper({ current }: { current: StepIndex }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_TITLES.map((title, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={title} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                active
                  ? "bg-primary-600 text-neutral-50"
                  : done
                  ? "bg-success-600 text-neutral-50"
                  : "bg-neutral-100 text-neutral-500 outline outline-1 outline-neutral-300"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={`hidden text-small font-medium sm:inline ${
                active ? "text-neutral-950" : done ? "text-neutral-800" : "text-neutral-500"
              }`}
            >
              {title}
            </span>
            {i < STEP_TITLES.length - 1 && <div className={`mx-1 h-px flex-1 ${done ? "bg-success-600" : "bg-neutral-300"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared AI helpers
// ─────────────────────────────────────────────────────────────

function AiIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.7 4.6L18 8.3l-4.3 1.7L12 14.6l-1.7-4.6L6 8.3l4.3-1.7L12 2zm7 12l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" />
    </svg>
  );
}

function AiButton({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <AiIcon />
      )}
      <span>{loading ? "Thinking…" : label}</span>
    </button>
  );
}

// Generic inline suggestion card. Renders provisional banner + preview
// (children) + Accept / Reject / Edit. Simple value flows pass allowEdit=false.
function AiSuggestionCard({
  reasoning,
  onAccept,
  onReject,
  onEdit,
  children,
}: {
  reasoning?: string;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 space-y-2 overflow-hidden rounded-md border border-ai-600/40">
      <AiBanner />
      <div className="space-y-2 px-4 pb-3">
        {children}
        {reasoning && <p className="text-small text-neutral-600">{reasoning}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="button" onClick={onAccept}>
            Accept
          </Button>
          {onEdit && (
            <Button type="button" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onReject}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

type AiAgent = keyof typeof mockResponses;

// Small hook to manage a per-touchpoint AI call — loading, result, error.
function useAiCall<T>(agent: AiAgent, task: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);

  async function run(ctx: Record<string, unknown>) {
    setLoading(true);
    setResult(null);
    try {
      const r = (await generateAI(agent, task, ctx)) as T;
      setResult(r);
    } finally {
      setLoading(false);
    }
  }
  return { loading, result, setResult, run };
}

// ─────────────────────────────────────────────────────────────
// STEP 1 — Overview
// ─────────────────────────────────────────────────────────────

function Step1({
  state,
  patch,
  errors,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  errors: Partial<Record<keyof WizardState, string>>;
}) {
  const descAI = useAiCall<string>("Writer", "project_description");
  const priorityAI = useAiCall<{ priority: string; reasoning: string }>("Analyst", "suggest_priority");
  const tagsAI = useAiCall<{ tags: string[]; reasoning: string }>("Analyst", "suggest_tags");
  const [editingDesc, setEditingDesc] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Project name *">
        <Input className="w-full" value={state.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
        {errors.name && <p className="mt-1 text-small text-danger-600">{errors.name}</p>}
      </Field>

      <Field label="Project code">
        <Input
          className="w-full uppercase"
          value={state.code}
          onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
          placeholder="e.g. APEX-01"
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Description">
          <div className="space-y-2">
            <Textarea
              className="w-full"
              rows={3}
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <AiButton
              label="AI: Generate description"
              loading={descAI.loading}
              onClick={() => descAI.run({ name: state.name, goal: state.goal })}
            />
            {descAI.result && (
              <AiSuggestionCard
                onAccept={() => {
                  patch({ description: editingDesc ?? descAI.result! });
                  descAI.setResult(null);
                  setEditingDesc(null);
                }}
                onReject={() => {
                  descAI.setResult(null);
                  setEditingDesc(null);
                }}
                onEdit={() => setEditingDesc(descAI.result!)}
              >
                {editingDesc !== null ? (
                  <Textarea className="w-full" rows={4} value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} />
                ) : (
                  <p className="whitespace-pre-wrap text-body text-neutral-800">{descAI.result}</p>
                )}
              </AiSuggestionCard>
            )}
          </div>
        </Field>
      </div>

      <Field label="Status *">
        <Select
          className="w-full"
          value={state.status}
          onChange={(e) => patch({ status: e.target.value as WizardState["status"] })}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Priority *">
        <div className="space-y-2">
          <Select
            className="w-full"
            value={state.priority}
            onChange={(e) => patch({ priority: e.target.value as WizardState["priority"] })}
          >
            {(["Low", "Medium", "High", "Critical"] as const).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <AiButton
            label="AI: Suggest priority"
            loading={priorityAI.loading}
            onClick={() => priorityAI.run({ name: state.name, endDate: state.endDate })}
          />
          {priorityAI.result && (
            <AiSuggestionCard
              reasoning={priorityAI.result.reasoning}
              onAccept={() => {
                patch({ priority: priorityAI.result!.priority as WizardState["priority"] });
                priorityAI.setResult(null);
              }}
              onReject={() => priorityAI.setResult(null)}
            >
              <p className="text-body-medium font-medium text-neutral-950">Suggested: {priorityAI.result.priority}</p>
            </AiSuggestionCard>
          )}
        </div>
      </Field>

      <Field label="Portfolio">
        <Select className="w-full" value={state.portfolioId} onChange={(e) => patch({ portfolioId: e.target.value })}>
          <option value="">No portfolio</option>
          <option value="portfolio-growth">Growth Initiatives (placeholder)</option>
          <option value="portfolio-platform">Platform (placeholder)</option>
        </Select>
      </Field>

      <Field label="Goal / Objective">
        <Textarea className="w-full" rows={2} value={state.goal} onChange={(e) => patch({ goal: e.target.value })} />
      </Field>

      <Field label="Owner / Project Manager *">
        <Input
          className="w-full"
          value={state.ownerId}
          onChange={(e) => patch({ ownerId: e.target.value })}
          placeholder="User ID"
        />
        {errors.ownerId && <p className="mt-1 text-small text-danger-600">{errors.ownerId}</p>}
      </Field>

      <Field label="Client / Stakeholder">
        <Input className="w-full" value={state.client} onChange={(e) => patch({ client: e.target.value })} />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Tags (comma-separated)">
          <div className="space-y-2">
            <Input className="w-full" value={state.tags} onChange={(e) => patch({ tags: e.target.value })} />
            <AiButton
              label="AI: Suggest tags"
              loading={tagsAI.loading}
              onClick={() => tagsAI.run({ name: state.name, description: state.description })}
            />
            {tagsAI.result && (
              <AiSuggestionCard
                reasoning={tagsAI.result.reasoning}
                onAccept={() => {
                  patch({ tags: tagsAI.result!.tags.join(", ") });
                  tagsAI.setResult(null);
                }}
                onReject={() => tagsAI.setResult(null)}
              >
                <div className="flex flex-wrap gap-1.5">
                  {tagsAI.result.tags.map((t) => (
                    <span key={t} className="rounded-full bg-ai-100 px-2 py-0.5 text-caption text-ai-600">
                      {t}
                    </span>
                  ))}
                </div>
              </AiSuggestionCard>
            )}
          </div>
        </Field>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 2 — Budget & Timeline
// ─────────────────────────────────────────────────────────────

function Step2({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const timelineAI = useAiCall<{ start_date: string; end_date: string; reasoning: string }>("Planner", "suggest_timeline");
  const budgetAI = useAiCall<{ amount_low: number; amount_high: number; currency: string; reasoning: string }>(
    "Analyst",
    "estimate_budget",
  );
  const breakdownAI = useAiCall<{ labor: number; software: number; services: number; other: number; reasoning: string }>(
    "Analyst",
    "suggest_budget_breakdown",
  );

  const durationDays = useMemo(() => {
    if (!state.startDate || !state.endDate) return 0;
    const s = new Date(state.startDate + "T00:00:00");
    const e = new Date(state.endDate + "T00:00:00");
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  }, [state.startDate, state.endDate]);
  const durationWeeks = Math.max(1, Math.round(durationDays / 7));

  const cats = {
    labor: Number(state.laborBudget) || 0,
    software: Number(state.softwareBudget) || 0,
    services: Number(state.servicesBudget) || 0,
    other: Number(state.otherBudget) || 0,
  };
  const catTotal = cats.labor + cats.software + cats.services + cats.other;
  const allocated = Number(state.allocatedBudget) || 0;
  const mismatch = allocated > 0 && catTotal > 0 && Math.abs(catTotal - allocated) > 1;
  const budgetPerWeek = allocated > 0 && durationWeeks > 0 ? allocated / durationWeeks : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start date *">
          <Input type="date" className="w-full" value={state.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
        </Field>
        <Field label="End date *">
          <Input type="date" className="w-full" value={state.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-100 px-3 py-2">
        <span className="text-small text-neutral-600">
          Estimated duration:{" "}
          <span className="font-medium text-neutral-950">
            {durationDays > 0 ? `${durationDays} days (~${durationWeeks} weeks)` : "—"}
          </span>
        </span>
        <AiButton
          label="AI: Suggest timeline"
          loading={timelineAI.loading}
          onClick={() => timelineAI.run({ name: state.name, today: "2026-07-24" })}
        />
      </div>
      {timelineAI.result && (
        <AiSuggestionCard
          reasoning={timelineAI.result.reasoning}
          onAccept={() => {
            patch({ startDate: timelineAI.result!.start_date, endDate: timelineAI.result!.end_date });
            timelineAI.setResult(null);
          }}
          onReject={() => timelineAI.setResult(null)}
        >
          <p className="text-body text-neutral-800">
            <span className="font-medium">Suggested:</span> {timelineAI.result.start_date} → {timelineAI.result.end_date}
          </p>
        </AiSuggestionCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Allocated budget">
          <Input
            type="number"
            className="w-full"
            value={state.allocatedBudget}
            onChange={(e) => patch({ allocatedBudget: e.target.value })}
          />
        </Field>
        <Field label="Currency">
          <Select
            className="w-full"
            value={state.currency}
            onChange={(e) => patch({ currency: e.target.value as WizardState["currency"] })}
          >
            <option value="INR">INR ₹</option>
            <option value="USD">USD $</option>
            <option value="EUR">EUR €</option>
          </Select>
        </Field>
      </div>
      <div>
        <AiButton
          label="AI: Estimate budget"
          loading={budgetAI.loading}
          onClick={() => budgetAI.run({ durationWeeks, currency: state.currency })}
        />
        {budgetAI.result && (
          <AiSuggestionCard
            reasoning={budgetAI.result.reasoning}
            onAccept={() => {
              patch({
                allocatedBudget: String(Math.round((budgetAI.result!.amount_low + budgetAI.result!.amount_high) / 2)),
              });
              budgetAI.setResult(null);
            }}
            onReject={() => budgetAI.setResult(null)}
          >
            <p className="text-body text-neutral-800">
              <span className="font-medium">Suggested range:</span>{" "}
              {fmtCurrency(budgetAI.result.amount_low, state.currency)} –{" "}
              {fmtCurrency(budgetAI.result.amount_high, state.currency)}
            </p>
          </AiSuggestionCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Billing type">
          <Select
            className="w-full"
            value={state.billingType}
            onChange={(e) => patch({ billingType: e.target.value as WizardState["billingType"] })}
          >
            <option value="">—</option>
            <option value="Fixed">Fixed</option>
            <option value="Hourly">Hourly</option>
            <option value="Retainer">Retainer</option>
            <option value="Non-billable">Non-billable</option>
          </Select>
        </Field>
        {state.billingType === "Hourly" && (
          <Field label="Hourly rate">
            <Input
              type="number"
              className="w-full"
              value={state.hourlyRate}
              onChange={(e) => patch({ hourlyRate: e.target.value })}
            />
          </Field>
        )}
        <Field label="Cost centre / Department">
          <Select className="w-full" value={state.costCentre} onChange={(e) => patch({ costCentre: e.target.value })}>
            <option value="">—</option>
            <option value="engineering">Engineering (placeholder)</option>
            <option value="design">Design (placeholder)</option>
            <option value="operations">Operations (placeholder)</option>
          </Select>
        </Field>
      </div>

      <div className="space-y-3 rounded-md border border-neutral-300 bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-h3 font-semibold text-neutral-950">Budget breakdown</h3>
          <AiButton
            label="AI: Suggest breakdown"
            loading={breakdownAI.loading}
            onClick={() => breakdownAI.run({ allocatedBudget: allocated })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Labor">
            <Input type="number" className="w-full" value={state.laborBudget} onChange={(e) => patch({ laborBudget: e.target.value })} />
          </Field>
          <Field label="Software / Tools">
            <Input type="number" className="w-full" value={state.softwareBudget} onChange={(e) => patch({ softwareBudget: e.target.value })} />
          </Field>
          <Field label="Services / Vendors">
            <Input type="number" className="w-full" value={state.servicesBudget} onChange={(e) => patch({ servicesBudget: e.target.value })} />
          </Field>
          <Field label="Other">
            <Input type="number" className="w-full" value={state.otherBudget} onChange={(e) => patch({ otherBudget: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-small">
          <span className="text-neutral-600">
            Categories total: <span className="font-medium text-neutral-950">{fmtCurrency(catTotal, state.currency)}</span>
          </span>
          {mismatch && (
            <span className="text-warning-600">
              Categories total {fmtCurrency(catTotal, state.currency)} — budget is {fmtCurrency(allocated, state.currency)}
            </span>
          )}
        </div>
        {breakdownAI.result && (
          <AiSuggestionCard
            reasoning={breakdownAI.result.reasoning}
            onAccept={() => {
              patch({
                laborBudget: String(breakdownAI.result!.labor),
                softwareBudget: String(breakdownAI.result!.software),
                servicesBudget: String(breakdownAI.result!.services),
                otherBudget: String(breakdownAI.result!.other),
              });
              breakdownAI.setResult(null);
            }}
            onReject={() => breakdownAI.setResult(null)}
          >
            <div className="grid grid-cols-2 gap-1 text-small text-neutral-800">
              <span>Labor: {fmtCurrency(breakdownAI.result.labor, state.currency)}</span>
              <span>Software: {fmtCurrency(breakdownAI.result.software, state.currency)}</span>
              <span>Services: {fmtCurrency(breakdownAI.result.services, state.currency)}</span>
              <span>Other: {fmtCurrency(breakdownAI.result.other, state.currency)}</span>
            </div>
          </AiSuggestionCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <div className="rounded-md border border-neutral-300 bg-neutral-50 p-4 sm:col-span-3">
          <h4 className="mb-2 font-heading text-body-medium font-semibold text-neutral-950">Budget split</h4>
          {catTotal > 0 ? (
            <DonutChart
              centerLabel={fmtCurrency(catTotal, state.currency)}
              centerSublabel="total"
              slices={[
                { label: `Labor · ${fmtCurrency(cats.labor, state.currency)}`, value: cats.labor, color: "info" },
                { label: `Software · ${fmtCurrency(cats.software, state.currency)}`, value: cats.software, color: "success" },
                { label: `Services · ${fmtCurrency(cats.services, state.currency)}`, value: cats.services, color: "warning" },
                { label: `Other · ${fmtCurrency(cats.other, state.currency)}`, value: cats.other, color: "neutral" },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-small text-neutral-500">Enter category amounts to see split</p>
          )}
        </div>

        <div className="space-y-3 rounded-md border border-neutral-300 bg-neutral-50 p-4 sm:col-span-2">
          <h4 className="font-heading text-body-medium font-semibold text-neutral-950">Timeline</h4>
          {durationDays > 0 ? (
            <>
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full rounded-full bg-primary-600" style={{ width: "100%" }} />
                </div>
                <div className="flex justify-between text-caption text-neutral-600">
                  <span>{state.startDate}</span>
                  <span>{state.endDate}</span>
                </div>
                <p className="text-small text-neutral-600">
                  Total: <span className="font-medium text-neutral-950">{durationWeeks} weeks ({durationDays} days)</span>
                </p>
              </div>
              {budgetPerWeek > 0 && (
                <div className="rounded-md bg-neutral-100 p-3" title="Based on allocated budget and estimated duration">
                  <p className="text-caption uppercase tracking-wide text-neutral-500">Budget per week</p>
                  <p className="font-heading text-h2 font-semibold text-neutral-950">
                    {fmtCurrency(budgetPerWeek, state.currency)}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-small text-neutral-500">Set start and end dates to see timeline</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 3 — Team & Resources
// ─────────────────────────────────────────────────────────────

function Step3({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const teamAI = useAiCall<{ role: string; count: number }[]>("Planner", "suggest_team_composition");

  function updateMember(idx: number, p: Partial<WizardState["members"][number]>) {
    patch({ members: state.members.map((m, i) => (i === idx ? { ...m, ...p } : m)) });
  }
  function addMember() {
    patch({ members: [...state.members, { userId: "", role: "Engineer", hoursPerWeek: "20", access: "Editor" }] });
  }
  function removeMember(idx: number) {
    patch({ members: state.members.filter((_, i) => i !== idx) });
  }

  const DEPTS = ["Engineering", "Design", "Product", "Operations", "Marketing"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-small text-neutral-600">Roles and access levels for this project.</span>
        <AiButton
          label="AI: Suggest team composition"
          loading={teamAI.loading}
          onClick={() => teamAI.run({ name: state.name })}
        />
      </div>
      {teamAI.result && (
        <AiSuggestionCard
          reasoning="Composition inferred from your project name and typical squad shape."
          onAccept={() => {
            patch({
              members: teamAI.result!.flatMap((r) =>
                Array.from({ length: r.count }, () => ({
                  userId: "",
                  role: r.role,
                  hoursPerWeek: "20",
                  access: "Editor" as const,
                })),
              ),
            });
            teamAI.setResult(null);
          }}
          onReject={() => teamAI.setResult(null)}
        >
          <ul className="text-small text-neutral-800">
            {teamAI.result.map((r) => (
              <li key={r.role}>
                {r.count} × {r.role}
              </li>
            ))}
          </ul>
        </AiSuggestionCard>
      )}

      <Field label="Project lead *">
        <Input
          className="w-full"
          value={state.projectLead}
          onChange={(e) => patch({ projectLead: e.target.value })}
          placeholder="User ID"
        />
      </Field>

      <div className="space-y-2">
        <span className="text-body-medium font-medium text-neutral-800">Team members</span>
        {state.members.length === 0 && <p className="text-small text-neutral-500">No members yet.</p>}
        {state.members.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 rounded-md border border-neutral-300 bg-neutral-50 p-2">
            <Input
              className="col-span-12 sm:col-span-4"
              value={m.userId}
              onChange={(e) => updateMember(i, { userId: e.target.value })}
              placeholder="User ID"
            />
            <Select
              className="col-span-6 sm:col-span-3"
              value={m.role}
              onChange={(e) => updateMember(i, { role: e.target.value })}
            >
              <option>Engineer</option>
              <option>Designer</option>
              <option>PM / Analyst</option>
              <option>Project Lead</option>
            </Select>
            <Input
              className="col-span-3 sm:col-span-2"
              type="number"
              value={m.hoursPerWeek}
              onChange={(e) => updateMember(i, { hoursPerWeek: e.target.value })}
              placeholder="hrs/wk"
            />
            <Select
              className="col-span-2 sm:col-span-2"
              value={m.access}
              onChange={(e) => updateMember(i, { access: e.target.value as WizardState["members"][number]["access"] })}
            >
              <option>Admin</option>
              <option>Editor</option>
              <option>Viewer</option>
            </Select>
            <button
              type="button"
              className="col-span-1 text-small text-danger-600 hover:underline"
              onClick={() => removeMember(i)}
            >
              Remove
            </button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addMember}>
          + Add member
        </Button>
      </div>

      <Field label="Departments involved">
        <div className="flex flex-wrap gap-2">
          {DEPTS.map((d) => {
            const on = state.departments.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  patch({ departments: on ? state.departments.filter((x) => x !== d) : [...state.departments, d] })
                }
                className={`rounded-full px-3 py-1 text-small ${
                  on ? "bg-primary-100 text-primary-700 outline outline-1 outline-primary-600" : "bg-neutral-100 text-neutral-600 outline outline-1 outline-neutral-300"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="External collaborators (comma-separated emails)">
        <Input
          className="w-full"
          value={state.externalCollaborators}
          onChange={(e) => patch({ externalCollaborators: e.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 text-body text-neutral-800">
        <input
          type="checkbox"
          checked={state.notifyOnCreation}
          onChange={(e) => patch({ notifyOnCreation: e.target.checked })}
        />
        Notify team on creation
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 4 — Documents & Attachments
// ─────────────────────────────────────────────────────────────

function Step4({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const briefAI = useAiCall<string>("Writer", "project_brief");
  const kickoffAI = useAiCall<string>("Writer", "kickoff_notes");
  const [briefEditing, setBriefEditing] = useState<string | null>(null);
  const [briefSubModal, setBriefSubModal] = useState(false);
  const [kickoffEditing, setKickoffEditing] = useState<string | null>(null);

  function pickFile(label: string, key: "brief" | "contract") {
    return (
      <div className="space-y-1">
        <label className="text-body-medium font-medium text-neutral-800">{label}</label>
        <input
          type="file"
          className="block w-full text-body text-neutral-700"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              console.log("NewProjectWizard: file selected", { field: key, name: f.name, size: f.size });
              patch({ [key]: f.name } as Partial<WizardState>);
            }
          }}
        />
        {state[key] && <p className="text-small text-neutral-600">Selected: {state[key]}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {pickFile("Project brief / SOW", "brief")}
        <AiButton
          label="AI: Draft project brief"
          loading={briefAI.loading}
          onClick={async () => {
            await briefAI.run({ name: state.name, description: state.description, goal: state.goal });
            setBriefSubModal(true);
          }}
        />
      </div>

      <div className="space-y-1">
        <label className="text-body-medium font-medium text-neutral-800">Reference documents</label>
        <input
          type="file"
          multiple
          className="block w-full text-body text-neutral-700"
          onChange={(e) => {
            const names = Array.from(e.target.files ?? []).map((f) => f.name);
            console.log("NewProjectWizard: reference files selected", { names });
            patch({ referenceDocs: names.join(", ") });
          }}
        />
        {state.referenceDocs && <p className="text-small text-neutral-600">Selected: {state.referenceDocs}</p>}
      </div>

      <Field label="Existing links (one URL per line)">
        <Textarea
          className="w-full"
          rows={3}
          value={state.existingLinks}
          onChange={(e) => patch({ existingLinks: e.target.value })}
        />
      </Field>

      {/* TODO: admin-only visibility to be added later */}
      {pickFile("Contract / MSA", "contract")}

      <Field label="Import from template">
        <Select className="w-full" value={state.templateId} onChange={(e) => patch({ templateId: e.target.value })}>
          <option value="">Start blank</option>
          <option value="template-webapp">Web app build (placeholder)</option>
          <option value="template-marketing">Marketing campaign (placeholder)</option>
        </Select>
      </Field>

      <div className="space-y-2">
        <Field label="Kick-off notes">
          <Textarea
            className="w-full"
            rows={4}
            value={state.kickoffNotes}
            onChange={(e) => patch({ kickoffNotes: e.target.value })}
          />
        </Field>
        <AiButton
          label="AI: Draft kick-off notes"
          loading={kickoffAI.loading}
          onClick={() => kickoffAI.run({ name: state.name })}
        />
        {kickoffAI.result && (
          <AiSuggestionCard
            onAccept={() => {
              patch({ kickoffNotes: kickoffEditing ?? kickoffAI.result! });
              kickoffAI.setResult(null);
              setKickoffEditing(null);
            }}
            onReject={() => {
              kickoffAI.setResult(null);
              setKickoffEditing(null);
            }}
            onEdit={() => setKickoffEditing(kickoffAI.result!)}
          >
            {kickoffEditing !== null ? (
              <Textarea
                className="w-full"
                rows={6}
                value={kickoffEditing}
                onChange={(e) => setKickoffEditing(e.target.value)}
              />
            ) : (
              <p className="whitespace-pre-wrap text-body text-neutral-800">{kickoffAI.result}</p>
            )}
          </AiSuggestionCard>
        )}
      </div>

      {briefSubModal && briefAI.result && (
        <Modal
          maxWidth="max-w-2xl"
          onClose={() => {
            setBriefSubModal(false);
            setBriefEditing(null);
          }}
        >
          <div className="space-y-3">
            <AiBanner />
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">AI-drafted project brief</h3>
            {briefEditing !== null ? (
              <Textarea
                className="w-full"
                rows={16}
                value={briefEditing}
                onChange={(e) => setBriefEditing(e.target.value)}
              />
            ) : (
              <pre className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-body text-neutral-800">
                {briefAI.result}
              </pre>
            )}
            <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setBriefSubModal(false);
                  briefAI.setResult(null);
                  setBriefEditing(null);
                }}
              >
                Reject
              </Button>
              {briefEditing === null && (
                <Button type="button" variant="secondary" onClick={() => setBriefEditing(briefAI.result!)}>
                  Edit
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  const value = briefEditing ?? briefAI.result!;
                  patch({ brief: `ai-brief-${state.name || "untitled"}.md` });
                  console.log("NewProjectWizard: brief accepted", { value });
                  setBriefSubModal(false);
                  briefAI.setResult(null);
                  setBriefEditing(null);
                }}
              >
                Accept
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
