"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CANDIDATE_STAGES, JOB_POSTING_STATUSES, type JobPosting, type Candidate } from "../page";

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};
const RECOMMENDATIONS = ["strong_yes", "yes", "no", "strong_no"] as const;
type Interview = {
  id: string;
  candidateId: string;
  interviewerId: string | null;
  scheduledAt: string | null;
  interviewType: "video" | "phone" | "in_person";
  status: string;
  feedback: string | null;
  recommendation: string | null;
};
type Employee = { id: string; fullName: string };

export default function JobDetailPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canCreateJob = can("recruitment", "create_job");
  const canManageCandidates = can("recruitment", "manage_candidates");
  const [job, setJob] = useState<JobPosting | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [editingJob, setEditingJob] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/recruitment/jobs?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/recruitment/candidates?org_id=${selectedOrgId}&job_posting_id=${job_id}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ]).then(([jobsBody, candBody, empBody]) => {
      setJob((jobsBody.data ?? []).find((j: JobPosting) => j.id === job_id) ?? null);
      setCandidates(candBody.data ?? []);
      setEmployees(empBody.data ?? []);
      setLoading(false);
    });
  }
  useEffect(() => {
    if (selectedOrgId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, job_id]);

  async function moveStage(candidateId: string, stage: string) {
    setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, stage: stage as Candidate["stage"] } : c)));
    await fetch(`/api/recruitment/candidates/${candidateId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
  }

  if (orgLoading || loading) return <PageSkeleton variant="kanban" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!job) return <p className="text-body text-neutral-600">Job posting not found.</p>;

  return (
    <div className="space-y-6">
      <JobHeader job={job} canEdit={canCreateJob} editing={editingJob} onEdit={setEditingJob} onSaved={load} employees={employees} />

      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-neutral-950">Pipeline</h2>
        {canManageCandidates && <Button onClick={() => setShowAddCandidate(true)}>+ Add Candidate</Button>}
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-3 lg:grid-cols-6">
        {CANDIDATE_STAGES.map((stage) => (
          <div
            key={stage}
            className="min-h-[10rem] rounded-md border border-neutral-300 bg-neutral-100 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) moveStage(id, stage);
            }}
          >
            <p className="mb-2 text-caption font-semibold uppercase text-neutral-600">{STAGE_LABEL[stage]}</p>
            <div className="space-y-2">
              {candidates.filter((c) => c.stage === stage).map((c) => (
                <div
                  key={c.id}
                  draggable={canManageCandidates}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  onClick={() => setSelectedCandidate(c)}
                  className="cursor-pointer rounded-sm border border-neutral-300 bg-neutral-50 p-2 text-body shadow-sm hover:shadow-md"
                >
                  <p className="font-medium text-neutral-950">{c.fullName}</p>
                  <p className="text-caption text-neutral-500">{c.rating ? `${c.rating}/5` : "Not rated"}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAddCandidate && (
        <AddCandidateModal
          orgId={selectedOrgId}
          jobPostingId={job.id}
          onClose={() => setShowAddCandidate(false)}
          onSaved={() => { setShowAddCandidate(false); load(); }}
        />
      )}

      {selectedCandidate && (
        <CandidateDetailModal
          orgId={selectedOrgId}
          candidate={selectedCandidate}
          job={job}
          employees={employees}
          canManageCandidates={canManageCandidates}
          canScheduleInterview={can("recruitment", "schedule_interview")}
          canSubmitFeedback={can("recruitment", "submit_feedback")}
          onClose={() => setSelectedCandidate(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function JobHeader({ job, canEdit, editing, onEdit, onSaved, employees }: { job: JobPosting; canEdit: boolean; editing: boolean; onEdit: (v: boolean) => void; onSaved: () => void; employees: Employee[] }) {
  const [title, setTitle] = useState(job.title);
  const [status, setStatus] = useState(job.status);
  const [description, setDescription] = useState(job.description ?? "");
  const [requirements, setRequirements] = useState(job.requirements ?? "");
  const [salaryMin, setSalaryMin] = useState(job.salaryRangeMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(job.salaryRangeMax?.toString() ?? "");
  const [hiringManagerId, setHiringManagerId] = useState(job.hiringManagerId ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/recruitment/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        status,
        description,
        requirements,
        salary_range_min: salaryMin ? Number(salaryMin) : null,
        salary_range_max: salaryMax ? Number(salaryMax) : null,
        hiring_manager_id: hiringManagerId || null,
      }),
    });
    setSaving(false);
    onEdit(false);
    onSaved();
  }

  if (!editing) {
    return (
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-display font-semibold text-neutral-950">{job.title}</h1>
          <div className="flex items-center gap-2">
            <Badge color={job.status === "open" ? "success" : job.status === "filled" ? "info" : job.status === "on_hold" ? "warning" : "neutral"}>{job.status.replace(/_/g, " ")}</Badge>
            {canEdit && <Button variant="secondary" onClick={() => onEdit(true)}>Edit</Button>}
          </div>
        </div>
        <p className="text-body text-neutral-600">{job.employmentType.replace(/_/g, " ")} {job.location ? `· ${job.location}` : ""}</p>
        {(job.salaryRangeMin || job.salaryRangeMax) && (
          <p className="text-body text-neutral-600">{job.currency} {job.salaryRangeMin ?? "?"} – {job.salaryRangeMax ?? "?"}</p>
        )}
        <p className="text-body text-neutral-600">Hiring manager: {employees.find((e) => e.id === job.hiringManagerId)?.fullName ?? "—"}</p>
        {job.description && <p className="text-body text-neutral-700">{job.description}</p>}
        {job.requirements && <p className="whitespace-pre-line text-body text-neutral-700">{job.requirements}</p>}
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <Field label="Title"><Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Status">
        <Select className="w-full" value={status} onChange={(e) => setStatus(e.target.value as JobPosting["status"])}>
          {JOB_POSTING_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Hiring manager">
        <Select className="w-full" value={hiringManagerId} onChange={(e) => setHiringManagerId(e.target.value)}>
          <option value="">None</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.fullName}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Salary min"><Input type="number" className="w-full" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} /></Field>
        <Field label="Salary max"><Input type="number" className="w-full" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} /></Field>
      </div>
      <Field label="Description"><Textarea className="w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Requirements"><Textarea className="w-full" rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
        <Button variant="secondary" onClick={() => onEdit(false)}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

function AddCandidateModal({ orgId, jobPostingId, onClose, onSaved }: { orgId: string; jobPostingId: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/recruitment/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, job_posting_id: jobPostingId, full_name: fullName, email, phone: phone || undefined, resume_url: resumeUrl || undefined, source: source || undefined }),
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
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">Add candidate</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Full name"><Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus /></Field>
        <Field label="Email"><Input type="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Phone"><Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Resume URL"><Input className="w-full" value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} /></Field>
        <Field label="Source"><Input className="w-full" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. LinkedIn" /></Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !fullName.trim() || !email.trim()}>{saving ? "Saving…" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CandidateDetailModal({
  orgId,
  candidate,
  job,
  employees,
  canManageCandidates,
  canScheduleInterview,
  canSubmitFeedback,
  onClose,
  onChanged,
}: {
  orgId: string;
  candidate: Candidate;
  job: JobPosting;
  employees: Employee[];
  canManageCandidates: boolean;
  canScheduleInterview: boolean;
  canSubmitFeedback: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(candidate.rating?.toString() ?? "");
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summarizeAI = useAiCall<{ summary: string; reasoning: string }>("Analyst", "summarize_candidate");

  function loadInterviews() {
    fetch(`/api/recruitment/interviews?org_id=${orgId}&candidate_id=${candidate.id}`)
      .then((r) => r.json())
      .then((b) => setInterviews(b.data ?? []));
  }
  useEffect(loadInterviews, [orgId, candidate.id]);

  async function saveRatingNotes() {
    await fetch(`/api/recruitment/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: rating ? Number(rating) : null, notes }),
    });
    onChanged();
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/recruitment/candidates/${candidate.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || undefined }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to reject");
      return;
    }
    setShowReject(false);
    onChanged();
    onClose();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-neutral-950">{candidate.fullName}</h3>
          <Badge color={candidate.stage === "hired" ? "success" : candidate.stage === "rejected" ? "danger" : "neutral"}>{candidate.stage}</Badge>
        </div>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <p className="text-body text-neutral-600">{candidate.email}</p>

        <AiButton label="Summarize candidate" loading={summarizeAI.loading} onClick={() => summarizeAI.run({ name: candidate.fullName, stage: candidate.stage, rating: candidate.rating ?? 0 })} />
        {summarizeAI.result && (
          <AiSuggestionCard reasoning={summarizeAI.result.reasoning} onAccept={() => summarizeAI.setResult(null)} onReject={() => summarizeAI.setResult(null)}>
            <p className="text-body text-neutral-700">{summarizeAI.result.summary}</p>
          </AiSuggestionCard>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rating (1-5)"><Input type="number" min={1} max={5} className="w-full" value={rating} onChange={(e) => setRating(e.target.value)} onBlur={saveRatingNotes} /></Field>
        </div>
        <Field label="Notes"><Textarea className="w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveRatingNotes} /></Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-body-medium font-semibold text-neutral-950">Interviews</p>
            {canScheduleInterview && <Button variant="secondary" onClick={() => setShowSchedule(true)}>Schedule Interview</Button>}
          </div>
          <div className="space-y-2">
            {interviews.map((iv) => (
              <InterviewRow key={iv.id} interview={iv} employees={employees} canSubmitFeedback={canSubmitFeedback} onChanged={loadInterviews} />
            ))}
            {interviews.length === 0 && <p className="text-body text-neutral-500">No interviews scheduled.</p>}
          </div>
        </div>

        {canManageCandidates && candidate.stage !== "rejected" && (
          <div className="border-t border-neutral-200 pt-3">
            {showReject ? (
              <form onSubmit={handleReject} className="space-y-2">
                <Field label="Rejection reason"><Textarea className="w-full" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowReject(false)}>Cancel</Button>
                  <Button type="submit" variant="danger">Confirm Reject</Button>
                </div>
              </form>
            ) : (
              <Button variant="danger" onClick={() => setShowReject(true)}>Reject</Button>
            )}
          </div>
        )}
      </div>

      {showSchedule && (
        <ScheduleInterviewModal
          orgId={orgId}
          candidateId={candidate.id}
          jobTitle={job.title}
          employees={employees}
          onClose={() => setShowSchedule(false)}
          onSaved={() => { setShowSchedule(false); loadInterviews(); }}
        />
      )}
    </Modal>
  );
}

