"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AiBanner } from "@/components/ui/AiBanner";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { Avatar } from "@/components/ui/Avatar";
import { useOrg } from "@/lib/context/OrgContext";
import { generateAI } from "@/lib/ai/generate";
import { SectionSkeleton, PageSkeleton } from "@/components/ui/skeleton";

type GmailMsg = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string[];
  snippet: string;
  body: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
};

const TABS = ["Inbox", "Starred", "Sent", "Drafts"] as const;

const TAB_ICON_PATH: Record<(typeof TABS)[number], string> = {
  Inbox: "M3 12h4l2 3h6l2-3h4M5 12L3 7.5A2 2 0 014.9 5h14.2a2 2 0 011.9 2.5L19 12m-14 0v6a2 2 0 002 2h10a2 2 0 002-2v-6",
  Starred: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  Sent: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  Drafts: "M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 16l-4 1 1-4 8.5-8.5z",
};

function TabIcon({ tab, className = "h-4 w-4" }: { tab: (typeof TABS)[number]; className?: string }) {
  const filled = tab === "Starred";
  return (
    <svg className={className} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={TAB_ICON_PATH[tab]} />
    </svg>
  );
}

function tabToGmailQuery(tab: (typeof TABS)[number]): { q?: string; label?: string } {
  switch (tab) {
    case "Inbox": return { label: "INBOX" };
    case "Starred": return { q: "is:starred" };
    case "Sent": return { label: "SENT" };
    case "Drafts": return { label: "DRAFT" };
  }
}

