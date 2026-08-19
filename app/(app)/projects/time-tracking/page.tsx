"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { KpiCard } from "@/components/ui/KpiCard";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";

type TimeEntry = {
  id: string;
  taskId: string | null;
  projectId: string;
  personId: string;
  date: string;
  hours: string;
  description: string | null;
  isBillable: boolean;
  personName: string | null;
  projectName: string | null;
  taskTitle: string | null;
  createdAt: string;
};
type Summary = {
  totalHours: string;
  billableHours: string;
  entryCount: number;
  byProject: { projectId: string; projectName: string | null; totalHours: string }[];
  byDate: { date: string; totalHours: string }[];
};
type Project = { id: string; name: string };
type Task = { id: string; title: string; projectId: string };
type Person = { id: string; fullName: string };
type Submission = {
  id: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  totalHours: string | null;
};

type Tab = "my" | "team";

function weekRange(offset: number) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function fmtDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDayShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtHours(h: string | number) {
  const n = typeof h === "string" ? parseFloat(h) : h;
  return isNaN(n) ? "0" : n.toFixed(1);
}

function isToday(iso: string) {
  return iso === new Date().toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-warning-100", text: "text-warning-700", label: "Timesheet unsubmitted" },
  submitted: { bg: "bg-info-100", text: "text-info-700", label: "Submitted for approval" },
  approved: { bg: "bg-success-100", text: "text-success-700", label: "Timesheet approved" },
  rejected: { bg: "bg-danger-100", text: "text-danger-600", label: "Timesheet rejected" },
};

