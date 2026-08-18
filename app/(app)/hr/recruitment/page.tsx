"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardLink } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/ui/Pagination";

// Schema-accurate enums (db/schema.ts) — lib/constants.ts's
// JOB_POSTING_STATUSES/CANDIDATE_STAGES predate Batch 3's real values.
export const JOB_POSTING_STATUSES = ["draft", "open", "on_hold", "closed", "filled"] as const;
export const CANDIDATE_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

export type JobPosting = {
  id: string;
  title: string;
  departmentId: string | null;
  employmentType: string;
  location: string | null;
  status: (typeof JOB_POSTING_STATUSES)[number];
  description: string | null;
  requirements: string | null;
  salaryRangeMin: number | null;
  salaryRangeMax: number | null;
  currency: string;
  hiringManagerId: string | null;
};
export type Candidate = {
  id: string;
  jobPostingId: string;
  fullName: string;
  email: string;
  stage: (typeof CANDIDATE_STAGES)[number];
  rating: number | null;
};
type Employee = { id: string; fullName: string };

const JOB_STATUS_COLOR: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  open: "success",
  on_hold: "warning",
  closed: "neutral",
  filled: "info",
};
const STAGE_COLOR: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  applied: "neutral",
  screening: "info",
  interview: "warning",
  offer: "info",
  hired: "success",
  rejected: "danger",
};

const TABS = ["Job Postings", "All Candidates"] as const;
type Tab = (typeof TABS)[number];

export default function RecruitmentPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canCreateJob = can("recruitment", "create_job");
  const [tab, setTab] = useState<Tab>("Job Postings");
  const [showNew, setShowNew] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">Recruitment / Hiring</h1>
          <p className="mt-1 text-body text-neutral-600">Job postings, candidate pipeline, and interviews</p>
        </div>
        {tab === "Job Postings" && canCreateJob && <Button onClick={() => setShowNew(true)}>+ New Job Posting</Button>}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-body-medium font-medium ${tab === t ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Job Postings" && <JobPostingsTab orgId={selectedOrgId} refreshKey={refreshKey} />}
      {tab === "All Candidates" && <AllCandidatesTab orgId={selectedOrgId} />}

      {showNew && (
        <NewJobModal
          orgId={selectedOrgId}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function JobPostingsTab({ orgId, refreshKey }: { orgId: string; refreshKey: number }) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/recruitment/jobs?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setJobs(b.data ?? []))
      .finally(() => setLoading(false));
  }, [orgId, refreshKey]);

  if (loading) return <SectionSkeleton variant="table" />;
  if (jobs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No job postings yet</EmptyTitle>
          <EmptyDescription>Create one to start building a candidate pipeline.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j) => (
        <CardLink key={j.id} href={`/hr/recruitment/${j.id}`} color={JOB_STATUS_COLOR[j.status]} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-medium font-semibold text-neutral-950">{j.title}</p>
            <Badge color={JOB_STATUS_COLOR[j.status] ?? "neutral"}>{j.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-small text-neutral-600">{j.employmentType.replace(/_/g, " ")} {j.location ? `· ${j.location}` : ""}</p>
        </CardLink>
      ))}
    </div>
  );
}

function AllCandidatesTab({ orgId }: { orgId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [jobFilter, setJobFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/recruitment/jobs?org_id=${orgId}`).then((r) => r.json()).then((b) => setJobs(b.data ?? []));
  }, [orgId]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ org_id: orgId });
    if (jobFilter) params.set("job_posting_id", jobFilter);
    if (stageFilter) params.set("stage", stageFilter);
    fetch(`/api/recruitment/candidates?${params}`)
      .then((r) => r.json())
      .then((b) => setCandidates(b.data ?? []))
      .finally(() => setLoading(false));
  }, [orgId, jobFilter, stageFilter]);

  const { page, setPage, pageSize, total, paged: pagedCandidates } = usePagination(candidates, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Field label="Job posting">
          <Select className="w-56" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="">All</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Stage">
          <Select className="w-40" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">All</option>
            {CANDIDATE_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
      {loading ? (
        <SectionSkeleton variant="table" />
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Job posting</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCandidates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <a href={`/hr/recruitment/${c.jobPostingId}`} className="font-medium text-neutral-950 hover:underline">{c.fullName}</a>
                  </TableCell>
                  <TableCell className="text-neutral-600">{c.email}</TableCell>
                  <TableCell><Badge color={STAGE_COLOR[c.stage] ?? "neutral"}>{c.stage}</Badge></TableCell>
                  <TableCell className="text-neutral-600">{jobs.find((j) => j.id === c.jobPostingId)?.title ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{c.rating ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}

function NewJobModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [status, setStatus] = useState("draft");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftAI = useAiCall<{ description: string; requirements: string }>("Writer", "draft_job_posting");

  useEffect(() => {
    fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()).then((b) => setEmployees(b.data ?? []));
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/recruitment/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        title,
        employment_type: employmentType,
        location: location || undefined,
        description: description || undefined,
        requirements: requirements || undefined,
        salary_range_min: salaryMin ? Number(salaryMin) : undefined,
        salary_range_max: salaryMax ? Number(salaryMax) : undefined,
        currency,
        hiring_manager_id: hiringManagerId || undefined,
        status,
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
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">New job posting</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Title">
            <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Department (free text)">
            <Input className="w-full" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
        </div>
        <AiButton label="Draft posting" loading={draftAI.loading} onClick={() => draftAI.run({ title, department })} />
        {draftAI.result && (
          <AiSuggestionCard
            onAccept={() => {
              setDescription(draftAI.result!.description);
              setRequirements(draftAI.result!.requirements);
              draftAI.setResult(null);
            }}
            onReject={() => draftAI.setResult(null)}
          >
            <p className="text-body text-neutral-700">{draftAI.result.description}</p>
          </AiSuggestionCard>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Employment type">
            <Select className="w-full" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </Select>
          </Field>
          <Field label="Location">
            <Input className="w-full" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea className="w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Requirements">
          <Textarea className="w-full" rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Salary min"><Input type="number" className="w-full" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} /></Field>
          <Field label="Salary max"><Input type="number" className="w-full" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} /></Field>
          <Field label="Currency"><Input className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Hiring manager">
            <Select className="w-full" value={hiringManagerId} onChange={(e) => setHiringManagerId(e.target.value)}>
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              {JOB_POSTING_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !title.trim()}>{saving ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
