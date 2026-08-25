"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AiBanner } from "@/components/ui/AiBanner";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { generateAI } from "@/lib/ai/generate";

type ClickUpTask = { id: string; name: string; status: string; assignees: string[]; dueDate: string | null; url: string };
type ClickUpListOption = { id: string; name: string; spaceName: string };
type ClickUpComment = { id: string; text: string; authorName: string; postedAt: string };
type ClickUpDoc = { id: string; name: string; updatedAt: string };
type ClickUpDocPage = { id: string; name: string; content: string };

export default function ClickUpPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const toast = useToast();

  const [tab, setTab] = useState<"tasks" | "docs">("tasks");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [listOptions, setListOptions] = useState<ClickUpListOption[]>([]);
  const [listOptionsLoading, setListOptionsLoading] = useState(false);
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [comments, setComments] = useState<ClickUpComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  const [docs, setDocs] = useState<ClickUpDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docPages, setDocPages] = useState<ClickUpDocPage[]>([]);
  const [docPagesLoading, setDocPagesLoading] = useState(false);
  const [docSummary, setDocSummary] = useState<string | null>(null);
  const [docSummaryLoading, setDocSummaryLoading] = useState(false);

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/integrations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const row = (body.data ?? []).find(
          (i: { provider: string; status: string; selectedListId?: string | null; selectedListName?: string | null }) =>
            i.provider === "clickup",
        );
        setConnected(row?.status === "connected");
        setSelectedListId(row?.selectedListId ?? null);
        setSelectedListName(row?.selectedListName ?? null);
      });
  }, [selectedOrgId]);

  function loadListOptions() {
    if (!selectedOrgId) return;
    setListOptionsLoading(true);
    fetch(`/api/integrations/clickup/lists?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setListOptions(body.data ?? []))
      .finally(() => setListOptionsLoading(false));
  }

  function selectList(listId: string) {
    if (!selectedOrgId) return;
    const option = listOptions.find((l) => l.id === listId);
    if (!option) return;
    fetch(`/api/integrations/clickup/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, list_id: option.id, list_name: option.name }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) return;
        setSelectedListId(body.data.selectedListId ?? option.id);
        setSelectedListName(body.data.selectedListName ?? option.name);
        loadTasks();
      });
  }

  function loadTasks() {
    if (!selectedOrgId) return;
    setTasksLoading(true);
    setTasksError(null);
    fetch(`/api/integrations/clickup/tasks?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load ClickUp tasks");
        setTasks(body.data);
      })
      .catch((err) => setTasksError(err instanceof Error ? err.message : "Failed to load ClickUp tasks"))
      .finally(() => setTasksLoading(false));
  }

  useEffect(() => {
    if (connected) {
      loadTasks();
      loadListOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, selectedOrgId]);

  function loadDocs() {
    if (!selectedOrgId) return;
    setDocsLoading(true);
    setDocsError(null);
    fetch(`/api/integrations/clickup/docs?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load ClickUp docs");
        setDocs(body.data);
      })
      .catch((err) => setDocsError(err instanceof Error ? err.message : "Failed to load ClickUp docs"))
      .finally(() => setDocsLoading(false));
  }

  useEffect(() => {
    if (connected && tab === "docs" && docs.length === 0 && !docsLoading) loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, tab, selectedOrgId]);

  function loadDocPages(docId: string) {
    if (!selectedOrgId) return;
    setActiveDocId(docId);
    setDocPagesLoading(true);
    setDocSummary(null);
    fetch(`/api/integrations/clickup/docs/${docId}?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setDocPages(body.data ?? []))
      .finally(() => setDocPagesLoading(false));
  }

  async function summarizeDoc() {
    const doc = docs.find((d) => d.id === activeDocId);
    if (!doc) return;
    setDocSummaryLoading(true);
    const content = docPages.map((p) => p.content).join("\n\n");
    const s = (await generateAI("Analyst", "summarize_doc", { docName: doc.name, content })) as string;
    setDocSummary(s);
    setDocSummaryLoading(false);
  }

  function loadComments(taskId: string) {
    if (!selectedOrgId) return;
    setActiveTaskId(taskId);
    setCommentsLoading(true);
    setSummary(null);
    setDraft(null);
    fetch(`/api/integrations/clickup/tasks/${taskId}/comments?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setComments(body.data ?? []))
      .finally(() => setCommentsLoading(false));
  }

  function postComment() {
    if (!selectedOrgId || !activeTaskId || !reply.trim()) return;
    setPosting(true);
    fetch(`/api/integrations/clickup/tasks/${activeTaskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, comment_text: reply }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.data?.posted) {
          setReply("");
          toast.show("Comment posted to ClickUp");
          loadComments(activeTaskId);
        } else {
          toast.show(body.error ?? "Failed to post comment");
        }
      })
      .finally(() => setPosting(false));
  }

  async function summarize() {
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;
    setSummaryLoading(true);
    const s = (await generateAI("Analyst", "summarize_task_comments", { taskName: task.name, comments })) as string;
    setSummary(s);
    setSummaryLoading(false);
  }

  async function draftReply() {
    setDraftLoading(true);
    const d = (await generateAI("Writer", "draft_task_comment_reply", { comments })) as string;
    setDraft(d);
    setDraftLoading(false);
  }

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">ClickUp</h1>
        <p className="mt-1 text-body text-neutral-600">Tasks and discussion from your connected ClickUp workspace</p>
      </div>

      {connected === false && <CommunicationBanner service="ClickUp" connectHref="/admin/integrations" />}

      {connected && (
        <div className="flex w-fit gap-1 glass p-0.5 rounded-md">
          {(["tasks", "docs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-sm px-3 py-1 text-small font-medium capitalize ${
                tab === t ? "bg-primary-600 text-neutral-50" : "text-neutral-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {connected && tab === "tasks" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-2 glass-card p-3">
            <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-neutral-500">Tasks</p>
            <Field label="List">
              <Select
                className="w-full"
                value={selectedListId ?? ""}
                disabled={listOptionsLoading}
                onChange={(e) => e.target.value && selectList(e.target.value)}
              >
                <option value="" disabled={!!selectedListId}>
                  {selectedListId ? selectedListName ?? "Selected list" : "Auto (first list found)"}
                </option>
                {listOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.spaceName} / {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            {tasksLoading ? (
              <SectionSkeleton variant="list" />
            ) : tasksError ? (
              <p className="text-small text-danger-600">{tasksError}</p>
            ) : tasks.length === 0 ? (
              <p className="text-small text-neutral-500">No tasks found in the connected workspace.</p>
            ) : (
              <ul className="space-y-0.5">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => loadComments(t.id)}
                      className={`flex w-full flex-col gap-1 rounded-sm px-2 py-1.5 text-left ${
                        activeTaskId === t.id ? "bg-primary-100" : "hover:bg-neutral-100"
                      }`}
                    >
                      <span className="truncate text-body text-neutral-950">{t.name}</span>
                      <span className="flex items-center gap-2">
                        <Badge color="info">{t.status}</Badge>
                        {t.assignees.length > 0 && <span className="text-caption text-neutral-500">{t.assignees.join(", ")}</span>}
                        {t.dueDate && <span className="text-caption text-neutral-400">Due {new Date(t.dueDate).toLocaleDateString()}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="flex min-h-[500px] flex-col glass-card">
            {!activeTaskId ? (
              <p className="flex flex-1 items-center justify-center text-body text-neutral-500">Pick a task to see its comments.</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <p className="text-body-medium font-semibold text-neutral-950">
                    {tasks.find((t) => t.id === activeTaskId)?.name}
                  </p>
                  <button
                    type="button"
                    onClick={summarize}
                    disabled={summaryLoading || comments.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
                  >
                    {summaryLoading ? "Thinking…" : "AI: Summarize this task's discussion"}
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {commentsLoading ? (
                    <SectionSkeleton variant="text" />
                  ) : comments.length === 0 ? (
                    <p className="text-center text-body text-neutral-500">No comments on this task yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                          {c.authorName?.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-body-medium font-semibold text-neutral-950">{c.authorName}</span>
                            <span className="text-caption text-neutral-500">{new Date(c.postedAt).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-body text-neutral-800">{c.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 border-t border-neutral-200 p-3">
                  <div className="flex items-start gap-2">
                    <Input className="flex-1" placeholder="Write a comment…" value={reply} onChange={(e) => setReply(e.target.value)} />
                    <Button onClick={postComment} disabled={posting || !reply.trim()}>
                      {posting ? "Posting…" : "Post Comment"}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={draftReply}
                    disabled={draftLoading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
                  >
                    {draftLoading ? "Thinking…" : "AI: Draft a reply"}
                  </button>
                  {draft && (
                    <div className="space-y-2 overflow-hidden rounded-md glass-card border-ai-600/40">
                      <AiBanner />
                      <div className="space-y-2 px-4 pb-3">
                        <p className="whitespace-pre-wrap text-body text-neutral-800">{draft}</p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setReply(draft);
                              setDraft(null);
                            }}
                          >
                            Accept
                          </Button>
                          <Button variant="secondary" onClick={() => setDraft(null)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {connected && tab === "docs" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-2 glass-card p-3">
            <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-neutral-500">Docs</p>
            {docsLoading ? (
              <SectionSkeleton variant="list" />
            ) : docsError ? (
              <p className="text-small text-danger-600">{docsError}</p>
            ) : docs.length === 0 ? (
              <p className="text-small text-neutral-500">No docs found in the connected workspace.</p>
            ) : (
              <ul className="space-y-0.5">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => loadDocPages(d.id)}
                      className={`flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left ${
                        activeDocId === d.id ? "bg-primary-100" : "hover:bg-neutral-100"
                      }`}
                    >
                      <span className="truncate text-body text-neutral-950">{d.name}</span>
                      <span className="text-caption text-neutral-400">Updated {new Date(d.updatedAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="flex min-h-[500px] flex-col glass-card">
            {!activeDocId ? (
              <p className="flex flex-1 items-center justify-center text-body text-neutral-500">Pick a doc to view its content.</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <p className="text-body-medium font-semibold text-neutral-950">{docs.find((d) => d.id === activeDocId)?.name}</p>
                  <button
                    type="button"
                    onClick={summarizeDoc}
                    disabled={docSummaryLoading || docPages.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
                  >
                    {docSummaryLoading ? "Thinking…" : "AI: Summarize this doc"}
                  </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto p-4">
                  {docPagesLoading ? (
                    <SectionSkeleton variant="text" />
                  ) : docPages.length === 0 ? (
                    <p className="text-center text-body text-neutral-500">This doc has no readable pages.</p>
                  ) : (
                    docPages.map((p) => (
                      <div key={p.id} className="space-y-1">
                        <p className="text-body-medium font-semibold text-neutral-950">{p.name}</p>
                        <pre className="whitespace-pre-wrap font-sans text-body text-neutral-800">{p.content || "(empty page)"}</pre>
                      </div>
                    ))
                  )}
                </div>

                <p className="border-t border-neutral-200 px-4 py-2 text-caption text-neutral-400">
                  Docs are read-only — ClickUp&apos;s API doesn&apos;t support posting comments on doc pages.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {docSummary && (
        <Modal onClose={() => setDocSummary(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <AiBanner label="AI doc summary" />
            <pre className="whitespace-pre-wrap font-sans text-body text-neutral-800">{docSummary}</pre>
            <div className="flex justify-end">
              <Button onClick={() => setDocSummary(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {summary && (
        <Modal onClose={() => setSummary(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <AiBanner label="AI task discussion summary" />
            <pre className="whitespace-pre-wrap font-sans text-body text-neutral-800">{summary}</pre>
            <div className="flex justify-end">
              <Button onClick={() => setSummary(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