export default function TimeTrackingPage() {
  const { selectedOrgId: orgId } = useOrg();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("my");
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [prefill, setPrefill] = useState<{ projectId?: string; date?: string } | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const weekDays = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const startDate = weekDays[0];
  const endDate = weekDays[6];

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const mine = tab === "my";
      const qs = `org_id=${orgId}&start_date=${startDate}&end_date=${endDate}${mine ? "&mine=true" : ""}`;
      const [entriesRes, summaryRes] = await Promise.all([
        fetch(`/api/time-entries?${qs}&limit=200`),
        fetch(`/api/time-entries/summary?${qs}`),
      ]);
      const ej = await entriesRes.json();
      const sj = await summaryRes.json();
      setEntries(ej.data ?? []);
      setSummary(sj.data ?? null);

      if (mine) {
        const subRes = await fetch(`/api/time-entries/submissions?org_id=${orgId}&week_start=${startDate}`);
        const subJ = await subRes.json();
        setSubmission(subJ.data ?? null);
      } else {
        setSubmission(null);
      }
    } catch {
      toast.show("Failed to load time entries", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, tab, startDate, endDate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/projects?org_id=${orgId}&limit=200`)
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
    fetch(`/api/team?org_id=${orgId}&limit=200`)
      .then((r) => r.json())
      .then((j) => setPeople(j.data ?? []));
  }, [orgId]);

  // --- Grid data: entries grouped by project, then by day ---
  const gridData = useMemo(() => {
    const projectMap: Record<string, { projectId: string; projectName: string; entries: Record<string, TimeEntry[]> }> = {};
    for (const e of entries) {
      if (!projectMap[e.projectId]) {
        projectMap[e.projectId] = { projectId: e.projectId, projectName: e.projectName ?? "Unknown", entries: {} };
      }
      if (!projectMap[e.projectId].entries[e.date]) {
        projectMap[e.projectId].entries[e.date] = [];
      }
      projectMap[e.projectId].entries[e.date].push(e);
    }
    return Object.values(projectMap);
  }, [entries]);

  const dailyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of weekDays) {
      map[d] = entries.filter((e) => e.date === d).reduce((s, e) => s + parseFloat(e.hours || "0"), 0);
    }
    return map;
  }, [entries, weekDays]);

  function openAddModal(prefillData?: { projectId?: string; date?: string }) {
    setPrefill(prefillData ?? null);
    setShowAdd(true);
  }

  async function handleSubmit() {
    if (!orgId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/time-entries/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, week_start: startDate }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.show(j.error ?? "Failed to submit", "error");
        return;
      }
      toast.show("Timesheet submitted for approval");
      setSubmission(j.data);
    } catch {
      toast.show("Failed to submit", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!orgId) return <PageSkeleton variant="table" />;

  const submissionStatus = submission?.status ?? "draft";
  const statusStyle = STATUS_STYLES[submissionStatus] ?? STATUS_STYLES.draft;
  const canEdit = submissionStatus === "draft" || submissionStatus === "rejected";
  const canSubmit = canEdit && entries.length > 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Time Tracking</h1>
          <p className="mt-1 text-body text-neutral-600">Log hours against tasks and projects</p>
        </div>
        {canEdit && <Button onClick={() => openAddModal()}>+ Log Time</Button>}
      </div>

      {/* Tabs + Week nav */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "my", label: "My Timesheet" },
            { value: "team", label: "Team Timesheet" },
          ]}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-sm px-2 py-1 text-small text-neutral-600 hover:bg-neutral-200"
          >
            &larr; Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-sm px-2 py-1 text-small font-medium text-primary-700 hover:bg-primary-100"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-sm px-2 py-1 text-small text-neutral-600 hover:bg-neutral-200"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Submission banner (My Timesheet only) */}
      {tab === "my" && !loading && (
        <div className={`flex items-center justify-between rounded-md px-4 py-2.5 ${statusStyle.bg}`}>
          <div className="flex items-center gap-2">
            <span className={`text-body-medium font-medium ${statusStyle.text}`}>
              {submissionStatus === "rejected" ? "ⓘ " : submissionStatus === "approved" ? "✓ " : "ⓘ "}
              {statusStyle.label}
            </span>
            {submissionStatus === "rejected" && submission?.rejectionReason && (
              <span className="text-small text-danger-600"> — {submission.rejectionReason}</span>
            )}
          </div>
          {canSubmit && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for Approval"}
            </Button>
          )}
        </div>
      )}

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard title="Total Hours" value={fmtHours(summary.totalHours)} pattern={3} tone="primary" />
          <KpiCard title="Billable Hours" value={fmtHours(summary.billableHours)} pattern={2} tone="success" />
          <KpiCard
            title="Non-Billable"
            value={fmtHours(parseFloat(summary.totalHours) - parseFloat(summary.billableHours))}
            pattern={1}
            tone="neutral"
          />
          <KpiCard title="Entries" value={String(summary.entryCount)} pattern={summary.entryCount} tone="info" />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <PageSkeleton variant="table" />
      ) : entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No time logged this week</EmptyTitle>
            <EmptyDescription>Click &ldquo;Log Time&rdquo; to add your first entry.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : tab === "team" ? (
        /* ── Team Timesheet: flat table ── */
        <div className="overflow-x-auto glass-table">
          <table className="w-full text-left text-body">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-100">
                <th className="px-4 py-2.5 text-small font-semibold text-neutral-600">Date</th>
                <th className="px-4 py-2.5 text-small font-semibold text-neutral-600">Team Member</th>
                <th className="px-4 py-2.5 text-small font-semibold text-neutral-600">Project</th>
                <th className="px-4 py-2.5 text-small font-semibold text-neutral-600">Task</th>
                <th className="px-4 py-2.5 text-small font-semibold text-neutral-600">Description</th>
                <th className="px-4 py-2.5 text-center text-small font-semibold text-neutral-600">Billable</th>
                <th className="px-4 py-2.5 text-right text-small font-semibold text-neutral-600">Hours</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-small text-neutral-600">{fmtDay(e.date)}</td>
                  <td className="px-4 py-2.5 text-body-medium font-medium text-neutral-950">{e.personName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-small text-neutral-700">{e.projectName ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-small text-neutral-700">{e.taskTitle ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-small text-neutral-500">{e.description ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    {e.isBillable ? (
                      <span className="inline-block rounded-sm bg-success-100 px-1.5 py-0.5 text-caption font-medium text-success-700">$</span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-heading text-body-medium font-medium text-neutral-800">{fmtHours(e.hours)}h</td>
                  <td className="px-2 py-2.5 text-center">
                    <button type="button" onClick={() => handleDelete(e.id)} className="text-danger-600 hover:text-danger-600/80" title="Delete entry">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                <td colSpan={6} className="px-4 py-2.5 text-body-medium font-semibold text-neutral-950">Week Total</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-heading text-body-medium font-semibold text-neutral-950">{fmtHours(summary?.totalHours ?? "0")}h</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ── My Timesheet: project × day grid ── */
        <div className="overflow-x-auto glass-table">
          <table className="w-full text-left text-body">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-100">
                <th className="min-w-[200px] px-4 py-2.5 text-small font-semibold text-neutral-600">Projects / Tasks</th>
                {weekDays.map((d) => (
                  <th
                    key={d}
                    className={`min-w-[80px] px-3 py-2.5 text-center text-small font-semibold ${isToday(d) ? "bg-primary-100 text-primary-700" : "text-neutral-600"}`}
                  >
                    <div>{fmtDayShort(d)}</div>
                    <div className="text-caption font-normal">{fmtDateShort(d)}</div>
                  </th>
                ))}
                <th className="min-w-[90px] px-3 py-2.5 text-center text-small font-semibold text-neutral-600">Week total</th>
                {canEdit && <th className="w-10 px-2 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {gridData.map((proj) => {
                const weekTotal = weekDays.reduce((s, d) => {
                  return s + (proj.entries[d] ?? []).reduce((a, e) => a + parseFloat(e.hours || "0"), 0);
                }, 0);
                return (
                  <tr key={proj.projectId} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="text-body-medium font-medium text-neutral-950">{proj.projectName}</p>
                      {/* Show task names if any */}
                      {(() => {
                        const taskNames = new Set<string>();
                        for (const dayEntries of Object.values(proj.entries)) {
                          for (const e of dayEntries) {
                            if (e.taskTitle) taskNames.add(e.taskTitle);
                          }
                        }
                        return taskNames.size > 0 ? (
                          <p className="mt-0.5 truncate text-small text-neutral-500">
                            {Array.from(taskNames).join(", ")}
                          </p>
                        ) : null;
                      })()}
                    </td>
                    {weekDays.map((d) => {
                      const dayEntries = proj.entries[d] ?? [];
                      const dayHours = dayEntries.reduce((s, e) => s + parseFloat(e.hours || "0"), 0);
                      return (
                        <td
                          key={d}
                          className={`px-3 py-3 text-center ${isToday(d) ? "bg-primary-50" : ""} ${canEdit ? "cursor-pointer hover:bg-primary-100/50" : ""}`}
                          onClick={canEdit ? () => openAddModal({ projectId: proj.projectId, date: d }) : undefined}
                          title={canEdit ? "Click to log time" : undefined}
                        >
                          {dayHours > 0 ? (
                            <span className="font-heading text-body-medium font-medium text-neutral-800">
                              {fmtHours(dayHours)}h
                            </span>
                          ) : canEdit ? (
                            <span className="text-neutral-200 hover:text-primary-400">+</span>
                          ) : (
                            <span className="text-neutral-200">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center font-heading text-body-medium font-semibold text-neutral-950">
                      {fmtHours(weekTotal)}h
                    </td>
                    {canEdit && (
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = Object.values(proj.entries).flat().map((e) => e.id);
                            if (allIds.length > 0 && confirm(`Delete all ${allIds.length} entries for ${proj.projectName} this week?`)) {
                              Promise.all(allIds.map((id) => fetch(`/api/time-entries/${id}?org_id=${orgId}`, { method: "DELETE" })))
                                .then(() => { toast.show("Deleted"); loadData(); });
                            }
                          }}
                          className="text-danger-600 hover:text-danger-600/80"
                          title="Delete all entries for this project"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                <td className="px-4 py-2.5 text-body-medium font-semibold text-neutral-950">Daily Total</td>
                {weekDays.map((d) => (
                  <td
                    key={d}
                    className={`px-3 py-2.5 text-center font-heading text-body-medium font-semibold ${isToday(d) ? "bg-primary-100 text-primary-700" : "text-neutral-950"}`}
                  >
                    {fmtHours(dailyTotals[d])}h
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center font-heading text-body-medium font-bold text-primary-700">
                  {fmtHours(summary?.totalHours ?? "0")}h
                </td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddTimeEntryModal
          orgId={orgId}
          projects={projects}
          people={people}
          isTeam={tab === "team"}
          prefill={prefill}
          onClose={() => { setShowAdd(false); setPrefill(null); }}
          onSaved={() => {
            setShowAdd(false);
            setPrefill(null);
            loadData();
          }}
        />
      )}
    </div>
  );

  async function handleDelete(id: string) {
    if (!confirm("Delete this time entry?")) return;
    try {
      const res = await fetch(`/api/time-entries/${id}?org_id=${orgId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        toast.show(j.error ?? "Failed to delete", "error");
        return;
      }
      loadData();
      toast.show("Deleted");
    } catch {
      toast.show("Failed to delete", "error");
    }
  }
}

