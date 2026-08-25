"use client";

import { useEffect, useState, use } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { PermissionAction, ResourceType } from "@/lib/api/permissions";
import { EmploymentStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { AttendanceCalendar, type AttendanceRecord, type AttendanceSettings } from "@/components/hr/AttendanceCalendar";
import { AttendanceHistoryList } from "@/components/hr/AttendanceHistoryList";
import { ManualEntryModal } from "@/components/hr/ManualEntryModal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import type { BalanceEntry, LeaveRequest, LeaveType } from "@/app/(app)/hr/leave/LeavePageClient";
import { EMPLOYMENT_STATUSES } from "@/lib/constants";

type Employee = {
  id: string;
  orgId: string;
  userId: string | null;
  fullName: string;
  jobTitle: string | null;
  employmentStatus: string;
  employmentType: string;
  startDate: string | null;
  endDate: string | null;
  email: string | null;
  phone: string | null;
  personalEmail?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  location: string | null;
  employeeCode: string | null;
  managerId: string | null;
  availableHoursPerWeek: number;
  roles: string[];
  skills: string[];
  costRateHourly?: number | null;
  currency?: string | null;
  notes?: string | null;
};

type Step = {
  step_id: string;
  title: string;
  description: string;
  category: string;
  owner_role: string;
  days_after_start: number;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
};
type Workflow = { id: string; steps: Step[]; status: string; templateId: string | null };
type Template = { id: string; name: string };
type BonusEntry = { type: string; amount: number; currency: string; effective_date: string; is_recurring: boolean; notes: string };
type BenefitEntry = { name: string; monetary_value: number; currency: string; notes: string };
type DeductionEntry = { name: string; amount: number; currency: string; is_recurring: boolean; notes: string };
type CompensationRecord = {
  id: string;
  baseSalary: number;
  currency: string;
  payFrequency: string;
  effectiveDate: string;
  endDate: string | null;
  reason: string | null;
  notes: string | null;
  bonus: BonusEntry[] | null;
  benefits: BenefitEntry[] | null;
  deductions: DeductionEntry[] | null;
  createdAt: string;
  createdByUserId: string | null;
};
type PayslipRecord = {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  currency: string;
  status: string;
};


const TABS = ["Overview", "Onboarding", "Attendance", "Leave", "Compensation", "Projects", "Activity", "AI Insights"] as const;
type Tab = (typeof TABS)[number];

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, selectedOrgId } = useOrg();
  const [tab, setTab] = useState<Tab>("Overview");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadEmployee() {
    setLoading(true);
    setError(null);
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load employee");
        setEmployee(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load employee"))
      .finally(() => setLoading(false));
  }

  useEffect(loadEmployee, [id]);

  if (loading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  if (!employee || !selectedOrgId) return <p className="rounded-md bg-neutral-100 p-6 text-body text-neutral-600">Employee not found.</p>;

  const showOnboardingTab = employee.employmentStatus === "onboarding" || tab === "Onboarding";
  const showCompensationTab = can("compensation", "view_sensitive");
  const visibleTabs = TABS.filter((t) => (t === "Compensation" ? showCompensationTab : true));

  const initials = employee.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-400,#a78bfa)] text-h2 font-bold text-white shadow-md">
            {initials}
          </span>
          <div>
            <h1 className="text-display font-semibold text-neutral-950">{employee.fullName}</h1>
            <p className="mt-0.5 text-body text-neutral-500">
              {employee.jobTitle ?? "No title set"}
              {employee.employeeCode && <span className="ml-1.5 text-neutral-400">· {employee.employeeCode}</span>}
              {employee.location && <span className="ml-1.5 text-neutral-400">· {employee.location}</span>}
            </p>
          </div>
        </div>
        <EmploymentStatusBadge status={employee.employmentStatus} />
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2.5 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-[var(--primary-600)] text-[var(--primary-600)]" : "text-neutral-500 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab employee={employee} can={can} onUpdated={loadEmployee} />}
      {tab === "Onboarding" && showOnboardingTab && <OnboardingTab employee={employee} orgId={selectedOrgId} can={can} />}
      {tab === "Attendance" && <AttendanceTab employee={employee} orgId={selectedOrgId} can={can} />}
      {tab === "Leave" && <LeaveTab employee={employee} orgId={selectedOrgId} can={can} />}
      {tab === "Compensation" && showCompensationTab && <CompensationTab employeeId={employee.id} orgId={selectedOrgId} can={can} />}
      {tab === "Projects" && <ProjectsTab />}
      {tab === "Activity" && <ActivityTab employeeId={employee.id} orgId={selectedOrgId} />}
      {tab === "AI Insights" && <AiInsightsTab employee={employee} />}
    </div>
  );
}