function InterviewRow({ interview, employees, canSubmitFeedback, onChanged }: { interview: Interview; employees: Employee[]; canSubmitFeedback: boolean; onChanged: () => void }) {
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [recommendation, setRecommendation] = useState(interview.recommendation ?? "yes");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/recruitment/interviews/${interview.id}/feedback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback, recommendation }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(res.status === 403 ? "Only the assigned interviewer can submit feedback for this interview." : body.error ?? "Failed to submit feedback");
      return;
    }
    setShowForm(false);
    onChanged();
  }

  return (
    <div className="rounded-md border border-neutral-200 p-2 text-body">
      <p className="font-medium text-neutral-950">{employees.find((e) => e.id === interview.interviewerId)?.fullName ?? "Unassigned"} · {interview.interviewType.replace(/_/g, " ")}</p>
      <p className="text-caption text-neutral-500">{interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : "Not scheduled"} · {interview.status}</p>
      {interview.feedback ? (
        <p className="mt-1 text-body text-neutral-700">{interview.feedback} ({interview.recommendation})</p>
      ) : canSubmitFeedback ? (
        showForm ? (
          <form onSubmit={submitFeedback} className="mt-2 space-y-2">
            {error && <p className="text-caption text-danger-600">{error}</p>}
            <Textarea className="w-full" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback" />
            <Select className="w-full" value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>
              {RECOMMENDATIONS.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Submit feedback</Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setShowForm(true)}>Add feedback</Button>
        )
      ) : null}
    </div>
  );
}