function AddTimeEntryModal({
  orgId,
  projects,
  people,
  isTeam,
  prefill,
  onClose,
  onSaved,
}: {
  orgId: string;
  projects: Project[];
  people: Person[];
  isTeam: boolean;
  prefill?: { projectId?: string; date?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState(prefill?.projectId ?? "");
  const [taskId, setTaskId] = useState("");
  const [personId, setPersonId] = useState("");
  const [date, setDate] = useState(prefill?.date ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [isBillable, setIsBillable] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!startTime || !endTime) return;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin > 0) setHours((diffMin / 60).toFixed(2));
  }, [startTime, endTime]);

  useEffect(() => {
    if (!projectId || !orgId) { setTasks([]); return; }
    fetch(`/api/tasks?org_id=${orgId}&project_id=${projectId}&limit=200`)
      .then((r) => r.json())
      .then((j) => setTasks(j.data ?? []))
      .catch(() => setTasks([]));
  }, [projectId, orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !hours) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        org_id: orgId,
        project_id: projectId,
        task_id: taskId || null,
        date,
        hours: parseFloat(hours),
        description: description || null,
        is_billable: isBillable,
      };
      if (isTeam && personId) body.person_id = personId;

      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.show(j.error ?? "Failed to save", "error");
        return;
      }
      toast.show("Time logged");
      onSaved();
    } catch {
      toast.show("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 font-heading text-h2 font-semibold text-neutral-950">Log Time</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Project *">
          <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }}>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        {tasks.length > 0 && (
          <Field label="Task (optional)">
            <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No specific task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </Select>
          </Field>
        )}

        {isTeam && (
          <Field label="Team Member">
            <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Yourself</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date *">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Hours *">
            <Input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 2.5"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Time">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End Time">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        {startTime && endTime && <p className="text-body-small text-neutral-500 -mt-2">Hours auto-calculated from times</p>}

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What did you work on?"
          />
        </Field>

        <label className="flex items-center gap-2 text-body-medium text-neutral-800">
          <input
            type="checkbox"
            checked={isBillable}
            onChange={(e) => setIsBillable(e.target.checked)}
            className="h-4 w-4"
          />
          Billable
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !projectId || !hours}>
            {saving ? "Saving…" : "Log Time"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
