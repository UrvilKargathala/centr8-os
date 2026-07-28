"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AiBanner } from "@/components/ui/AiBanner";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { mockGmail } from "@/lib/mock/communication";
import { generateAI } from "@/lib/ai/generate";

const TABS = ["Inbox", "Starred", "Sent", "Drafts"] as const;

export default function MailPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Inbox");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [category, setCategory] = useState<{ label: string; reasoning: string } | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const toast = useToast();

  const filtered = useMemo(() => {
    let list = mockGmail.inbox;
    if (tab === "Starred") list = list.filter((e) => e.is_starred);
    if (tab === "Sent" || tab === "Drafts") list = [];
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (e) =>
          e.subject.toLowerCase().includes(needle) ||
          e.from_name.toLowerCase().includes(needle) ||
          e.from_email.toLowerCase().includes(needle) ||
          e.preview.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [tab, q]);

  const open = openId ? mockGmail.inbox.find((e) => e.id === openId) : null;
  const thread = openId ? mockGmail.threads_by_id[openId] ?? [] : [];

  async function runSummary() {
    if (!open) return;
    setLoading("summary");
    const s = (await generateAI("Analyst", "summarize_email_thread", { subject: open.subject })) as string;
    setSummary(s);
    setLoading(null);
  }
  async function runCategorize() {
    if (!open) return;
    setLoading("categorize");
    const c = (await generateAI("Analyst", "categorize_email", { from_email: open.from_email, subject: open.subject })) as { label: string; reasoning: string };
    setCategory(c);
    setLoading(null);
  }
  async function runDraft() {
    if (!open) return;
    setLoading("draft");
    const d = (await generateAI("Writer", "draft_email_reply", { subject: open.subject })) as { subject: string; body: string };
    setDraft(d);
    setLoading(null);
  }
  function mockSend() {
    console.log("Gmail send (mock)");
    toast.show("Mock mode — not sent");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Mail</h1>
        <p className="mt-1 text-body text-neutral-600">Gmail — inbox</p>
      </div>

      <CommunicationBanner service="Gmail" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3 rounded-md border border-neutral-300 bg-neutral-50 p-3">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="space-y-0.5">
            {TABS.map((t) => {
              const count = t === "Inbox" ? mockGmail.inbox.length : t === "Starred" ? mockGmail.inbox.filter((e) => e.is_starred).length : 0;
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => { setTab(t); setOpenId(null); }}
                    className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-body ${
                      tab === t ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span>{t}</span>
                    <span className="text-caption text-neutral-500">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-h-[500px] rounded-md border border-neutral-300 bg-neutral-50">
          {open ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-heading text-h3 font-semibold text-neutral-950">{open.subject}</p>
                  <p className="truncate text-caption text-neutral-500">{open.from_name} · {open.from_email}</p>
                </div>
                <Button variant="secondary" onClick={() => setOpenId(null)}>Back to list</Button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-2">
                <AiPill onClick={runSummary} loading={loading === "summary"} label="AI: Summarize thread" />
                <AiPill onClick={runDraft} loading={loading === "draft"} label="AI: Draft reply" />
                <AiPill onClick={runCategorize} loading={loading === "categorize"} label="AI: Categorize" />
                <span className="flex-1" />
                <Button variant="secondary" onClick={mockSend}>Reply</Button>
                <Button variant="secondary" onClick={() => { console.log("archive"); toast.show("Mock mode — not sent"); }}>Archive</Button>
                <Button variant="secondary" onClick={() => { console.log("delete"); toast.show("Mock mode — not sent"); }}>Delete</Button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {thread.length === 0 ? (
                  <p className="text-body text-neutral-600">{open.preview}</p>
                ) : (
                  thread.map((m) => (
                    <div key={m.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-body-medium font-semibold text-neutral-950">{m.from_name}</span>
                        <span className="text-caption text-neutral-500">{new Date(m.sent_at).toLocaleString()}</span>
                      </div>
                      <p className="text-caption text-neutral-500">to {m.to.join(", ")}</p>
                      <p className="mt-2 whitespace-pre-wrap text-body text-neutral-800">{m.body}</p>
                      {m.attachments && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.attachments.map((a) => (
                            <span key={a.name} className="rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-caption text-neutral-700">
                              📎 {a.name} · {a.size_kb} KB
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {summary && (
                <div className="mx-4 mb-4 space-y-2 overflow-hidden rounded-md border border-ai-600/40">
                  <AiBanner label="AI summary" />
                  <p className="whitespace-pre-wrap px-4 pb-3 text-body text-neutral-800">{summary}</p>
                  <div className="flex justify-end gap-2 px-4 pb-3">
                    <Button variant="secondary" onClick={() => setSummary(null)}>Close</Button>
                  </div>
                </div>
              )}

              {category && (
                <div className="mx-4 mb-4 space-y-2 overflow-hidden rounded-md border border-ai-600/40">
                  <AiBanner label="AI categorization" />
                  <div className="px-4 pb-3">
                    <p className="text-body-medium font-semibold text-neutral-950">Suggested: {category.label}</p>
                    <p className="text-small text-neutral-600">{category.reasoning}</p>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => { console.log("apply label:", category.label); toast.show("Label applied (mock)"); setCategory(null); }}>Accept</Button>
                      <Button variant="secondary" onClick={() => setCategory(null)}>Reject</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {filtered.length === 0 ? (
                <li className="p-8 text-center text-body text-neutral-500">No emails in this view.</li>
              ) : (
                filtered.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(e.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100 ${
                        e.is_unread ? "bg-neutral-50" : "bg-neutral-100/40"
                      }`}
                    >
                      {e.is_unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                      {e.is_starred && (
                        <svg className="h-4 w-4 shrink-0 text-warning-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className={`truncate text-body ${e.is_unread ? "font-semibold text-neutral-950" : "text-neutral-700"}`}>
                            {e.from_name}
                          </span>
                          <span className="shrink-0 text-caption text-neutral-500">{new Date(e.received_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                        <p className={`truncate text-small ${e.is_unread ? "font-medium text-neutral-950" : "text-neutral-600"}`}>{e.subject}</p>
                        <p className="truncate text-caption text-neutral-500">{e.preview}</p>
                      </div>
                      {e.has_attachments && (
                        <svg className="h-4 w-4 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      {e.requires_reply && <Badge color="warning">Needs reply</Badge>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      {draft && (
        <Modal onClose={() => setDraft(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <AiBanner label="AI drafted reply" />
            <div>
              <p className="text-caption text-neutral-500">Subject</p>
              <Input className="w-full" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div>
              <p className="text-caption text-neutral-500">Body</p>
              <Textarea rows={8} className="w-full" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
              <Button variant="secondary" onClick={() => setDraft(null)}>Reject</Button>
              <Button onClick={() => { console.log("Send drafted reply (mock)", draft); toast.show("Mock mode — not sent"); setDraft(null); }}>Send reply</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AiPill({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
    >
      {loading ? "Thinking…" : label}
    </button>
  );
}
