"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/ui/Pagination";

export type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  contentType: "link" | "video" | "document" | "external";
  contentUrl: string | null;
  durationMinutes: number | null;
  requiredForRoles: string[];
  isActive: boolean;
};
export type Enrollment = {
  id: string;
  courseId: string;
  employeeId: string;
  status: "enrolled" | "in_progress" | "completed";
  progressPercent: number;
};
type Employee = { id: string; fullName: string; jobTitle?: string | null };

const TABS = ["Course Catalog", "My Learning", "Progress Overview"] as const;
type Tab = (typeof TABS)[number];

const STATUS_COLOR: Record<string, "neutral" | "info" | "success"> = { enrolled: "neutral", in_progress: "info", completed: "success" };

export type CatalogInitialData = { courses: Course[]; enrollments: Enrollment[] };

export function TrainingPageClient({ initialCatalog }: { initialCatalog?: CatalogInitialData }) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("training", "manage");
  const canViewAll = can("training", "view_all_progress");
  const [tab, setTab] = useState<Tab>("Course Catalog");
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleTabs = TABS.filter((t) => t !== "Progress Overview" || canViewAll);

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Learning &amp; Training</h1>
        <p className="mt-1 text-body text-neutral-600">Browse courses, track your learning, and manage the catalog</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Course Catalog" && (
        <CatalogTab orgId={selectedOrgId} canManage={canManage} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} initial={initialCatalog} />
      )}
      {tab === "My Learning" && <MyLearningTab orgId={selectedOrgId} refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />}
      {tab === "Progress Overview" && canViewAll && <ProgressOverviewTab orgId={selectedOrgId} />}
    </div>
  );
}

