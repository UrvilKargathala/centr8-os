"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AiBanner } from "@/components/ui/AiBanner";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { mockSlack } from "@/lib/mock/communication";
import { generateAI } from "@/lib/ai/generate";

export default function MessengerPage() {
  const [activeId, setActiveId] = useState<string>("c-eng");
  const [reply, setReply] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const toast = useToast();

  const channel = mockSlack.channels.find((c) => c.id === activeId);
  const dm = mockSlack.dms.find((d) => d.id === activeId);
  const active = channel ?? dm;
  const messages = mockSlack.messages_by_channel[activeId] ?? [];

  async function summarize() {
    if (!channel) return;
    setSummaryLoading(true);
    const s = (await generateAI("Analyst", "summarize_channel", { channel: channel.name })) as string;
    setSummary(s);
    setSummaryLoading(false);
  }
  async function draftReply() {
    setDraftLoading(true);
    const preview = messages[messages.length - 1]?.content ?? "";
    const d = (await generateAI("Writer", "draft_slack_reply", { preview })) as string;
    setDraft(d);
    setDraftLoading(false);
  }
  function send() {
    console.log("Slack send (mock):", { channel: activeId, content: reply });
    setReply("");
    toast.show("Mock mode — not sent");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Messenger</h1>
        <p className="mt-1 text-body text-neutral-600">Slack — channels and DMs</p>
      </div>

      <CommunicationBanner service="Slack" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-md border border-neutral-300 bg-neutral-50 p-3">
          <div>
            <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-neutral-500">Channels</p>
            <ul className="space-y-0.5">
              {mockSlack.channels.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body ${
                      activeId === c.id ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="text-neutral-500">#</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.unread_count > 0 && (
                      <span className="rounded-full bg-primary-600 px-1.5 text-caption font-semibold text-neutral-50">{c.unread_count}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-neutral-500">Direct messages</p>
            <ul className="space-y-0.5">
              {mockSlack.dms.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(d.id)}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body ${
                      activeId === d.id ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-caption font-semibold text-neutral-700">
                      {d.avatar_initial}
                    </span>
                    <span className="flex-1 truncate">{d.user_name}</span>
                    {d.unread_count > 0 && (
                      <span className="rounded-full bg-primary-600 px-1.5 text-caption font-semibold text-neutral-50">{d.unread_count}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex min-h-[500px] flex-col rounded-md border border-neutral-300 bg-neutral-50">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="text-body-medium font-semibold text-neutral-950">
                {channel ? `#${channel.name}` : dm?.user_name ?? ""}
              </p>
              {channel && <p className="text-caption text-neutral-500">{channel.member_count} members</p>}
            </div>
            {channel && (
              <button
                type="button"
                onClick={summarize}
                disabled={summaryLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
              >
                {summaryLoading ? "Thinking…" : "AI: Summarize this channel today"}
              </button>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-center text-body text-neutral-500">No messages in this channel yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                    {m.avatar_initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-body-medium font-semibold text-neutral-950">{m.sender_name}</span>
                      <span className="text-caption text-neutral-500">{new Date(m.sent_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-body text-neutral-800">{m.content}</p>
                    {m.reactions.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {m.reactions.map((r) => (
                          <span key={r.emoji} className="rounded-full bg-neutral-200 px-1.5 text-caption text-neutral-700">
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-neutral-200 p-3">
            <div className="flex items-start gap-2">
              <Input
                className="flex-1"
                placeholder={`Message ${channel ? `#${channel.name}` : dm?.user_name ?? ""}`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Button onClick={send} disabled={!reply.trim()}>Send via Slack</Button>
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
              <div className="space-y-2 overflow-hidden rounded-md border border-ai-600/40">
                <AiBanner />
                <div className="space-y-2 px-4 pb-3">
                  <p className="whitespace-pre-wrap text-body text-neutral-800">{draft}</p>
                  <div className="flex gap-2">
                    <Button onClick={() => { setReply(draft); setDraft(null); }}>Accept</Button>
                    <Button variant="secondary" onClick={() => setDraft(null)}>Reject</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {summary && (
        <Modal onClose={() => setSummary(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <AiBanner label="AI channel summary" />
            <pre className="whitespace-pre-wrap font-sans text-body text-neutral-800">{summary}</pre>
            <div className="flex justify-end">
              <Button onClick={() => setSummary(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {!active && <p className="text-body text-neutral-500">Pick a channel or DM.</p>}
    </div>
  );
}
