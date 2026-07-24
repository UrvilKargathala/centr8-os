"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import type { Task } from "@/components/TaskCard";

type Attachment = {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  downloadUrl: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Project-wide roll-up of per-task attachments (Prompt: "each task can
// have its own attached files, and the Files tab lists all of them across
// the project"). Fetches per-task since the API is task-scoped — fine at
// this app's team scale, same N-small-requests pattern TaskDetailModal
// already uses to resolve dependency titles.
export function ProjectFilesView({ tasks }: { tasks: Task[] }) {
  const { can } = useOrg();
  const canUpload = can("task", "update");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTaskId, setUploadTaskId] = useState(tasks[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadAll() {
    setLoading(true);
    Promise.all(
      tasks.map((t) =>
        fetch(`/api/tasks/${t.id}/attachments`)
          .then((r) => r.json())
          .then((body) => (body.data ?? []) as Attachment[])
          .catch(() => [] as Attachment[]),
      ),
    )
      .then((lists) => setAttachments(lists.flat()))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [tasks]);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadTaskId) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/tasks/${uploadTaskId}/attachments`, { method: "POST", body: formData });
    const body = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to upload");
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadAll();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/task-attachments/${id}`, { method: "DELETE" });
    loadAll();
  }

  const taskTitle = (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? "Unknown task";

  return (
    <div className="space-y-4">
      {canUpload && tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 bg-neutral-100 p-3">
          <Select className="w-48" value={uploadTaskId} onChange={(e) => setUploadTaskId(e.target.value)}>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
          <input ref={fileInputRef} type="file" className="text-body text-neutral-700" />
          <Button variant="secondary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {loading ? (
        <p className="text-body text-neutral-600">Loading files…</p>
      ) : attachments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No files yet</EmptyTitle>
            <EmptyDescription>Attach a file to a task above, or from the task's detail view.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-body">
              <div className="min-w-0">
                <a href={a.downloadUrl} className="font-medium text-primary-700 hover:underline" target="_blank" rel="noreferrer">
                  {a.fileName}
                </a>
                <p className="text-small text-neutral-600">
                  {taskTitle(a.taskId)} · {formatSize(a.fileSize)} · {new Date(a.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              {canUpload && (
                <button onClick={() => handleDelete(a.id)} className="shrink-0 text-small text-danger-600 hover:underline">
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
