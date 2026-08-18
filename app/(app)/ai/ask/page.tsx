"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DeleteIconButton } from "@/components/ui/Avatar";
import { PageSkeleton } from "@/components/ui/skeleton";
import {
  ASK_AI_CONVERSATION_KEY,
  ChatInput,
  HeroEmptyState,
  MessageList,
  StarterChips,
  useAskAiConversation,
} from "@/components/ai/AskAiChat";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type Conversation = { id: string; title: string; updatedAt: string };

export default function AskAiPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const { conversationId, setConversationId, messages, sending, streamingId, error, sendMessage, sendStarter, createConversation } =
    useAskAiConversation(selectedOrgId);

  function loadConversations() {
    if (!selectedOrgId) return;
    fetch(`/api/ai/conversations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => setConversations(body.data ?? []));
  }
  useEffect(loadConversations, [selectedOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep localStorage / other tabs (widget) in sync when switching here
  function selectConversation(id: string) {
    setConversationId(id);
  }

  async function newConversation() {
    const id = await createConversation();
    if (id) loadConversations();
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (conversationId === id) setConversationId(null);
    loadConversations();
  }

  const active = conversations.find((c) => c.id === conversationId) ?? null;

  async function saveTitle() {
    if (!conversationId || !titleDraft.trim()) {
      setTitleEditing(false);
      return;
    }
    await fetch(`/api/ai/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    setTitleEditing(false);
    loadConversations();
  }

  if (orgLoading) return <PageSkeleton variant="chat" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row">
      <div className="hidden w-[280px] shrink-0 flex-col rounded-md border border-neutral-300 bg-neutral-50 lg:flex">
        <div className="border-b border-neutral-300 p-3">
          <Button className="w-full" onClick={newConversation}>
            + New Conversation
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {conversations.length === 0 && <p className="p-2 text-small text-neutral-500">No conversations yet.</p>}
          {[...conversations]
            .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
            .map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between rounded-sm px-2 py-2 text-small ${
                  conversationId === c.id ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <button className="min-w-0 flex-1 truncate text-left" onClick={() => selectConversation(c.id)}>
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-caption text-neutral-500">{timeAgo(c.updatedAt)}</p>
                </button>
                <span className="opacity-0 group-hover:opacity-100">
                  <DeleteIconButton onClick={() => deleteConversation(c.id)} />
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-md border border-neutral-300 bg-neutral-50">
        {active ? (
          <div className="border-b border-neutral-300 p-3">
            {titleEditing ? (
              <Input
                autoFocus
                className="w-full"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              />
            ) : (
              <h1
                className="cursor-text text-h3 font-semibold text-neutral-950"
                onClick={() => {
                  setTitleDraft(active.title);
                  setTitleEditing(true);
                }}
              >
                {active.title}
              </h1>
            )}
          </div>
        ) : (
          <div className="border-b border-neutral-300 p-3">
            <h1 className="text-h3 font-semibold text-neutral-950">Ask AI</h1>
          </div>
        )}

        {!conversationId ? (
          <HeroEmptyState
            onPick={async (text) => {
              await sendStarter(text);
              loadConversations();
            }}
          />
        ) : (
          <>
            <MessageList messages={messages} sending={sending} streamingId={streamingId} error={error} />
            {messages.length === 0 && (
              <div className="px-4 pb-2">
                <StarterChips onPick={(text) => sendMessage(text)} />
              </div>
            )}
          </>
        )}

        {conversationId && (
          <ChatInput
            disabled={sending}
            onSend={async (text) => {
              await sendMessage(text);
              loadConversations();
            }}
          />
        )}
      </div>
    </div>
  );
}
