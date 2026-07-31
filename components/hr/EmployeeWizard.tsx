"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { EMPLOYMENT_STATUSES } from "@/lib/constants";

type Template = { id: string; name: string; structure: { description?: string } };

type WizardState = {
  // Step 1 — Personal
  fullName: string;
  email: string;
  personalEmail: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  // Step 2 — Work
  jobTitle: string;
  employeeCode: string;
  employmentStatus: (typeof EMPLOYMENT_STATUSES)[number];
  employmentType: "full_time" | "part_time" | "contract" | "intern" | "consultant";
  startDate: string;
  location: string;
  managerId: string;
  // Step 3 — Capacity, skills, AI
  availableHoursPerWeek: string;
  roles: string;
  skills: string;
  costRateHourly: string;
  currency: string;
  notes: string;
  // Step 4 — Onboarding (conditional on employmentStatus === "onboarding")
  templateId: string;
};

const INITIAL: WizardState = {
  fullName: "",
  email: "",
  personalEmail: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  nationality: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",
  jobTitle: "",
  employeeCode: "",
  employmentStatus: "onboarding",
  employmentType: "full_time",
  startDate: "",
  location: "",
  managerId: "",
  availableHoursPerWeek: "40",
  roles: "",
  skills: "",
  costRateHourly: "",
  currency: "INR",
  notes: "",
  templateId: "",
};

const STEP_TITLES = ["Personal Info", "Work Info", "Capacity & Skills", "Onboarding"] as const;