export default function MailPage() {
  const { selectedOrgId } = useOrg();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Inbox");
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<GmailMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [thread, setThread] = useState<GmailMsg[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [summary, setSummary] = useState<string | null>(null);
  const [category, setCategory] = useState<{ label: string; reasoning: string } | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; to: string } | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const fetchMessages = useCallback(async (pageToken?: string) => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const { q: gq, label } = tabToGmailQuery(tab);
      const searchQuery = q.trim() ? (gq ? `${gq} ${q}` : q) : gq;
      const params = new URLSearchParams({ org_id: selectedOrgId });
      if (searchQuery) params.set("q", searchQuery);
      if (label) params.set("label", label);
      if (pageToken) params.set("page_token", pageToken);

      const res = await fetch(`/api/integrations/gmail/messages?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 400 && body.error?.includes("isn't connected")) {
          setConnected(false);
          setMessages([]);
          return;
        }
        throw new Error(body.error ?? `Failed to fetch (${res.status})`);
      }
      const json = await res.json();
      setConnected(true);
      if (pageToken) {
        setMessages((prev) => [...prev, ...(json.data.messages ?? [])]);
      } else {
        setMessages(json.data.messages ?? []);
      }
      setNextPageToken(json.data.nextPageToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, tab, q]);

  useEffect(() => {
    setOpenThreadId(null);
    setThread([]);
    fetchMessages();
  }, [fetchMessages]);

  async function openThread(threadId: string) {
    if (!selectedOrgId) return;
    setOpenThreadId(threadId);
    setThreadLoading(true);
    setSummary(null);
    setCategory(null);
    try {
      const res = await fetch(`/api/integrations/gmail/messages/${threadId}?org_id=${selectedOrgId}`);
      const json = await res.json();
      setThread(json.data ?? []);
    } catch {
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  }

  const openMsg = thread[0] ?? messages.find((m) => m.threadId === openThreadId) ?? null;

  async function runSummary() {
    if (!openMsg) return;
    setAiLoading("summary");
    const threadText = thread.map((m) => `From: ${m.from}\n${m.body}`).join("\n---\n");
    const s = (await generateAI("Analyst", "summarize_email_thread", { subject: openMsg.subject, preview: threadText.slice(0, 2000) })) as string;
    setSummary(s);
    setAiLoading(null);
  }
  async function runCategorize() {
    if (!openMsg) return;
    setAiLoading("categorize");
    const c = (await generateAI("Analyst", "categorize_email", { from_email: openMsg.fromEmail, subject: openMsg.subject })) as { label: string; reasoning: string };
    setCategory(c);
    setAiLoading(null);
  }
  async function runDraft() {
    if (!openMsg) return;
    setAiLoading("draft");
    const d = (await generateAI("Writer", "draft_email_reply", { subject: openMsg.subject, preview: openMsg.body.slice(0, 1000) })) as { subject: string; body: string };
    setDraft({ ...d, to: openMsg.fromEmail });
    setAiLoading(null);
  }

  async function handleSend() {
    if (!draft || !selectedOrgId) return;
    setSending(true);
    try {
      const res = await fetch("/api/integrations/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrgId, to: draft.to, subject: draft.subject, body: draft.body }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Send failed");
      }
      toast.show("Email sent");
      setDraft(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return messages;
    const needle = q.toLowerCase();
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(needle) ||
        m.from.toLowerCase().includes(needle) ||
        m.fromEmail.toLowerCase().includes(needle) ||
        m.snippet.toLowerCase().includes(needle),
    );
  }, [messages, q]);

  const counts = useMemo(() => ({
    Inbox: messages.length,
    Starred: 0,
    Sent: 0,
    Drafts: 0,
  }), [messages]);

  if (!connected) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Mail</h1>
          <p className="mt-1 text-body text-neutral-600">Gmail — inbox</p>
        </div>
        <CommunicationBanner service="Gmail" connectHref="/admin/integrations" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Mail</h1>
        <p className="mt-1 text-body text-neutral-600">Gmail — inbox</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3 glass p-3 rounded-md">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="space-y-0.5">
            {TABS.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => { setTab(t); setOpenThreadId(null); }}
                  className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-body ${
                    tab === t ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <TabIcon tab={t} className={`h-4 w-4 shrink-0 ${tab === t ? "text-primary-700" : "text-neutral-500"}`} />
                  <span className="flex-1 text-left">{t}</span>
                  {tab === t && <span className="text-caption text-neutral-500">{counts[t]}</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-h-[500px] glass-card">
          {openThreadId && openMsg ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={openMsg.from} size={9} />
                  <div className="min-w-0">
                    <p className="truncate font-heading text-h3 font-semibold text-neutral-950">{openMsg.subject}</p>
                    <p className="truncate text-caption text-neutral-500">{openMsg.from} · {openMsg.fromEmail}</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => { setOpenThreadId(null); setThread([]); }}>Back to list</Button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-2">
                <AiPill onClick={runSummary} loading={aiLoading === "summary"} label="AI: Summarize thread" />
                <AiPill onClick={runDraft} loading={aiLoading === "draft"} label="AI: Draft reply" />
                <AiPill onClick={runCategorize} loading={aiLoading === "categorize"} label="AI: Categorize" />
                <span className="flex-1" />
                <Button variant="secondary" onClick={runDraft}>Reply</Button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {threadLoading ? (
                  <SectionSkeleton variant="text" />
                ) : thread.length === 0 ? (
                  <p className="text-body text-neutral-600">{openMsg.snippet}</p>
                ) : (
                  thread.map((m) => (
                    <div key={m.id} className="flex gap-3 glass-card rounded-md p-3">
                      <Avatar name={m.from} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-body-medium font-semibold text-neutral-950">{m.from}</span>
                          <span className="text-caption text-neutral-500">{new Date(m.date).toLocaleString()}</span>
                        </div>
                        <p className="text-caption text-neutral-500">to {m.to.join(", ")}</p>
                        <p className="mt-2 whitespace-pre-wrap text-body text-neutral-800">{m.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {summary && (
                <div className="mx-4 mb-4 space-y-2 overflow-hidden rounded-md glass-card border-ai-600/40">
                  <AiBanner label="AI summary" />
                  <p className="whitespace-pre-wrap px-4 pb-3 text-body text-neutral-800">{summary}</p>
                  <div className="flex justify-end gap-2 px-4 pb-3">
                    <Button variant="secondary" onClick={() => setSummary(null)}>Close</Button>
                  </div>
                </div>
              )}

              {category && (
                <div className="mx-4 mb-4 space-y-2 overflow-hidden rounded-md glass-card border-ai-600/40">
                  <AiBanner label="AI categorization" />
                  <div className="px-4 pb-3">
                    <p className="text-body-medium font-semibold text-neutral-950">Suggested: {category.label}</p>
                    <p className="text-small text-neutral-600">{category.reasoning}</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" onClick={() => setCategory(null)}>Close</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : loading ? (
            <PageSkeleton variant="chat" />
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-body text-danger-600">{error}</p>
              <Button variant="secondary" className="mt-3" onClick={() => fetchMessages()}>Retry</Button>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-neutral-200">
                {filtered.length === 0 ? (
                  <li className="p-8 text-center text-body text-neutral-500">No emails in this view.</li>
                ) : (
                  filtered.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => openThread(e.threadId)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100 ${
                          e.isUnread ? "bg-neutral-50" : "bg-neutral-100/40"
                        }`}
                      >
                        <span className="w-2 shrink-0">{e.isUnread && <span className="block h-2 w-2 rounded-full bg-primary-600" />}</span>
                        <Avatar name={e.from} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className={`truncate text-body ${e.isUnread ? "font-semibold text-neutral-950" : "text-neutral-700"}`}>
                              {e.from}
                            </span>
                            {e.isStarred && (
                              <svg className="h-3.5 w-3.5 shrink-0 text-warning-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                              </svg>
                            )}
                            <span className="ml-auto shrink-0 text-caption text-neutral-500">
                              {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          <p className={`truncate text-small ${e.isUnread ? "font-medium text-neutral-950" : "text-neutral-600"}`}>{e.subject}</p>
                          <p className="truncate text-caption text-neutral-500">{e.snippet}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {e.hasAttachments && (
                            <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                          {e.isUnread && <Badge color="info">New</Badge>}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              {nextPageToken && (
                <div className="border-t border-neutral-200 p-3 text-center">
                  <Button variant="secondary" onClick={() => fetchMessages(nextPageToken)}>Load more</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {draft && (
        <Modal onClose={() => setDraft(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <AiBanner label="AI drafted reply" />
            <div>
              <p className="text-caption text-neutral-500">To</p>
              <Input className="w-full" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </div>
            <div>
              <p className="text-caption text-neutral-500">Subject</p>
              <Input className="w-full" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div>
              <p className="text-caption text-neutral-500">Body</p>
              <Textarea rows={8} className="w-full" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
              <Button variant="secondary" onClick={() => setDraft(null)}>Discard</Button>
              <Button onClick={handleSend} disabled={sending}>{sending ? "Sending…" : "Send reply"}</Button>
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
