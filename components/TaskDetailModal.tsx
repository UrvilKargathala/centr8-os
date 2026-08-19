"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Badge, TaskStatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Field } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES } from "@/lib/constants";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  assigneeId: string | null;
  sprintId: string | null;
  dueDate: string | null;
  category: string | null;
  startTime: string | null;
  endTime: string | null;
};

type Attachment = { id: string; fileName: string; fileSize: number; uploadedAt: string; downloadUrl: string };

type CapacityRow = { userId: string; capacity: number; assigned: number };

type Dependency = { taskId: string; dependsOnTaskId: string; type: string; dependsOnTitle?: string };

type Person = { id: string; fullName: string; jobTitle: string | null };
type Assignee = { personId: string; fullName: string; jobTitle: string | null; avatarUrl: string | null };
type Comment = { id: string; body: string; authorUserId: string | null; createdAt: string };

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Colored two-letter chip by extension — not a real file-type icon set
// (would need a dependency), just enough to visually separate PDFs/docs/
// images/other in the attachments list, same "small enough for a couple
// of lines" call as the rest of this file's icons.
function fileKindChip(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", classes: "bg-danger-100 text-danger-600" };
  if (["doc", "docx"].includes(ext)) return { label: "DOC", classes: "bg-info-100 text-info-600" };
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return { label: "IMG", classes: "bg-success-100 text-success-600" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { label: "XLS", classes: "bg-success-100 text-success-600" };
  return { label: "FILE", classes: "bg-neutral-200 text-neutral-600" };
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 pt-2 text-caption text-neutral-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TaskDetailModal({ taskId, onClose, onChanged }: { taskId: string; onClose: () => void; onChanged: () => void }) {
  const { can, selectedOrgId } = useOrg();
  const canUpdateTask = can("task", "update");
  const canAddDependency = can("task_dependency", "create");
  const canRemoveDependency = can("task_dependency", "delete");
  const [task, setTask] = useState<TaskDetail | null>(null);
  // Snapshot of the task as loaded — used to back out its own contribution
  // to the assignee's assigned total below, so editing this task's
  // estimate doesn't double-count it (Prompt 3.2 task 3).
  const [originalTask, setOriginalTask] = useState<TaskDetail | null>(null);
  const [capacity, setCapacity] = useState<CapacityRow[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  const [newDepId, setNewDepId] = useState("");
  const [newDepType, setNewDepType] = useState("blocks");
  const [depError, setDepError] = useState<string | null>(null);

  function loadAttachments() {
    fetch(`/api/tasks/${taskId}/attachments`)
      .then((r) => r.json())
      .then((b) => setAttachments(b.data ?? []))
      .catch(() => setAttachments([]));
  }

  function loadAssignees() {
    fetch(`/api/tasks/${taskId}/assignees`)
      .then((r) => r.json())
      .then((b) => setAssignees(b.data ?? []))
      .catch(() => setAssignees([]));
  }

  function load() {
    setLoading(true);
    setError(null);
    loadAttachments();
    loadAssignees();
    Promise.all([
      fetch(`/api/tasks/${taskId}`).then((r) => r.json()),
      fetch(`/api/tasks/${taskId}/dependencies`).then((r) => r.json()),
    ])
      .then(async ([taskBody, depBody]) => {
        if (!taskBody.data) throw new Error(taskBody.error ?? "Failed to load task");
        setTask(taskBody.data);
        setOriginalTask(taskBody.data);

        if (taskBody.data.sprintId) {
          fetch(`/api/capacity?sprint_id=${taskBody.data.sprintId}`)
            .then((r) => r.json())
            .then((b) => setCapacity(b.data ?? []))
            .catch(() => setCapacity([]));
        } else {
          setCapacity([]);
        }

        // No endpoint returns dependency titles joined — resolved
        // per-dependency here (small N per task, same pattern as the
        // project list's per-project milestone counts).
        const deps: Dependency[] = depBody.data ?? [];
        const resolved = await Promise.all(
          deps.map(async (d) => {
            const r = await fetch(`/api/tasks/${d.dependsOnTaskId}`).then((res) => res.json());
            return { ...d, dependsOnTitle: r.data?.title ?? d.dependsOnTaskId };
          }),
        );
        setDependencies(resolved);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load task"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [taskId]);

  function loadComments() {
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((b) => {
        if (b.data) setComments(b.data);
      });
  }
  useEffect(loadComments, [taskId]);

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/team?org_id=${selectedOrgId}&active=true`)
      .then((r) => r.json())
      .then((b) => {
        if (b.data) setPeople(b.data);
      });
  }, [selectedOrgId]);

  async function addComment() {
    if (!newComment.trim()) return;
    setCommenting(true);
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    setCommenting(false);
    if (res.ok) {
      setNewComment("");
      loadComments();
    }
  }
  async function deleteComment(id: string) {
    await fetch(`/api/task-comments/${id}`, { method: "DELETE" });
    loadComments();
  }

  async function addAssignee(personId: string) {
    if (!personId) return;
    setAddingAssignee(false);
    await fetch(`/api/tasks/${taskId}/assignees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: personId }),
    });
    loadAssignees();
  }
  async function removeAssignee(personId: string) {
    await fetch(`/api/tasks/${taskId}/assignees?person_id=${personId}`, { method: "DELETE" });
    loadAssignees();
  }

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        estimate: task.estimate,
        assignee_id: task.assigneeId,
        due_date: task.dueDate,
        category: task.category,
        start_time: task.startTime,
        end_time: task.endTime,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onChanged();
  }

  async function addDependency() {
    setDepError(null);
    if (!newDepId) return;
    const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depends_on_task_id: newDepId, type: newDepType }),
    });
    const body = await res.json();
    if (!res.ok) {
      setDepError(body.error ?? "Failed to add dependency");
      return;
    }
    setNewDepId("");
    load();
  }

  async function removeDependency(dependsOnTaskId: string) {
    await fetch(`/api/tasks/${taskId}/dependencies?depends_on_task_id=${dependsOnTaskId}`, { method: "DELETE" });
    load();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: formData });
    setUploading(false);
    loadAttachments();
  }

  async function removeAttachment(id: string) {
    await fetch(`/api/task-attachments/${id}`, { method: "DELETE" });
    loadAttachments();
  }

  // Prompt 3.2 task 3 — informational only, never blocks the save. Projects
  // what the assignee's total would be if the current (possibly unsaved)
  // form values were saved: their persisted assigned total, minus this
  // task's own persisted contribution (so editing it doesn't double-count),
  // plus its current estimate.
  const assigneeCapacity = task?.assigneeId ? capacity.find((c) => c.userId === task.assigneeId) : undefined;
  const originalContribution =
    task && originalTask && originalTask.assigneeId === task.assigneeId ? (originalTask.estimate ?? 0) : 0;
  const projectedAssigned = assigneeCapacity
    ? assigneeCapacity.assigned - originalContribution + (task?.estimate ?? 0)
    : null;
  const overAllocated = assigneeCapacity != null && projectedAssigned != null && projectedAssigned > assigneeCapacity.capacity;

  // Falls back to the legacy single assignee (unresolved tasks predating
  // task_assignees) so the row isn't just empty for every pre-existing task.
  const legacyAssignee = assignees.length === 0 && task?.assigneeId ? people.find((p) => p.id === task.assigneeId) : undefined;
  const assignablePeople = people.filter((p) => !assignees.some((a) => a.personId === p.id));

  return (
    <Modal onClose={onClose}>
      {loading ? (
        <p className="text-body text-neutral-600">Loading…</p>
      ) : !task ? (
        <p className="text-body text-danger-600">{error ?? "Task not found"}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">Task Detail</p>
              <input
                className="mt-0.5 w-full rounded-md border border-transparent bg-transparent text-h2 font-semibold text-neutral-950 focus:border-neutral-300 focus:bg-neutral-50 focus:outline focus:outline-2 focus:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                disabled={!canUpdateTask}
              />
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <button onClick={onClose} className="text-body text-neutral-600 hover:text-neutral-950" aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

          <div className="glass-card space-y-3 p-4">
            <MetaRow label="Status">
              <Select className="w-full" value={task.status} onChange={(e) => setTask({ ...task, status: e.target.value })} disabled={!canUpdateTask}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </MetaRow>

            <MetaRow label="Category">
              <Input
                className="w-full"
                placeholder="e.g. UX Research"
                value={task.category ?? ""}
                onChange={(e) => setTask({ ...task, category: e.target.value || null })}
                disabled={!canUpdateTask}
              />
            </MetaRow>

            <MetaRow label="Priority">
              <Select className="w-full" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })} disabled={!canUpdateTask}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </MetaRow>

            <MetaRow label="Due Date">
              <Input
                type="date"
                className="w-full"
                value={task.dueDate ?? ""}
                onChange={(e) => setTask({ ...task, dueDate: e.target.value || null })}
                disabled={!canUpdateTask}
              />
            </MetaRow>

            <MetaRow label="Time">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-full"
                  value={task.startTime ?? ""}
                  onChange={(e) => setTask({ ...task, startTime: e.target.value || null })}
                  disabled={!canUpdateTask}
                />
                <span className="shrink-0 text-neutral-500">–</span>
                <Input
                  type="time"
                  className="w-full"
                  value={task.endTime ?? ""}
                  onChange={(e) => setTask({ ...task, endTime: e.target.value || null })}
                  disabled={!canUpdateTask}
                />
              </div>
            </MetaRow>

            <MetaRow label="Estimate">
              <Input
                type="number"
                className="w-full"
                value={task.estimate ?? ""}
                onChange={(e) => setTask({ ...task, estimate: e.target.value ? Number(e.target.value) : null })}
                disabled={!canUpdateTask}
              />
            </MetaRow>

            <MetaRow label="Assign to">
              <div className="flex flex-wrap items-center gap-2">
                {legacyAssignee && (
                  <div className="flex items-center gap-1.5 rounded-full bg-neutral-200 py-1 pl-1 pr-2.5" title={legacyAssignee.jobTitle ?? undefined}>
                    <Avatar name={legacyAssignee.fullName} size={8} />
                    <span className="text-small text-neutral-800">{legacyAssignee.fullName}</span>
                  </div>
                )}
                {assignees.map((a) => (
                  <div key={a.personId} className="flex items-center gap-1.5 rounded-full bg-neutral-200 py-1 pl-1 pr-2" title={a.jobTitle ?? undefined}>
                    <Avatar name={a.fullName} size={8} />
                    <span className="text-small text-neutral-800">{a.fullName}</span>
                    {canUpdateTask && (
                      <button
                        type="button"
                        onClick={() => removeAssignee(a.personId)}
                        className="text-caption text-neutral-500 hover:text-danger-600"
                        aria-label={`Remove ${a.fullName}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {canUpdateTask &&
                  (addingAssignee ? (
                    <Select
                      autoFocus
                      className="!w-auto"
                      value=""
                      onChange={(e) => addAssignee(e.target.value)}
                      onBlur={() => setAddingAssignee(false)}
                    >
                      <option value="">Pick a person…</option>
                      {assignablePeople.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingAssignee(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-neutral-400 text-neutral-500 hover:border-primary-600 hover:text-primary-700"
                      aria-label="Add assignee"
                    >
                      +
                    </button>
                  ))}
                {!legacyAssignee && assignees.length === 0 && !addingAssignee && (
                  <span className="text-small text-neutral-500">Unassigned</span>
                )}
              </div>
            </MetaRow>
          </div>

          {overAllocated && assigneeCapacity && (
            <div className="flex items-center gap-2 rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-2">
              <Badge color="warning">Over capacity</Badge>
              <p className="text-small text-warning-600">
                This assignee would be at {projectedAssigned}/{assigneeCapacity.capacity} pts for this sprint.
              </p>
            </div>
          )}

          <Field label="Description">
            <Textarea className="w-full" rows={3} value={task.description ?? ""} onChange={(e) => setTask({ ...task, description: e.target.value || null })} disabled={!canUpdateTask} />
          </Field>

          <div className="space-y-2 border-t border-neutral-200 pt-4">
            <h3 className="text-h3 font-semibold text-neutral-950">Attachments</h3>
            {attachments.length === 0 ? (
              <p className="text-small text-neutral-600">None.</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a) => {
                  const chip = fileKindChip(a.fileName);
                  return (
                    <li key={a.id} className="glass-card flex items-center gap-3 p-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-caption font-semibold ${chip.classes}`}>
                        {chip.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-medium text-neutral-950">{a.fileName}</p>
                        <p className="text-caption text-neutral-500">{formatFileSize(a.fileSize)}</p>
                      </div>
                      <a href={a.downloadUrl} target="_blank" rel="noreferrer" className="shrink-0 text-caption font-medium text-primary-700 hover:underline">
                        Preview
                      </a>
                      {canUpdateTask && (
                        <button onClick={() => removeAttachment(a.id)} className="shrink-0 text-caption text-danger-600 hover:underline">
                          Remove
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canUpdateTask && (
              <label className="inline-block">
                <span className="cursor-pointer text-small font-medium text-primary-700 hover:underline">
                  {uploading ? "Uploading…" : "+ Add File"}
                </span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="space-y-2 border-t border-neutral-200 pt-4">
            <h3 className="text-h3 font-semibold text-neutral-950">Dependencies</h3>
            {dependencies.length === 0 ? (
              <p className="text-small text-neutral-600">None.</p>
            ) : (
              <ul className="space-y-1.5">
                {dependencies.map((d) => (
                  <li key={d.dependsOnTaskId} className="flex items-center justify-between text-body">
                    <span className="text-neutral-950">
                      {d.dependsOnTitle} <Badge>{d.type}</Badge>
                    </span>
                    {canRemoveDependency && (
                      <button
                        onClick={() => removeDependency(d.dependsOnTaskId)}
                        className="text-small text-danger-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {depError && <p className="text-small text-danger-600">{depError}</p>}
            {canAddDependency && (
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-0 flex-1" placeholder="Depends-on task ID" value={newDepId} onChange={(e) => setNewDepId(e.target.value)} />
                <Select value={newDepType} onChange={(e) => setNewDepType(e.target.value)}>
                  <option value="blocks">blocks</option>
                  <option value="blocked_by">blocked_by</option>
                </Select>
                <Button variant="secondary" onClick={addDependency} disabled={!newDepId}>
                  Add
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-neutral-200 pt-4">
            <h3 className="text-h3 font-semibold text-neutral-950">Comment</h3>
            {comments.length === 0 ? (
              <p className="text-body text-neutral-600">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <Avatar name={c.authorUserId ? c.authorUserId.slice(0, 2) : "?"} size={8} />
                    <div className="glass-card min-w-0 flex-1 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-caption font-medium text-neutral-700">
                          {c.authorUserId ? c.authorUserId.slice(0, 8) : "Unknown"}
                        </span>
                        <span className="text-caption text-neutral-500">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-950">{c.body}</p>
                      {can("task_comment", "delete") && (
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          className="mt-1 text-caption text-danger-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {can("task_comment", "create") && (
              <div className="flex items-end gap-2">
                <Textarea
                  className="w-full"
                  rows={1}
                  placeholder="Type your comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <Button onClick={addComment} disabled={commenting || !newComment.trim()} size="icon-sm" aria-label="Post comment">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canUpdateTask && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