function OverviewTab({
  employee,
  can,
  onUpdated,
}: {
  employee: Employee;
  can: (r: ResourceType, a: PermissionAction) => boolean;
  onUpdated: () => void;
}) {
  const canUpdate = can("employee", "update");
  const canTerminate = can("employee", "terminate");
  const canViewFull = employee.dateOfBirth !== undefined;
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(employee.fullName);
  const [jobTitle, setJobTitle] = useState(employee.jobTitle ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [location, setLocation] = useState(employee.location ?? "");
  const [employmentStatus, setEmploymentStatus] = useState(employee.employmentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  async function handleLinkMyAccount() {
    setLinking(true);
    setError(null);
    const { data } = await createClient().auth.getUser();
    if (!data.user) {
      setError("Not signed in");
      setLinking(false);
      return;
    }
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: data.user.id }),
    });
    const body = await res.json();
    setLinking(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to link account");
      return;
    }
    onUpdated();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        job_title: jobTitle || null,
        email: email || null,
        phone: phone || null,
        location: location || null,
        employment_status: employmentStatus,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    setEditing(false);
    onUpdated();
  }

  async function handleTerminate() {
    if (!confirm(`Terminate ${employee.fullName}? This can't be easily undone.`)) return;
    const res = await fetch(`/api/employees/${employee.id}/terminate`, { method: "POST" });
    if (res.ok) onUpdated();
  }

  const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-neutral-100 last:border-0">
      <dt className="text-caption font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-body text-neutral-950">{children}</dd>
    </div>
  );

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {editing ? (
        <Card>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Job title">
                <Input className="w-full" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input type="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Location">
                <Input className="w-full" value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
              <Field label="Employment status">
                <Select className="w-full" value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)}>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">Employment</h3>
              <dl>
                <DetailRow label="Status"><EmploymentStatusBadge status={employee.employmentStatus} /></DetailRow>
                <DetailRow label="Type">{employee.employmentType.replace(/_/g, " ")}</DetailRow>
                <DetailRow label="Start date">{employee.startDate ?? "—"}</DetailRow>
                {employee.endDate && <DetailRow label="End date">{employee.endDate}</DetailRow>}
                <DetailRow label="Hours / week">{employee.availableHoursPerWeek}</DetailRow>
                <DetailRow label="Linked account">{employee.userId ? <Badge color="success">Linked</Badge> : <Badge color="neutral">Not linked</Badge>}</DetailRow>
              </dl>
            </Card>

            <Card>
              <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">Contact</h3>
              <dl>
                <DetailRow label="Email">{employee.email ?? "—"}</DetailRow>
                <DetailRow label="Phone">{employee.phone ?? "—"}</DetailRow>
                <DetailRow label="Location">{employee.location ?? "—"}</DetailRow>
              </dl>
              <h3 className="mb-3 mt-5 text-body-medium font-semibold text-neutral-950">Roles & Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {[...employee.roles, ...employee.skills].length === 0
                  ? <span className="text-body text-neutral-400">None assigned</span>
                  : [...employee.roles, ...employee.skills].map((s) => (
                      <span key={s} className="rounded-full bg-[var(--primary-100)] px-2.5 py-0.5 text-caption font-medium text-[var(--primary-600)]">
                        {s}
                      </span>
                    ))}
              </div>
            </Card>
          </div>

          {canViewFull && (
            <Card>
              <h3 className="mb-3 text-body-medium font-semibold text-neutral-950">Personal</h3>
              <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <DetailRow label="Date of birth">{employee.dateOfBirth ?? "—"}</DetailRow>
                <DetailRow label="Nationality">{employee.nationality ?? "—"}</DetailRow>
                <div className="sm:col-span-2">
                  <DetailRow label="Address">
                    {[employee.address, employee.city, employee.state, employee.zipCode].filter(Boolean).join(", ") || "—"}
                  </DetailRow>
                </div>
                <DetailRow label="Cost rate (hourly)">
                  {employee.costRateHourly != null ? `${employee.currency ?? ""} ${employee.costRateHourly}` : "—"}
                </DetailRow>
              </dl>
              {employee.notes && (
                <div className="mt-3 rounded-md bg-neutral-50 p-3">
                  <p className="text-caption font-medium uppercase tracking-wide text-neutral-400 mb-1">Notes</p>
                  <p className="whitespace-pre-wrap text-body text-neutral-950">{employee.notes}</p>
                </div>
              )}
            </Card>
          )}

          {!canViewFull && (
            <p className="text-caption text-neutral-500">
              Some personal fields (DOB, address, cost rate, notes) are hidden — your role doesn&apos;t have employee:view_full.
            </p>
          )}

          {!employee.userId && (
            <Card className="!border-l-4 !border-l-info-600 !bg-info-50">
              <p className="text-body text-info-700">
                This record isn&apos;t linked to a login yet. If this employee is you, claim it below.
              </p>
              <Button variant="secondary" className="mt-2" onClick={handleLinkMyAccount} disabled={linking}>
                {linking ? "Linking…" : "This is me — link my account"}
              </Button>
            </Card>
          )}

          <div className="flex gap-3">
            {canUpdate && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canTerminate && employee.employmentStatus !== "terminated" && (
              <Button variant="danger" onClick={handleTerminate}>
                Terminate
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  paperwork: "Paperwork",
  setup: "Setup",
  orientation: "Orientation",
  training: "Training",
  assignments: "Assignments",
};

function OnboardingTab({
  employee,
  orgId,
  can,
}: {
  employee: Employee;
  orgId: string;
  can: (r: ResourceType, a: PermissionAction) => boolean;
}) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const canManage = can("onboarding", "complete_step") || can("employee", "update");

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/onboarding/workflows?org_id=${orgId}&employee_id=${employee.id}`).then((r) => r.json()),
      fetch(`/api/onboarding/templates?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([wfBody, tplBody]) => {
        if (wfBody.error) throw new Error(wfBody.error);
        setWorkflow(wfBody.data?.[0] ?? null);
        setTemplates(tplBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load onboarding"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [employee.id, orgId]);

  async function assignTemplate() {
    if (!selectedTemplate) return;
    setSaving("__assign__");
    const res = await fetch("/api/onboarding/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, employee_id: employee.id, template_id: selectedTemplate }),
    });
    setSaving(null);
    if (res.ok) load();
  }

  async function setStepStatus(stepId: string, status: string) {
    if (!workflow) return;
    setSaving(stepId);
    const res = await fetch(`/api/onboarding/workflows/${workflow.id}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    setSaving(null);
    if (res.ok) setWorkflow(body.data);
  }

  if (loading) return <SectionSkeleton variant="text" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  if (!workflow) {
    return (
      <Card className="space-y-3">
        <p className="text-body text-neutral-600">No onboarding checklist assigned yet.</p>
        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Template">
              <Select className="w-56" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={assignTemplate} disabled={!selectedTemplate || saving === "__assign__"}>
              {saving === "__assign__" ? "Assigning…" : "Assign template"}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const doneCount = workflow.steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  const pct = workflow.steps.length ? Math.round((doneCount / workflow.steps.length) * 100) : 0;
  const byCategory = workflow.steps.reduce<Record<string, Step[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-neutral-950">Onboarding checklist</h2>
        <Badge color={workflow.status === "complete" ? "success" : workflow.status === "in_progress" ? "info" : "neutral"}>
          {workflow.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-success-600" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-caption text-neutral-600">
          {doneCount}/{workflow.steps.length} steps done ({pct}%)
        </p>
      </div>

      {Object.entries(byCategory).map(([category, steps]) => (
        <div key={category} className="space-y-2">
          <h3 className="text-body-medium font-semibold text-neutral-800">{CATEGORY_LABEL[category] ?? category}</h3>
          <ul className="space-y-1.5">
            {steps.map((step) => (
              <li key={step.step_id} className="flex items-center gap-2.5 glass-card rounded-md px-3 py-2">
                <input
                  type="checkbox"
                  checked={step.status === "completed"}
                  disabled={!canManage || saving === step.step_id}
                  onChange={(e) => setStepStatus(step.step_id, e.target.checked ? "completed" : "pending")}
                  className="h-4 w-4 rounded-sm border-neutral-300 text-success-600 focus:outline focus:outline-2 focus:outline-success-600"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-body ${step.status === "completed" ? "text-neutral-400 line-through" : "text-neutral-950"}`}>{step.title}</p>
                  <p className="text-caption text-neutral-500">
                    {step.owner_role} · {step.days_after_start >= 0 ? `Day +${step.days_after_start}` : `Day ${step.days_after_start}`}
                  </p>
                </div>
                {step.status === "skipped" && <Badge color="neutral">Skipped</Badge>}
                {canManage && step.status !== "completed" && step.status !== "skipped" && (
                  <button
                    type="button"
                    onClick={() => setStepStatus(step.step_id, "skipped")}
                    className="text-caption text-neutral-500 hover:underline"
                  >
                    Skip
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

function ComplianceLimitationBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-small text-warning-600">
        This module tracks compensation records only. It does not calculate taxes, statutory deductions (PF/ESI/TDS),
        or process actual payments. Consult a payroll/tax professional for compliance.
      </p>
    </div>
  );
}

function CompensationTab({ employeeId, orgId, can }: { employeeId: string; orgId: string; can: (r: ResourceType, a: PermissionAction) => boolean }) {
  const [records, setRecords] = useState<CompensationRecord[]>([]);
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const canUpdate = can("compensation", "update") || can("compensation", "create");
  const canViewSensitive = can("compensation", "view_sensitive");

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/employees/${employeeId}/compensation`).then((r) => r.json()),
      canViewSensitive ? fetch(`/api/payroll/records?org_id=${orgId}&employee_id=${employeeId}`).then((r) => r.json()) : Promise.resolve({ data: [] }),
    ])
      .then(([compBody, payslipBody]) => {
        if (!compBody.data) throw new Error(compBody.error ?? "Failed to load compensation");
        setRecords(compBody.data);
        setPayslips(payslipBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load compensation"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [employeeId, orgId]);

  if (loading) return <SectionSkeleton variant="text" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const current = records.find((r) => !r.endDate) ?? records[0];

  return (
    <div className="space-y-6">
      <ComplianceLimitationBanner />

      <Card className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            {current ? (
              <>
                <p className="text-display font-semibold text-neutral-950">
                  {current.currency} {current.baseSalary.toLocaleString()}
                  <span className="ml-2 text-body font-normal text-neutral-600">/ {current.payFrequency.replace(/_/g, " ")}</span>
                </p>
                <p className="mt-1 text-small text-neutral-600">Effective since {current.effectiveDate}</p>
              </>
            ) : (
              <p className="text-body text-neutral-600">No compensation record yet.</p>
            )}
          </div>
          {canUpdate && (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              Update Compensation
            </Button>
          )}
        </div>
      </Card>

      {showForm && (
        <Card>
          <CompensationForm employeeId={employeeId} onSaved={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Compensation history</h2>
        {records.length === 0 ? (
          <p className="text-body text-neutral-600">No compensation records yet.</p>
        ) : (
          <Card padding="sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective period</TableHead>
                  <TableHead>Base salary</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Bonus total</TableHead>
                  <TableHead>Benefits</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...records]
                  .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
                  .map((r) => {
                    const bonusTotal = (r.bonus ?? []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-neutral-600">
                          {r.effectiveDate} — {r.endDate ?? "Current"}
                        </TableCell>
                        <TableCell>
                          {r.currency} {r.baseSalary.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-neutral-600">{r.reason ?? "—"}</TableCell>
                        <TableCell className="text-neutral-600">{bonusTotal ? `${r.currency} ${bonusTotal.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-neutral-600">{(r.benefits ?? []).length || "—"}</TableCell>
                        <TableCell className="text-caption text-neutral-500">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {canViewSensitive && (
        <div>
          <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Payslip records</h2>
          {payslips.length === 0 ? (
            <p className="text-body text-neutral-600">No payslip records yet — generate payroll from the Payroll page.</p>
          ) : (
            <Card padding="sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-neutral-600">
                        {p.periodStart} → {p.periodEnd}
                      </TableCell>
                      <TableCell>
                        {p.currency} {p.grossAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {p.currency} {p.totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.currency} {p.netAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge color={p.status === "paid" ? "success" : p.status === "finalized" ? "info" : "neutral"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <a href={`/api/payroll/records/${p.id}/export`} className="text-small font-medium text-primary-700 hover:underline">
                          Download PDF
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CompensationForm({ employeeId, onSaved, onCancel }: { employeeId: string; onSaved: () => void; onCancel: () => void }) {
  const [baseSalary, setBaseSalary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [payFrequency, setPayFrequency] = useState("monthly");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [bonus, setBonus] = useState<BonusEntry[]>([]);
  const [benefits, setBenefits] = useState<BenefitEntry[]>([]);
  const [deductions, setDeductions] = useState<DeductionEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baseSalary || !effectiveDate) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/compensation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_salary: Number(baseSalary),
        currency,
        pay_frequency: payFrequency,
        effective_date: effectiveDate,
        reason: reason || null,
        bonus: bonus.length ? bonus : null,
        benefits: benefits.length ? benefits : null,
        deductions: deductions.length ? deductions : null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-h3 font-semibold text-neutral-950">Update compensation</h3>
      <p className="text-caption text-neutral-600">
        Saving creates a new record and closes the current one the day before this record&apos;s effective date.
      </p>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Base salary *">
          <Input type="number" className="w-full" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} autoFocus />
        </Field>
        <Field label="Currency">
          <Input className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </Field>
        <Field label="Pay frequency">
          <Select className="w-full" value={payFrequency} onChange={(e) => setPayFrequency(e.target.value)}>
            {["monthly", "biweekly", "weekly", "annual"].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Effective date *">
          <Input type="date" className="w-full" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Reason">
        <Select className="w-full max-w-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">—</option>
          {["hire", "annual_review", "promotion", "adjustment", "demotion", "other"].map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>

      <EntryRows
        title="Bonus"
        entries={bonus}
        onChange={setBonus}
        newEntry={() => ({ type: "", amount: 0, currency, effective_date: effectiveDate, is_recurring: false, notes: "" })}
        fields={[
          { key: "type", label: "Type", type: "text" },
          { key: "amount", label: "Amount", type: "number" },
          { key: "effective_date", label: "Effective date", type: "date" },
        ]}
      />
      <EntryRows
        title="Benefits"
        entries={benefits}
        onChange={setBenefits}
        newEntry={() => ({ name: "", monetary_value: 0, currency, notes: "" })}
        fields={[
          { key: "name", label: "Name", type: "text" },
          { key: "monetary_value", label: "Value", type: "number" },
        ]}
      />
      <EntryRows
        title="Deductions"
        entries={deductions}
        onChange={setDeductions}
        newEntry={() => ({ name: "", amount: 0, currency, is_recurring: true, notes: "" })}
        fields={[
          { key: "name", label: "Name", type: "text" },
          { key: "amount", label: "Amount", type: "number" },
        ]}
      />

      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !baseSalary || !effectiveDate}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function EntryRows<T extends Record<string, unknown>>({
  title,
  entries,
  onChange,
  newEntry,
  fields,
}: {
  title: string;
  entries: T[];
  onChange: (rows: T[]) => void;
  newEntry: () => T;
  fields: { key: string; label: string; type: "text" | "number" | "date" }[];
}) {
  function update(i: number, key: string, value: string) {
    onChange(entries.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-body-medium font-semibold text-neutral-800">
          {title} ({entries.length})
        </h4>
        <Button type="button" variant="secondary" onClick={() => onChange([...entries, newEntry()])}>
          + Add {title.toLowerCase()}
        </Button>
      </div>
      {entries.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 glass-card rounded-md p-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                type={f.type}
                className="w-32"
                value={String(row[f.key] ?? "")}
                onChange={(e) => update(i, f.key, e.target.value)}
              />
            </Field>
          ))}
          <button
            type="button"
            onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
            className="rounded-md p-2 text-neutral-500 hover:bg-danger-100 hover:text-danger-600"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// No employees<->projects link exists yet — Project Management's team
// picker runs on `people`, a separate table from HR's `employees`
// (CLAUDE.md §11a TODO: the employees/people dual-directory merge is
// deferred). Rather than fabricate assignments, this is an honest
// placeholder until that merge happens.
function ProjectsTab() {
  return (
    <Card>
      <p className="text-body text-neutral-600">
        Project assignments aren&apos;t linked yet — Project Management tracks people via a separate directory
        (see CLAUDE.md §11a). This tab will populate once the employee/people merge lands.
      </p>
    </Card>
  );
}

function ActivityTab({ employeeId, orgId }: { employeeId: string; orgId: string }) {
  const [leave, setLeave] = useState<{ id: string; startDate: string; endDate: string; status: string; totalDays: number }[]>([]);
  const [attendance, setAttendance] = useState<{ id: string; workDate: string; checkInTime: string | null; checkOutTime: string | null; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/leave/employee/${employeeId}?org_id=${orgId}`).then((r) => r.ok ? r.json() : { data: [] }),
      fetch(`/api/attendance/employee/${employeeId}?org_id=${orgId}&limit=10`).then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([lb, ab]) => {
      setLeave(Array.isArray(lb.data) ? lb.data : []);
      setAttendance(Array.isArray(ab.data) ? ab.data : []);
    }).finally(() => setLoading(false));
  }, [employeeId, orgId]);

  if (loading) return <SectionSkeleton variant="text" />;

  const events = [
    ...(Array.isArray(leave) ? leave : []).map((l) => ({ id: l.id, date: l.startDate, label: `Leave ${l.status} — ${l.startDate}${l.startDate !== l.endDate ? ` to ${l.endDate}` : ""} (${l.totalDays}d)` })),
    ...(Array.isArray(attendance) ? attendance : []).slice(0, 10).map((a) => ({ id: a.id, date: a.workDate, label: `${a.status === "present" ? "Checked in" : a.status} — ${a.workDate}${a.checkInTime ? ` at ${a.checkInTime}` : ""}` })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card>
      {events.length === 0 ? (
        <p className="text-body text-neutral-600">No recent activity recorded for this employee.</p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {events.map((e) => (
            <li key={e.id} className="py-2.5 text-body text-neutral-800">{e.label}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AiInsightsTab({ employee }: { employee: Employee }) {
  const workloadAI = useAiCall<{ summary: string; utilization_pct: number }>("Analyst", "workload_summary_for_person");
  const skillAI = useAiCall<{ matches: { project: string; reasoning: string }[]; reasoning: string }>("Analyst", "skill_matched_projects");
  const careerAI = useAiCall<{ suggestion: string; reasoning: string }>("Analyst", "suggest_career_growth");
  const [kept, setKept] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-neutral-950">Workload summary</h3>
          <AiButton label="AI: Analyze workload" loading={workloadAI.loading} onClick={() => workloadAI.run({ name: employee.fullName, available_hours_per_week: employee.availableHoursPerWeek })} />
        </div>
        {workloadAI.result && !kept.workload && (
          <AiSuggestionCard onAccept={() => setKept((k) => ({ ...k, workload: true }))} onReject={() => workloadAI.setResult(null)}>
            <p className="text-body text-neutral-800">{workloadAI.result.summary}</p>
          </AiSuggestionCard>
        )}
        {kept.workload && workloadAI.result && <p className="text-body text-neutral-800">{workloadAI.result.summary}</p>}
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-neutral-950">Skill-matched projects</h3>
          <AiButton label="AI: Find matches" loading={skillAI.loading} onClick={() => skillAI.run({ skills: employee.skills })} />
        </div>
        {skillAI.result && !kept.skills && (
          <AiSuggestionCard reasoning={skillAI.result.reasoning} onAccept={() => setKept((k) => ({ ...k, skills: true }))} onReject={() => skillAI.setResult(null)}>
            {skillAI.result.matches.length === 0 ? (
              <p className="text-body text-neutral-600">No matches found.</p>
            ) : (
              <ul className="text-small text-neutral-800">
                {skillAI.result.matches.map((m) => (
                  <li key={m.project}>{m.project} — {m.reasoning}</li>
                ))}
              </ul>
            )}
          </AiSuggestionCard>
        )}
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-neutral-950">Suggested growth path</h3>
          <AiButton label="AI: Suggest growth path" loading={careerAI.loading} onClick={() => careerAI.run({ job_title: employee.jobTitle })} />
        </div>
        {careerAI.result && !kept.career && (
          <AiSuggestionCard reasoning={careerAI.result.reasoning} onAccept={() => setKept((k) => ({ ...k, career: true }))} onReject={() => careerAI.setResult(null)}>
            <p className="text-body text-neutral-800">{careerAI.result.suggestion}</p>
          </AiSuggestionCard>
        )}
      </Card>
    </div>
  );
}

function AttendanceTab({
  employee,
  orgId,
  can,
}: {
  employee: Employee;
  orgId: string;
  can: (r: ResourceType, a: PermissionAction) => boolean;
}) {
  const canEditAny = can("attendance", "edit_any");
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<{ attendance_rate_percent: number; avg_hours_per_day: number; late_arrivals_this_week: number; on_time_rate: number } | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const patternAI = useAiCall<{ summary: string; reasoning: string }>("Analyst", "analyze_attendance_pattern");

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/attendance/settings?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/attendance/employee/${employee.id}`).then((r) => r.json()),
      // Same calculation logic as My Attendance (scope=me) and Team Today's
      // per-row math — one implementation in the stats route, not
      // reimplemented per screen, so the three views can't drift apart.
      fetch(`/api/attendance/stats?org_id=${orgId}&scope=employee&employee_id=${employee.id}`).then((r) => r.json()),
    ])
      .then(([settingsBody, historyBody, statsBody]) => {
        if (historyBody.error) throw new Error(historyBody.error);
        if (statsBody.error) throw new Error(statsBody.error);
        setSettings(settingsBody.data ?? null);
        setHistory(historyBody.data ?? []);
        setStats(statsBody.data ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load attendance"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [employee.id, orgId]);

  if (loading || !settings) return <SectionSkeleton variant="text" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <AiButton
          label="AI: Analyze pattern"
          loading={patternAI.loading}
          onClick={() => patternAI.run({ name: employee.fullName, avg_hours_per_day: stats?.avg_hours_per_day, on_time_rate: stats?.on_time_rate })}
        />
        {canEditAny && <Button variant="secondary" onClick={() => setShowManual(true)}>Add Manual Entry</Button>}
      </div>

      {patternAI.result && (
        <AiSuggestionCard reasoning={patternAI.result.reasoning} onAccept={() => patternAI.setResult(null)} onReject={() => patternAI.setResult(null)}>
          <p className="text-body text-neutral-800">{patternAI.result.summary}</p>
        </AiSuggestionCard>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card padding="sm">
          <p className="text-small text-neutral-600">Attendance rate</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.attendance_rate_percent ?? 0}%</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Avg hours/day</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.avg_hours_per_day ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Late arrivals this week</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.late_arrivals_this_week ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">On-time rate</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.on_time_rate ?? 0}%</p>
        </Card>
      </div>

      <Card>
        <AttendanceCalendar month={month} onMonthChange={setMonth} records={history} settings={settings} employmentStartDate={employee.startDate} />
      </Card>

      <AttendanceHistoryList history={history} settings={settings} />

      {showManual && (
        <ManualEntryModal orgId={orgId} employeeId={employee.id} onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); load(); }} />
      )}
    </div>
  );
}

const LEAVE_STATUS_COLOR: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

function LeaveTab({
  employee,
  orgId,
  can,
}: {
  employee: Employee;
  orgId: string;
  can: (r: ResourceType, a: PermissionAction) => boolean;
}) {
  const canManageBalances = can("leave", "manage_balances");
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/leave/employee/${employee.id}`).then((r) => r.json()),
      fetch(`/api/leave/types?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([result, typesBody]) => {
        if (result.error) throw new Error(result.error);
        setBalances(result.data?.balances ?? []);
        setRequests(result.data?.requests ?? []);
        setTypes(typesBody.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leave"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [employee.id, orgId]);

  if (loading) return <SectionSkeleton variant="text" />;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      {canManageBalances && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setShowAdjust(true)}>
            Adjust Balance
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map(({ leave_type, balance }) => {
          const allotted = balance ? balance.allottedDays + balance.carriedForwardDays : 0;
          const remaining = balance ? allotted - balance.usedDays - balance.pendingDays : 0;
          return (
            <Card key={leave_type.id} padding="sm" className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: leave_type.color }} />
                <p className="text-body-medium font-semibold text-neutral-950">{leave_type.name}</p>
              </div>
              {leave_type.isPaid ? (
                <>
                  <p className="text-display font-semibold text-neutral-950">{remaining}</p>
                  <p className="text-caption text-neutral-600">
                    of {allotted} · {balance?.usedDays ?? 0} used, {balance?.pendingDays ?? 0} pending
                  </p>
                </>
              ) : (
                <p className="text-caption text-neutral-600">Unpaid — no ceiling</p>
              )}
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Request history</h2>
        {requests.length === 0 ? (
          <p className="text-body text-neutral-600">No leave requests yet.</p>
        ) : (
          <Card padding="sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const type = balances.find((b) => b.leave_type.id === r.leaveTypeId)?.leave_type;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {type ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} />
                            {type.name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {r.startDate} {r.startDate !== r.endDate && `→ ${r.endDate}`}
                      </TableCell>
                      <TableCell className="text-neutral-600">{r.totalDays}</TableCell>
                      <TableCell>
                        <Badge color={LEAVE_STATUS_COLOR[r.status] ?? "neutral"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-neutral-600">{r.reason ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {showAdjust && (
        <AdjustBalanceModal orgId={orgId} employeeId={employee.id} types={types} onClose={() => setShowAdjust(false)} onSaved={() => { setShowAdjust(false); load(); }} />
      )}
    </div>
  );
}

function AdjustBalanceModal({
  orgId,
  employeeId,
  types,
  onClose,
  onSaved,
}: {
  orgId: string;
  employeeId: string;
  types: LeaveType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !adjustment || !reason.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/leave/balances/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, employee_id: employeeId, leave_type_id: leaveTypeId, year: Number(year), adjustment_days: Number(adjustment), reason }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to adjust balance");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" onClick={onClose}>
      <div className="glass w-full max-w-sm rounded-lg p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-h3 font-semibold text-neutral-950">Adjust balance</h3>
          {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
          <Field label="Leave type">
            <Select className="w-full" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <Input type="number" className="w-full" value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <Field label="Adjustment (+/- days)">
              <Input type="number" className="w-full" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
            </Field>
          </div>
          <Field label="Reason">
            <Input className="w-full" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !adjustment || !reason.trim()}>
              {saving ? "Applying…" : "Apply Adjustment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