function CatalogTab({
  orgId,
  canManage,
  refreshKey,
  onChanged,
  initial,
}: {
  orgId: string;
  canManage: boolean;
  refreshKey: number;
  onChanged: () => void;
  initial?: CatalogInitialData;
}) {
  const [courses, setCourses] = useState<Course[]>(initial?.courses ?? []);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initial?.enrollments ?? []);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/training/courses?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/training/my-enrollments?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([c, e]) => {
        setCourses(c.data ?? []);
        setEnrollments(e.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  const skippedInitialLoad = useRef(!!initial);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, refreshKey]);

  async function enroll(courseId: string) {
    await fetch("/api/training/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, course_id: courseId }),
    });
    load();
    onChanged();
  }

  const categories = Array.from(new Set(courses.map((c) => c.category).filter(Boolean))) as string[];
  const filtered = courses.filter((c) => !categoryFilter || c.category === categoryFilter);

  if (loading) return <SectionSkeleton variant="cards" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Category">
          <Select className="w-48" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {canManage && <Button onClick={() => setShowNew(true)}>+ New Course</Button>}
      </div>
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No courses</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const enrollment = enrollments.find((e) => e.courseId === c.id);
            return (
              <Card key={c.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body-medium font-semibold text-neutral-950">{c.title}</p>
                  {enrollment && <Badge color={STATUS_COLOR[enrollment.status]}>{enrollment.status.replace(/_/g, " ")}</Badge>}
                </div>
                {c.description && <p className="text-body text-neutral-600">{c.description}</p>}
                <p className="text-caption text-neutral-500">
                  {c.category ?? "General"} · {c.contentType} {c.durationMinutes ? `· ${c.durationMinutes} min` : ""}
                </p>
                {enrollment ? (
                  enrollment.status === "completed" ? (
                    <Badge color="success">Completed</Badge>
                  ) : (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
                        <div className="h-full bg-success-600" style={{ width: `${enrollment.progressPercent}%` }} />
                      </div>
                      <p className="text-caption text-neutral-500">{enrollment.progressPercent}% complete</p>
                    </div>
                  )
                ) : (
                  <Button variant="secondary" onClick={() => enroll(c.id)}>Enroll</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {showNew && (
        <NewCourseModal
          orgId={orgId}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function NewCourseModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [contentType, setContentType] = useState("link");
  const [contentUrl, setContentUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [requiredForRoles, setRequiredForRoles] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outlineAI = useAiCall<{ description: string; category: string; duration_minutes: number }>("Writer", "generate_course_outline");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/training/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        title,
        description: description || undefined,
        category: category || undefined,
        content_type: contentType,
        content_url: contentUrl || undefined,
        duration_minutes: durationMinutes ? Number(durationMinutes) : undefined,
        required_for_roles: requiredForRoles
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
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
    <Modal onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">New course</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Title">
          <Input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <AiButton label="Generate outline" loading={outlineAI.loading} onClick={() => outlineAI.run({ title })} />
        {outlineAI.result && (
          <AiSuggestionCard
            onAccept={() => {
              setDescription(outlineAI.result!.description);
              setCategory(outlineAI.result!.category);
              setDurationMinutes(String(outlineAI.result!.duration_minutes));
              outlineAI.setResult(null);
            }}
            onReject={() => outlineAI.setResult(null)}
          >
            <p className="text-body text-neutral-700">{outlineAI.result.description}</p>
            <p className="text-caption text-neutral-500">{outlineAI.result.category} · {outlineAI.result.duration_minutes} min</p>
          </AiSuggestionCard>
        )}
        <Field label="Description">
          <Textarea className="w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Category">
          <Input className="w-full" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="Content type">
          <Select className="w-full" value={contentType} onChange={(e) => setContentType(e.target.value)}>
            {["link", "video", "document", "external"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Content URL">
          <Input className="w-full" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} />
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" className="w-full" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </Field>
        <Field label="Required for roles (comma-separated)">
          <Input className="w-full" value={requiredForRoles} onChange={(e) => setRequiredForRoles(e.target.value)} placeholder="e.g. engineer, manager" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !title.trim()}>{saving ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MyLearningTab({ orgId, refreshKey, onChanged }: { orgId: string; refreshKey: number; onChanged: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [ownEmployee, setOwnEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const recommendAI = useAiCall<{ courses: string[]; reasoning: string }>("Analyst", "recommend_courses_for_employee");

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/training/courses?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/training/my-enrollments?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}&mine=true`).then((r) => r.json()),
    ])
      .then(([c, e, m]) => {
        setCourses(c.data ?? []);
        setEnrollments(e.data ?? []);
        setOwnEmployee(m.data?.[0] ?? null);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId, refreshKey]);

  async function updateEnrollment(id: string, fields: Record<string, unknown>) {
    await fetch(`/api/training/enrollments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    load();
    onChanged();
  }

  if (loading) return <SectionSkeleton variant="list" />;
  if (enrollments.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No enrollments yet</EmptyTitle>
          <EmptyDescription>Enroll in a course from the catalog to see your progress here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const enrolledTitles = enrollments.map((e) => courses.find((c) => c.id === e.courseId)?.title).filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <AiButton
        label="Recommend courses"
        loading={recommendAI.loading}
        onClick={() => recommendAI.run({ job_title: ownEmployee?.jobTitle ?? "", enrolled_course_titles: enrolledTitles })}
      />
      {recommendAI.result && (
        <AiSuggestionCard reasoning={recommendAI.result.reasoning} onAccept={() => recommendAI.setResult(null)} onReject={() => recommendAI.setResult(null)}>
          <ul className="list-disc pl-4 text-body text-neutral-700">
            {recommendAI.result.courses.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </AiSuggestionCard>
      )}
      <div className="space-y-3">
        {enrollments.map((e) => {
          const course = courses.find((c) => c.id === e.courseId);
          return (
            <Card key={e.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-medium font-semibold text-neutral-950">{course?.title ?? "—"}</p>
                <Badge color={STATUS_COLOR[e.status]}>{e.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="h-1.5 w-full bar-track overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full bg-success-600" style={{ width: `${e.progressPercent}%` }} />
              </div>
              <p className="text-caption text-neutral-500">{e.progressPercent}% complete</p>
              {e.status !== "completed" && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => updateEnrollment(e.id, { progress_percent: Math.min(100, e.progressPercent + 25), status: "in_progress" })}
                  >
                    +25% progress
                  </Button>
                  <Button onClick={() => updateEnrollment(e.id, { status: "completed", progress_percent: 100 })}>Mark complete</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ProgressOverviewTab({ orgId }: { orgId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/training/progress?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([p, e]) => {
        setCourses(p.data?.courses ?? []);
        setEnrollments(p.data?.enrollments ?? []);
        setEmployees(e.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  // Hoisted above the loading early return — hooks must run unconditionally
  // on every render (was previously called after it, breaking hook order).
  const { page, setPage, pageSize, total, paged: pagedEmployees } = usePagination(employees, 10);

  if (loading) return <SectionSkeleton variant="table" />;

  const requiredCourses = courses.filter((c) => c.requiredForRoles?.length > 0);
  if (requiredCourses.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No required courses configured</EmptyTitle>
          <EmptyDescription>Set &quot;Required for roles&quot; on a course to see the completion matrix here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-body">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-3 py-2 text-small font-medium text-neutral-600">Employee</th>
            {requiredCourses.map((c) => (
              <th key={c.id} className="px-3 py-2 text-small font-medium text-neutral-600">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagedEmployees.map((emp) => (
            <tr key={emp.id} className="border-b border-neutral-100">
              <td className="px-3 py-2.5 text-neutral-950">{emp.fullName}</td>
              {requiredCourses.map((c) => {
                const isRequired = c.requiredForRoles?.some((r) => (emp.jobTitle ?? "").toLowerCase() === r.toLowerCase());
                const enrollment = enrollments.find((e) => e.courseId === c.id && e.employeeId === emp.id);
                const completed = enrollment?.status === "completed";
                return (
                  <td
                    key={c.id}
                    className={`px-3 py-2.5 text-center ${isRequired && !completed ? "bg-danger-100" : ""}`}
                  >
                    {!isRequired ? <span className="text-neutral-400">—</span> : completed ? <Badge color="success">Done</Badge> : <Badge color="danger">Missing</Badge>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}
