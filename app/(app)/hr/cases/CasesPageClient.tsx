"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/ui/Pagination";

type Category = { id: string; name: string; description: string | null; defaultAssigneeId: string | null; isActive: boolean };
export type HrCase = {
  id: string;
  employeeId: string;
  categoryId: string | null;
  subject: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_on_employee" | "resolved" | "closed";
  assignedTo: string | null;
  isConfidential: boolean;
  createdAt: string;
};
type Comment = { id: string; authorId: string; comment: string; isInternalNote: boolean; createdAt: string };
type Employee = { id: string; fullName: string };

const PRIORITY_COLOR: Record<string, "neutral" | "warning" | "danger"> = { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" };
const STATUS_COLOR: Record<string, "neutral" | "info" | "warning" | "success"> = {
  open: "neutral",
  in_progress: "info",
  waiting_on_employee: "warning",
  resolved: "success",
  closed: "neutral",
};

const TABS = ["My Cases", "All Cases", "Categories"] as const;
type Tab = (typeof TABS)[number];

export function CasesPageClient({ initialMyCases }: { initialMyCases?: HrCase[] }) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("hr_case", "manage");
  const [tab, setTab] = useState<Tab>("My Cases");
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleTabs = TABS.filter((t) => t === "My Cases" || canManage);

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">HR Cases &amp; Helpdesk</h1>
        <p className="mt-1 text-body text-neutral-600">Raise a case or manage employee cases</p>
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

      {tab === "My Cases" && (
        <MyCasesTab orgId={selectedOrgId} refreshKey={refreshKey} onOpen={setOpenCaseId} onChanged={() => setRefreshKey((k) => k + 1)} initial={initialMyCases} />
      )}
      {tab === "All Cases" && canManage && <AllCasesTab orgId={selectedOrgId} refreshKey={refreshKey} onOpen={setOpenCaseId} />}
      {tab === "Categories" && canManage && <CategoriesTab orgId={selectedOrgId} />}

      {openCaseId && (
        <CaseDetailModal
          caseId={openCaseId}
          orgId={selectedOrgId}
          canManage={canManage}
          onClose={() => setOpenCaseId(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function MyCasesTab({
  orgId,
  refreshKey,
  onOpen,
  onChanged,
  initial,
}: {
  orgId: string;
  refreshKey: number;
  onOpen: (id: string) => void;
  onChanged: () => void;
  initial?: HrCase[];
}) {
  const [rows, setRows] = useState<HrCase[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/hr-cases/my?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}>+ Raise a Case</Button>
      </div>
      {loading ? (
        <SectionSkeleton variant="table" />
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No cases raised</EmptyTitle>
            <EmptyDescription>Raise a case if you need HR&apos;s help with anything.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <Card key={c.id} padding="sm" color={STATUS_COLOR[c.status]}>
              <button className="w-full text-left" onClick={() => onOpen(c.id)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-medium font-medium text-neutral-950">{c.subject}</p>
                  <div className="flex gap-2">
                    <Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge>
                    <Badge color={STATUS_COLOR[c.status]}>{c.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
      {showNew && (
        <NewCaseModal
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

function NewCaseModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triageAI = useAiCall<{ category: string; priority: string; reasoning: string }>("Analyst", "suggest_case_triage");

  useEffect(() => {
    fetch(`/api/hr-cases/categories?org_id=${orgId}`).then((r) => r.json()).then((b) => setCategories(b.data ?? []));
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSaving(true);
    setError(null);
    const mine = await fetch(`/api/employees?org_id=${orgId}&mine=true`).then((r) => r.json());
    const ownEmployeeId: string | undefined = mine.data?.[0]?.id;
    const res = await fetch("/api/hr-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        employee_id: ownEmployeeId,
        subject,
        description,
        category_id: categoryId || undefined,
        priority,
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
        <h3 className="text-h3 font-semibold text-neutral-950">Raise a case</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Subject">
          <Input className="w-full" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea className="w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <AiButton
          label="Suggest category & priority"
          loading={triageAI.loading}
          onClick={() => triageAI.run({ subject, description })}
        />
        {triageAI.result && (
          <AiSuggestionCard
            reasoning={triageAI.result.reasoning}
            onAccept={() => {
              const match = categories.find((c) => c.name === triageAI.result!.category);
              if (match) setCategoryId(match.id);
              setPriority(triageAI.result!.priority);
              triageAI.setResult(null);
            }}
            onReject={() => triageAI.setResult(null)}
          >
            <p className="text-body text-neutral-700">
              {triageAI.result.category} · {triageAI.result.priority}
            </p>
          </AiSuggestionCard>
        )}
        <Field label="Category">
          <Select className="w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Unassigned</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select className="w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !subject.trim() || !description.trim()}>{saving ? "Saving…" : "Raise case"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AllCasesTab({ orgId, refreshKey, onOpen }: { orgId: string; refreshKey: number; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<HrCase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/hr-cases?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setRows(b.data ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId, refreshKey]);
  useEffect(() => {
    fetch(`/api/hr-cases/categories?org_id=${orgId}`).then((r) => r.json()).then((b) => setCategories(b.data ?? []));
  }, [orgId]);

  const filtered = rows.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!priorityFilter || r.priority === priorityFilter) &&
      (!categoryFilter || r.categoryId === categoryFilter),
  );

  const { page, setPage, pageSize, total, paged: pagedFiltered } = usePagination(filtered, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Field label="Status">
          <Select className="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {["open", "in_progress", "waiting_on_employee", "resolved", "closed"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select className="w-36" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All</option>
            {["low", "normal", "high", "urgent"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select className="w-48" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedFiltered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpen(c.id)}>
                  <TableCell>
                    {c.isConfidential && <span className="mr-1.5 inline-block text-neutral-500">&#128274;</span>}
                    {c.subject}
                  </TableCell>
                  <TableCell className="text-neutral-600">{categories.find((cat) => cat.id === c.categoryId)?.name ?? "—"}</TableCell>
                  <TableCell><Badge color={PRIORITY_COLOR[c.priority]}>{c.priority}</Badge></TableCell>
                  <TableCell><Badge color={STATUS_COLOR[c.status]}>{c.status.replace(/_/g, " ")}</Badge></TableCell>
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

function CategoriesTab({ orgId }: { orgId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const { page: catPage, setPage: setCatPage, pageSize: catPageSize, total: catTotal, paged: pagedCategories } = usePagination(categories, 10);

  function load() {
    fetch(`/api/hr-cases/categories?org_id=${orgId}`).then((r) => r.json()).then((b) => setCategories(b.data ?? []));
  }
  useEffect(load, [orgId]);
  useEffect(() => {
    fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()).then((b) => setEmployees(b.data ?? []));
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/hr-cases/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name, description: description || undefined, default_assignee_id: assigneeId || undefined }),
    });
    setSaving(false);
    setShowNew(false);
    setName("");
    setDescription("");
    setAssigneeId("");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew((v) => !v)}>{showNew ? "Cancel" : "+ New Category"}</Button>
      </div>
      {showNew && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Name">
              <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Description">
              <Textarea className="w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Default assignee">
              <Select className="w-full" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">None</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Create category"}</Button>
          </form>
        </Card>
      )}
      <Card padding="sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Default assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedCategories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="text-neutral-600">{c.description ?? "—"}</TableCell>
                <TableCell className="text-neutral-600">{employees.find((e) => e.id === c.defaultAssigneeId)?.fullName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={catPage} pageSize={catPageSize} total={catTotal} onPageChange={setCatPage} />
      </Card>
    </div>
  );
}

function CaseDetailModal({
  caseId,
  orgId,
  canManage,
  onClose,
  onChanged,
}: {
  caseId: string;
  orgId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{ case: HrCase; comments: Comment[] } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const resolveAI = useAiCall<{ suggestion: string; reasoning: string }>("Analyst", "suggest_case_resolution");

  function load() {
    fetch(`/api/hr-cases/${caseId}`).then((r) => r.json()).then((b) => setData(b.data ?? null));
  }
  useEffect(load, [caseId]);
  useEffect(() => {
    fetch(`/api/hr-cases/categories?org_id=${orgId}`).then((r) => r.json()).then((b) => setCategories(b.data ?? []));
    fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()).then((b) => setEmployees(b.data ?? []));
  }, [orgId]);

  async function patchCase(fields: Record<string, unknown>) {
    await fetch(`/api/hr-cases/${caseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    load();
    onChanged();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSaving(true);
    await fetch(`/api/hr-cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: commentText, is_internal_note: isInternal }),
    });
    setSaving(false);
    setCommentText("");
    setIsInternal(false);
    load();
  }

  if (!data) return null;
  const { case: hrCase, comments } = data;
  const categoryName = categories.find((c) => c.id === hrCase.categoryId)?.name;

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-h3 font-semibold text-neutral-950">
              {hrCase.isConfidential && <span className="mr-1.5 text-neutral-500">&#128274;</span>}
              {hrCase.subject}
            </h3>
            <p className="mt-1 text-caption text-neutral-500">{categoryName ?? "Uncategorized"}</p>
          </div>
          <div className="flex gap-2">
            <Badge color={PRIORITY_COLOR[hrCase.priority]}>{hrCase.priority}</Badge>
            <Badge color={STATUS_COLOR[hrCase.status]}>{hrCase.status.replace(/_/g, " ")}</Badge>
          </div>
        </div>
        {hrCase.description && <p className="text-body text-neutral-700">{hrCase.description}</p>}

        {canManage && (
          <Card padding="sm" className="space-y-3">
            <p className="text-caption font-medium uppercase text-neutral-500">Handler actions</p>
            <div className="flex flex-wrap gap-3">
              <Field label="Status">
                <Select className="w-44" value={hrCase.status} onChange={(e) => patchCase({ status: e.target.value })}>
                  {["open", "in_progress", "waiting_on_employee", "resolved", "closed"].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Assignee">
                <Select className="w-44" value={hrCase.assignedTo ?? ""} onChange={(e) => patchCase({ assigned_to: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Confidential">
                <Select
                  className="w-32"
                  value={hrCase.isConfidential ? "yes" : "no"}
                  onChange={(e) => patchCase({ is_confidential: e.target.value === "yes" })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </Field>
            </div>
            <AiButton label="Suggest resolution" loading={resolveAI.loading} onClick={() => resolveAI.run({ category: categoryName ?? "" })} />
            {resolveAI.result && (
              <AiSuggestionCard reasoning={resolveAI.result.reasoning} onAccept={() => resolveAI.setResult(null)} onReject={() => resolveAI.setResult(null)}>
                <p className="text-body text-neutral-700">{resolveAI.result.suggestion}</p>
              </AiSuggestionCard>
            )}
          </Card>
        )}

        <div className="space-y-2">
          <p className="text-caption font-medium uppercase text-neutral-500">Comments</p>
          {comments.length === 0 && <p className="text-body text-neutral-500">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className={`rounded-md p-3 text-body ${c.isInternalNote ? "bg-neutral-200" : "bg-neutral-100"}`}>
              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-neutral-600">{employees.find((e) => e.id === c.authorId)?.fullName ?? "—"}</span>
                {c.isInternalNote && <Badge color="warning">Internal</Badge>}
              </div>
              <p className="mt-1 text-neutral-800">{c.comment}</p>
            </div>
          ))}
          <form onSubmit={submitComment} className="space-y-2">
            <Textarea className="w-full" rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment…" />
            <div className="flex items-center justify-between">
              {canManage && (
                <label className="flex items-center gap-2 text-body text-neutral-700">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  Internal note
                </label>
              )}
              <Button type="submit" disabled={saving || !commentText.trim()}>{saving ? "Posting…" : "Post comment"}</Button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
