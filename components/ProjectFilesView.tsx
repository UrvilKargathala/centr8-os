"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Input";
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

// File-type tone + short label, driven by extension. Kept design-system
// colored (info/success/danger/warning/ai/neutral tokens) rather than
// vendor-brand colors — the icon still reads at a glance without importing
// a mock or matching Microsoft/Adobe brand hues.
type FileType = { ext: string; tone: string };
function detectType(name: string): FileType {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    doc: "bg-info-100 text-info-600",
    docx: "bg-info-100 text-info-600",
    pdf: "bg-danger-100 text-danger-600",
    xls: "bg-success-100 text-success-600",
    xlsx: "bg-success-100 text-success-600",
    csv: "bg-success-100 text-success-600",
    ppt: "bg-warning-100 text-warning-600",
    pptx: "bg-warning-100 text-warning-600",
    key: "bg-warning-100 text-warning-600",
    png: "bg-ai-100 text-ai-600",
    jpg: "bg-ai-100 text-ai-600",
    jpeg: "bg-ai-100 text-ai-600",
    gif: "bg-ai-100 text-ai-600",
    webp: "bg-ai-100 text-ai-600",
    svg: "bg-ai-100 text-ai-600",
    psd: "bg-ai-100 text-ai-600",
    ai: "bg-warning-100 text-warning-600",
    zip: "bg-neutral-200 text-neutral-700",
    md: "bg-neutral-200 text-neutral-700",
    txt: "bg-neutral-200 text-neutral-700",
    css: "bg-info-100 text-info-600",
    html: "bg-info-100 text-info-600",
    js: "bg-warning-100 text-warning-600",
    ts: "bg-info-100 text-info-600",
  };
  return { ext: ext.slice(0, 4).toUpperCase() || "FILE", tone: map[ext] ?? "bg-neutral-200 text-neutral-700" };
}

function FileTypeIcon({ name }: { name: string }) {
  const { ext, tone } = detectType(name);
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-heading text-caption font-semibold ${tone}`}>
      {ext}
    </span>
  );
}

export function ProjectFilesView({ tasks }: { tasks: Task[] }) {
  const { can } = useOrg();
  const canUpload = can("task", "update");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTaskId, setUploadTaskId] = useState(tasks[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
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
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/task-attachments/${id}`, { method: "DELETE" });
    loadAll();
  }

  const taskTitle = (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? "Unknown task";
  const filtered = q.trim()
    ? attachments.filter((a) => a.fileName.toLowerCase().includes(q.toLowerCase()) || taskTitle(a.taskId).toLowerCase().includes(q.toLowerCase()))
    : attachments;

  const totalSize = attachments.reduce((s, a) => s + a.fileSize, 0);

  return (
    <div className="space-y-4">
      {/* Upload row + search */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input placeholder="Search files or tasks…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        {attachments.length > 0 && (
          <p className="text-caption text-neutral-500">
            {attachments.length} file{attachments.length === 1 ? "" : "s"} · {formatSize(totalSize)} total
          </p>
        )}
      </div>

      {canUpload && tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <Select className="w-56" value={uploadTaskId} onChange={(e) => setUploadTaskId(e.target.value)}>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                Attach to: {t.title}
              </option>
            ))}
          </Select>
          <input ref={fileInputRef} type="file" className="flex-1 text-body text-neutral-700" />
          <Button variant="secondary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {loading ? (
        <p className="text-body text-neutral-600">Loading files…</p>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>{attachments.length === 0 ? "No files yet" : "No files match"}</EmptyTitle>
            <EmptyDescription>
              {attachments.length === 0 ? "Attach a file to a task above, or from the task's detail view." : "Try a different search."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-300">
          <table className="w-full min-w-[640px] text-body">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                <th className="w-12 px-3 py-2" />
                <th className="px-4 py-2">File</th>
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2 text-right">Size</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-neutral-50">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-100">
                  <td className="px-3 py-3">
                    <FileTypeIcon name={a.fileName} />
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={a.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-neutral-950 hover:text-primary-700 hover:underline"
                    >
                      {a.fileName}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-small text-neutral-600">{taskTitle(a.taskId)}</td>
                  <td className="px-4 py-3 text-small text-neutral-600">
                    {new Date(a.uploadedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right text-small text-neutral-700">{formatSize(a.fileSize)}</td>
                  <td className="px-3 py-3 text-right">
                    {canUpload && (
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        aria-label="Delete file"
                        className="rounded-md p-1 text-neutral-500 hover:bg-danger-100 hover:text-danger-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
