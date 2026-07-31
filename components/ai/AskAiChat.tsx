"use client";

import { useEffect, useRef, useState } from "react";
import { AiBanner } from "@/components/ui/AiBanner";
import { Avatar, Pill } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";

export const ASK_AI_CONVERSATION_KEY = "centr8_ask_ai_conversation_id";

export type Citation = { source_type: string; source_title: string; excerpt: string };
export type Message = { id: string; role: "user" | "assistant"; content: string; citations?: Citation[] | null };

const STARTERS = ["What's overdue?", "Which project is at risk?", "Who's overloaded?"];

function useCurrentUserName() {
  const [name, setName] = useState("You");
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const email = data.user?.email;
        if (email) setName(email.split("@")[0]);
      });
  }, []);
  return name;
}

// Reveals the (already fully-received) answer word-by-word so it reads like
// a live stream, matching the Claude/ChatGPT typing feel the mock's instant
// response otherwise lacks. Purely a client-side reveal — generateAI()
// still returns the whole answer in one shot, there is no real token stream.
function useStreamedText(fullText: string, active: boolean) {
  const [shown, setShown] = useState(active ? "" : fullText);
  useEffect(() => {
    if (!active) {
      setShown(fullText);
      return;
    }
    setShown("");
    const words = fullText.split(" ");
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setShown(words.slice(0, i).join(" "));
      if (i >= words.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText]);
  return shown;
}

export function useAskAiConversation(orgId: string | null) {
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  useEffect(() => {
    setConversationIdState(localStorage.getItem(ASK_AI_CONVERSATION_KEY));
  }, []);

  function setConversationId(id: string | null) {
    setConversationIdState(id);
    if (id) localStorage.setItem(ASK_AI_CONVERSATION_KEY, id);
    else localStorage.removeItem(ASK_AI_CONVERSATION_KEY);
  }

  function loadMessages(id: string) {
    fetch(`/api/ai/conversations/${id}`)
      .then((r) => r.json())
      .then((body) => setMessages(body.data?.messages ?? []));
  }

  useEffect(() => {
    if (conversationId) loadMessages(conversationId);
    else setMessages([]);
  }, [conversationId]);

  async function createConversation(title?: string) {
    if (!orgId) return null;
    const res = await fetch("/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, title }),
    });
    const body = await res.json();
    if (!res.ok) return null;
    setConversationId(body.data.id);
    return body.data.id as string;
  }

  async function sendMessage(question: string, convId?: string) {
    const id = convId ?? conversationId;
    if (!id || !question.trim()) return;
    setSending(true);
    setMessages((cur) => [...cur, { id: `temp-${Date.now()}`, role: "user", content: question }]);
    const res = await fetch(`/api/ai/conversations/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const body = await res.json();
    setSending(false);
    if (res.ok) {
      setStreamingId(body.data.assistantMessage.id);
      loadMessages(id);
    }
  }

  async function sendStarter(text: string) {
    const id = await createConversation();
    if (id) await sendMessage(text, id);
  }

  return { conversationId, setConversationId, messages, sending, streamingId, sendMessage, sendStarter, createConversation, loadMessages };
}

export function StarterChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {STARTERS.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-small text-neutral-700 hover:bg-neutral-100"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// Big centered ai-600 icon + headline, replacing the plain empty box —
// same "what can I help with" framing as Claude/ChatGPT's own empty state.
// `compact` drops the icon size and copy for the floating widget's smaller
// footprint.
export function HeroEmptyState({ onPick, compact }: { onPick: (text: string) => void; compact?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className={`flex items-center justify-center rounded-full bg-ai-100 text-ai-600 ${compact ? "h-12 w-12" : "h-16 w-16"}`}>
        <svg className={compact ? "h-6 w-6" : "h-8 w-8"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
        </svg>
      </span>
      <div>
        <p className={compact ? "text-body-medium font-semibold text-neutral-950" : "text-h3 font-semibold text-neutral-950"}>
          What can I help with?
        </p>
        {!compact && <p className="mt-1 text-small text-neutral-600">Ask about projects, people, deals — anything in this workspace.</p>}
      </div>
      <StarterChips onPick={onPick} />
    </div>
  );
}

// Minimal **bold** markdown parser — the mock answers use it for scannable
// key phrases (matching the Claude/ChatGPT reference this was built
// against). No markdown dependency: the only syntax supported is **bold**.
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai-600" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function AiAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai-100 text-ai-600">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
      </svg>
    </span>
  );
}

function AssistantMessage({ message, streaming }: { message: Message; streaming: boolean }) {
  const shown = useStreamedText(message.content, streaming);
  const done = shown.length >= message.content.length;
  return (
    <div className="flex justify-start gap-2">
      <AiAvatar />
      <div className="max-w-[85%] overflow-hidden rounded-md border border-ai-600/40">
        <AiBanner label="AI-generated · verify before acting" />
        <p className="whitespace-pre-wrap px-4 py-3 text-body text-neutral-800">
          {renderMarkdown(shown)}
          {!done && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-ai-600 align-middle" />}
        </p>
        {done && message.citations && message.citations.length > 0 && (
          <div className="space-y-1 border-t border-neutral-200 px-4 py-2">
            <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">Sources</p>
            <div className="flex flex-wrap gap-1">
              {message.citations.map((c, i) => (
                <Pill key={i}>
                  {c.source_type}: {c.source_title}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Shown above the input for a conversation that's been created but has no
// messages yet — otherwise that state was a blank pane above the starter
// chips (reported as confusing: "can't see" the assistant at all).
function Greeting() {
  return (
    <div className="flex justify-start gap-2">
      <AiAvatar />
      <div className="max-w-[85%] rounded-md bg-ai-100 px-4 py-3 text-body text-neutral-800">
        Hi — how can I help you today?
      </div>
    </div>
  );
}

export function MessageList({ messages, sending, streamingId }: { messages: Message[]; sending: boolean; streamingId?: string | null }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const userName = useCurrentUserName();
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.length === 0 && !sending && <Greeting />}
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end gap-2">
            <div className="max-w-[80%] rounded-md bg-primary-600 px-3 py-2 text-body text-neutral-50">{m.content}</div>
            <Avatar name={userName} />
          </div>
        ) : (
          <AssistantMessage key={m.id} message={m} streaming={m.id === streamingId} />
        ),
      )}
      {sending && (
        <div className="flex justify-start gap-2">
          <AiAvatar />
          <div className="overflow-hidden rounded-md border border-ai-600/40">
            <TypingDots />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  }
  return (
    <div className="flex items-end gap-2 border-t border-neutral-300 p-3">
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask about overdue tasks, budgets, team gaps…"
        className="flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-body focus:border-primary-600 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="rounded-md bg-ai-600 px-4 py-2 text-body-medium font-medium text-neutral-50 hover:bg-ai-600/90 disabled:opacity-60"
      >
        Ask
      </button>
    </div>
  );
}