export function EmployeeWizard({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  const hasOnboardingStep = state.employmentStatus === "onboarding";
  const steps = hasOnboardingStep ? STEP_TITLES : STEP_TITLES.slice(0, 3);
  const lastStep = steps.length - 1;

  useEffect(() => {
    fetch(`/api/onboarding/templates?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setTemplates(b.data ?? []))
      .catch(() => setTemplates([]));
  }, [orgId]);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  async function handleSubmit() {
    if (!state.fullName.trim()) {
      setStep(0);
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        full_name: state.fullName,
        email: state.email || null,
        personal_email: state.personalEmail || null,
        phone: state.phone || null,
        date_of_birth: state.dateOfBirth || null,
        gender: state.gender || null,
        marital_status: state.maritalStatus || null,
        nationality: state.nationality || null,
        address: state.address || null,
        city: state.city || null,
        state: state.state || null,
        zip_code: state.zipCode || null,
        job_title: state.jobTitle || null,
        employment_status: state.employmentStatus,
        start_date: state.startDate || null,
        manager_id: state.managerId || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to create employee");
      return;
    }

    // employee_code/employment_type/location/available_hours/roles/skills/
    // cost_rate/currency/notes aren't on POST /api/employees (that route
    // predates HR Batch 1) — a follow-up PATCH fills them in, same two-call
    // shape the New Employee form already used for the account-invite step.
    await fetch(`/api/employees/${body.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_code: state.employeeCode || null,
        employment_type: state.employmentType,
        location: state.location || null,
        available_hours_per_week: Number(state.availableHoursPerWeek) || 40,
        roles: state.roles ? state.roles.split(",").map((s) => s.trim()).filter(Boolean) : [],
        skills: state.skills ? state.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        cost_rate_hourly: state.costRateHourly ? Number(state.costRateHourly) : null,
        currency: state.currency || null,
        notes: state.notes || null,
        country: state.country || null,
      }),
    });

    if (hasOnboardingStep && state.templateId) {
      await fetch("/api/onboarding/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, employee_id: body.data.id, template_id: state.templateId }),
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-6">
        <Stepper titles={steps} current={step} />
        <h2 className="text-h2 font-semibold text-neutral-950">Add Employee — {steps[step]}</h2>
        {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {step === 0 && <PersonalStep state={state} patch={patch} />}
          {step === 1 && <WorkStep state={state} patch={patch} />}
          {step === 2 && <CapacityStep state={state} patch={patch} />}
          {step === 3 && hasOnboardingStep && <OnboardingStep state={state} patch={patch} templates={templates} />}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                Back
              </Button>
            )}
            {step < lastStep ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !state.fullName.trim()}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={saving || !state.fullName.trim()}>
                {saving ? "Creating…" : "Create Employee"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Stepper({ titles, current }: { titles: readonly string[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {titles.map((title, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={title} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                active ? "bg-success-600 text-neutral-50" : done ? "bg-success-600 text-neutral-50" : "bg-neutral-100 text-neutral-500 outline outline-1 outline-neutral-300"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span className={`hidden text-small font-medium sm:inline ${active ? "text-neutral-950" : "text-neutral-500"}`}>{title}</span>
            {i < titles.length - 1 && <div className={`mx-1 h-px flex-1 ${done ? "bg-success-600" : "bg-neutral-300"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function PersonalStep({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name *">
        <Input className="w-full" value={state.fullName} onChange={(e) => patch({ fullName: e.target.value })} autoFocus />
      </Field>
      <Field label="Work email">
        <Input type="email" className="w-full" value={state.email} onChange={(e) => patch({ email: e.target.value })} />
      </Field>
      <Field label="Personal email">
        <Input type="email" className="w-full" value={state.personalEmail} onChange={(e) => patch({ personalEmail: e.target.value })} />
      </Field>
      <Field label="Phone">
        <Input className="w-full" value={state.phone} onChange={(e) => patch({ phone: e.target.value })} />
      </Field>
      <Field label="Date of birth">
        <Input type="date" className="w-full" value={state.dateOfBirth} onChange={(e) => patch({ dateOfBirth: e.target.value })} />
      </Field>
      <Field label="Gender">
        <Input className="w-full" value={state.gender} onChange={(e) => patch({ gender: e.target.value })} />
      </Field>
      <Field label="Marital status">
        <Input className="w-full" value={state.maritalStatus} onChange={(e) => patch({ maritalStatus: e.target.value })} />
      </Field>
      <Field label="Nationality">
        <Input className="w-full" value={state.nationality} onChange={(e) => patch({ nationality: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address">
          <Input className="w-full" value={state.address} onChange={(e) => patch({ address: e.target.value })} />
        </Field>
      </div>
      <Field label="City">
        <Input className="w-full" value={state.city} onChange={(e) => patch({ city: e.target.value })} />
      </Field>
      <Field label="State">
        <Input className="w-full" value={state.state} onChange={(e) => patch({ state: e.target.value })} />
      </Field>
      <Field label="ZIP code">
        <Input className="w-full" value={state.zipCode} onChange={(e) => patch({ zipCode: e.target.value })} />
      </Field>
      <Field label="Country">
        <Input className="w-full" value={state.country} onChange={(e) => patch({ country: e.target.value })} />
      </Field>
    </div>
  );
}

function WorkStep({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Job title">
        <Input className="w-full" value={state.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} />
      </Field>
      <Field label="Employee code">
        <Input className="w-full" value={state.employeeCode} onChange={(e) => patch({ employeeCode: e.target.value })} />
      </Field>
      <Field label="Employment status">
        <Select className="w-full" value={state.employmentStatus} onChange={(e) => patch({ employmentStatus: e.target.value as WizardState["employmentStatus"] })}>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Employment type">
        <Select className="w-full" value={state.employmentType} onChange={(e) => patch({ employmentType: e.target.value as WizardState["employmentType"] })}>
          {(["full_time", "part_time", "contract", "intern", "consultant"] as const).map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Start date">
        <Input type="date" className="w-full" value={state.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
      </Field>
      <Field label="Location">
        <Input className="w-full" value={state.location} onChange={(e) => patch({ location: e.target.value })} />
      </Field>
      <Field label="Manager (employee ID)">
        <Input className="w-full" value={state.managerId} onChange={(e) => patch({ managerId: e.target.value })} placeholder="Optional — paste manager's employee ID" />
      </Field>
    </div>
  );
}

function CapacityStep({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Available hours/week">
        <Input type="number" className="w-full" value={state.availableHoursPerWeek} onChange={(e) => patch({ availableHoursPerWeek: e.target.value })} />
      </Field>
      <Field label="Cost rate (hourly)">
        <Input type="number" className="w-full" value={state.costRateHourly} onChange={(e) => patch({ costRateHourly: e.target.value })} />
      </Field>
      <Field label="Currency">
        <Input className="w-full" value={state.currency} onChange={(e) => patch({ currency: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Roles (comma-separated)">
          <Input className="w-full" value={state.roles} onChange={(e) => patch({ roles: e.target.value })} placeholder="Developer, Team Lead" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Skills (comma-separated)">
          <Input className="w-full" value={state.skills} onChange={(e) => patch({ skills: e.target.value })} placeholder="React, Python, Figma" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Notes (HR-admin only — never shown to a role without employee:view_full)">
          <Textarea className="w-full" rows={3} value={state.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function OnboardingStep({
  state,
  patch,
  templates,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  templates: Template[];
}) {
  const suggestAI = useAiCall<{ template_name: string; reasoning: string }>("Planner", "suggest_onboarding_template");

  return (
    <div className="space-y-4">
      <Field label="Onboarding template">
        <div className="space-y-2">
          <Select className="w-full" value={state.templateId} onChange={(e) => patch({ templateId: e.target.value })}>
            <option value="">No template — start blank</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <AiButton
            label="AI: Suggest onboarding template"
            loading={suggestAI.loading}
            onClick={() => suggestAI.run({ job_title: state.jobTitle })}
          />
          {suggestAI.result && (
            <AiSuggestionCard
              reasoning={suggestAI.result.reasoning}
              onAccept={() => {
                const match = templates.find((t) => t.name === suggestAI.result!.template_name);
                if (match) patch({ templateId: match.id });
                suggestAI.setResult(null);
              }}
              onReject={() => suggestAI.setResult(null)}
            >
              <p className="text-body-medium font-medium text-neutral-950">Suggested: {suggestAI.result.template_name}</p>
            </AiSuggestionCard>
          )}
        </div>
      </Field>
      <p className="text-small text-neutral-600">
        The selected template&apos;s checklist is assigned to this employee once they&apos;re created — you can adjust individual
        steps afterward from their profile&apos;s Onboarding tab.
      </p>
    </div>
  );
}
