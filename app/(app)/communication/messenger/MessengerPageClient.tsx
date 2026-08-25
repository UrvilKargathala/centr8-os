"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AiBanner } from "@/components/ui/AiBanner";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { generateAI } from "@/lib/ai/generate";

export type ClickUpChatChannel = { id: string; name: string; type: "channel" | "dm"; memberCount: number };
type ClickUpChatMessage = { id: string; text: string; authorName: string; authorInitials: string; postedAt: string };
type ClickUpChatUser = { id: string; name: string; initials: string };

export function MessengerPageClient({
  initialConnected,
  initialChannels,
}: {
  initialConnected?: boolean;
  initialChannels?: ClickUpChatChannel[];
}) {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const toast = useToast();

  const [connected, setConnected] = useState<boolean | null>(initialConnected ?? null);
  const [channels, setChannels] = useState<ClickUpChatChannel[]>(initialChannels ?? []);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClickUpChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const [dmPickerOpen, setDmPickerOpen] = useState(false);
  const [members, setMembers] = useState<ClickUpChatUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [startingDm, setStartingDm] = useState(false);

  const skippedInitialConnected = useRef(initialConnected !== undefined);
  useEffect(() => {
    if (!selectedOrgId) return;
    if (skippedInitialConnected.current) {
      skippedInitialConnected.current = false;
      return;
    }
    fetch(`/api/integrations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const row = (body.data ?? []).find((i: { provider: string; status: string }) => i.provider === "clickup");
        setConnected(row?.status === "connected");
      });
  }, [selectedOrgId]);

  function loadChannels() {
    if (!selectedOrgId) return;
    setChannelsLoading(true);
    setChannelsError(null);
    fetch(`/api/integrations/clickup/channels?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load channels");
        setChannels(body.data);
      })
      .catch((err) => setChannelsError(err instanceof Error ? err.message : "Failed to load channels"))
      .finally(() => setChannelsLoading(false));
  }

  const skippedInitialChannels = useRef(!!initialChannels);
  useEffect(() => {
    if (!connected) return;
    if (skippedInitialChannels.current) {
      skippedInitialChannels.current = false;
      return;
    }
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, selectedOrgId]);

  // Auto-poll channels every 30s
  useEffect(() => {
    if (!connected || !selectedOrgId) return;
    const id = setInterval(loadChannels, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, selectedOrgId]);

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const refreshMessages = useCallback((channelId: string, silent = false) => {
    if (!selectedOrgId) return;
    if (!silent) {
      setActiveId(channelId);
      setMessagesLoading(true);
      setMessagesError(null);
      setSummary(null);
      setDraft(null);
    }
    fetch(`/api/integrations/clickup/channels/${channelId}/messages?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load messages");
        if (activeIdRef.current === channelId) setMessages(body.data);
      })
      .catch((err) => { if (!silent) setMessagesError(err instanceof Error ? err.message : "Failed to load messages"); })
      .finally(() => { if (!silent) setMessagesLoading(false); });
  }, [selectedOrgId]);

  function loadMessages(channelId: string) {
    refreshMessages(channelId, false);
  }

  // Auto-poll active channel messages every 10s
  useEffect(() => {
    if (!activeId || !selectedOrgId) return;
    const id = setInterval(() => refreshMessages(activeId, true), 10000);
    return () => clearInterval(id);
  }, [activeId, selectedOrgId, refreshMessages]);

  function send() {
    if (!selectedOrgId || !activeId || !reply.trim()) return;
    setSending(true);
    fetch(`/api/integrations/clickup/channels/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, message: reply }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.data?.sent) {
          setReply("");
          loadMessages(activeId);
        } else {
          toast.show(body.error ?? "Failed to send message");
        }
      })
      .finally(() => setSending(false));
  }

  async function summarize() {
    const channel = channels.find((c) => c.id === activeId);
    if (!channel) return;
    setSummaryLoading(true);
    const s = (await generateAI("Analyst", "summarize_channel", { channel: channel.name, messages })) as string;
    setSummary(s);
    setSummaryLoading(false);
  }

  async function draftReply() {
    setDraftLoading(true);
    const preview = messages[messages.length - 1]?.text ?? "";
    const d = (await generateAI("Writer", "draft_slack_reply", { preview })) as string;
    setDraft(d);
    setDraftLoading(false);
  }

  function openDmPicker() {
    setDmPickerOpen(true);
    if (!selectedOrgId || members.length > 0) return;
    setMembersLoading(true);
    fetch(`/api/integrations/clickup/users?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setMembers(body.data ?? []))
      .finally(() => setMembersLoading(false));
  }

  function startDm(memberId: string) {
    if (!selectedOrgId) return;
    setStartingDm(true);
    fetch(`/api/integrations/clickup/dm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, member_ids: [memberId] }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.data?.id) {
          setDmPickerOpen(false);
          loadChannels();
          loadMessages(body.data.id);
        } else {
          toast.show(body.error ?? "Failed to start DM");
        }
      })
      .finally(() => setStartingDm(false));
  }

  const active = channels.find((c) => c.id === activeId);
  const channelList = channels.filter((c) => c.type === "channel");
  const dmList = channels.filter((c) => c.type === "dm");

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Messenger</h1>
        <p className="mt-1 text-body text-neutral-600">ClickUp Chat — channels and direct messages</p>
      </div>

      {connected === false && (
        <CommunicationBanner service="ClickUp" connectHref="/admin/integrations" description="Connect it in Integrations to use Messenger." />
      )}

      {connected && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="glass space-y-4 p-3">
            <div>
              <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-neutral-500">Channels</p>
              {channelsLoading ? (
                <SectionSkeleton variant="list" />
              ) : channelsError ? (
                <p className="text-small text-danger-600">{channelsError}</p>
              ) : channelList.length === 0 ? (
                <p className="text-small text-neutral-500">No channels yet — create one in ClickUp to see it here.</p>
              ) : (
                <ul className="space-y-0.5">
                  {channelList.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => loadMessages(c.id)}
                        className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body ${
                          activeId === c.id ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <span className="text-neutral-500">#</span>
                        <span className="flex-1 truncate">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">Direct messages</p>
                <button type="button" onClick={openDmPicker} className="text-caption font-medium text-primary-700 underline">
                  + New DM
                </button>
              </div>
              {dmList.length === 0 ? (
                <p className="text-small text-neutral-500">No direct messages yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {dmList.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => loadMessages(d.id)}
                        className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body ${
                          activeId === d.id ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-caption font-semibold text-neutral-700">
                          {d.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="flex-1 truncate">{d.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <div className="glass-card flex min-h-[500px] flex-col">
            {!activeId ? (
              <p className="flex flex-1 items-center justify-center text-body text-neutral-500">Pick a channel or DM.</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <div>
                    <p className="text-body-medium font-semibold text-neutral-950">
                      {active?.type === "channel" ? `#${active.name}` : active?.name}
                    </p>
                    {active?.type === "channel" && <p className="text-caption text-neutral-500">{active.memberCount} members</p>}
                  </div>
                  <button
                    type="button"
                    onClick={summarize}
                    disabled={summaryLoading || messages.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
                  >
                    {summaryLoading ? "Thinking…" : "AI: Summarize this channel today"}
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {messagesLoading ? (
                    <SectionSkeleton variant="text" />
                  ) : messagesError ? (
                    <p className="text-center text-body text-danger-600">{messagesError}</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-body text-neutral-500">No messages in this channel yet.</p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700">
                          {m.authorInitials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-body-medium font-semibold text-neutral-950">{m.authorName}</span>
                            <span className="text-caption text-neutral-500">
                              {new Date(m.postedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-body text-neutral-800">{m.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 border-t border-neutral-200 p-3">
                  <div className="flex items-start gap-2">
                    <Input
                      className="flex-1"
                      placeholder={`Message ${active?.type === "channel" ? `#${active.name}` : active?.name ?? ""}`}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <Button onClick={send} disabled={sending || !reply.trim()}>
                      {sending ? "Sending…" : "Send"}
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

      {dmPickerOpen && (
        <Modal onClose={() => setDmPickerOpen(false)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <h2 className="text-h3 font-semibold text-neutral-950">Start a direct message</h2>
            {membersLoading ? (
              <SectionSkeleton variant="list" />
            ) : members.length === 0 ? (
              <p className="text-body text-neutral-600">No other workspace members found.</p>
            ) : (
              <ul className="max-h-72 space-y-0.5 overflow-y-auto">
                {members.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => startDm(m.id)}
                      disabled={startingDm}
                      className="flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left hover:bg-neutral-100 disabled:opacity-60"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-caption font-semibold text-neutral-700">
                        {m.initials}
                      </span>
                      <span className="text-body text-neutral-950">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setDmPickerOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