function ScheduleInterviewModal({ orgId, candidateId, jobTitle, employees, onClose, onSaved }: { orgId: string; candidateId: string; jobTitle: string; employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const [interviewerId, setInterviewerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [interviewType, setInterviewType] = useState("video");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestAI = useAiCall<{ questions: string[]; reasoning: string }>("Planner", "suggest_interview_questions");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/recruitment/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, candidate_id: candidateId, interviewer_id: interviewerId || undefined, scheduled_at: scheduledAt || undefined, interview_type: interviewType }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to schedule");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">Schedule interview</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <AiButton label="Suggest interview questions" loading={suggestAI.loading} onClick={() => suggestAI.run({ job_title: jobTitle })} />
        {suggestAI.result && (
          <AiSuggestionCard reasoning={suggestAI.result.reasoning} onAccept={() => suggestAI.setResult(null)} onReject={() => suggestAI.setResult(null)}>
            <ul className="list-disc pl-4 text-body text-neutral-700">
              {suggestAI.result.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </AiSuggestionCard>
        )}
        <Field label="Interviewer">
          <Select className="w-full" value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </Field>
        <Field label="Scheduled at"><Input type="datetime-local" className="w-full" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></Field>
        <Field label="Type">
          <Select className="w-full" value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
            <option value="video">Video</option>
            <option value="phone">Phone</option>
            <option value="in_person">In person</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Scheduling…" : "Schedule"}</Button>
        </div>
      </form>
    </Modal>
  );
}
