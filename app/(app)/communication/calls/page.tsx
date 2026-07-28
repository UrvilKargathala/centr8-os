"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AiBanner } from "@/components/ui/AiBanner";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { mockCalls, type CallLogEntry } from "@/lib/mock/communication";
import { generateAI } from "@/lib/ai/generate";

const FILTERS = ["all", "incoming", "outgoing", "missed"] as const;

function fmtDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.round(diff / 3600000);
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export default function CallsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [ai, setAi] = useState<{ summary: string; action_items: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const rows = useMemo(() => (filter === "all" ? mockCalls.log : mockCalls.log.filter((c) => c.direction === filter)), [filter]);
  const open = openId ? mockCalls.log.find((c) => c.id === openId) : null;

  function openCall(c: CallLogEntry) {
    setOpenId(c.id);
    setNotes(c.notes ?? "");
    setAi(null);
  }
  async function summarize() {
    if (!open) return;
    setLoading(true);
    const r = (await generateAI("Writer", "summarize_call", { participant: open.participant_name, notes: open.notes })) as {
      summary: string;
      action_items: string[];
    };
    setAi(r);
    setLoading(false);
  }
  function saveNotes() {
    console.log("Save call notes (mock):", { callId: openId, notes });
    toast.show("Notes saved (mock)");
  }
  function createTask(title: string) {
    console.log("Create task from action item (TODO):", title);
    toast.show("Task creation stub — logged to console");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Calls</h1>
        <p className="mt-1 text-body text-neutral-600">Call log</p>
        <p className="mt-1 text-caption text-neutral-500">
          Log calls from your connected phone system. Connect a provider in Integrations.
        </p>
      </div>

      <CommunicationBanner service="Phone system" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-h3 font-semibold text-neutral-950">Recent calls</h2>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as (typeof FILTERS)[number])} className="w-40">
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-md border border-neutral-300 bg-neutral-50">
          <table className="w-full min-w-[640px] text-body">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-3 py-2" />
                <th className="px-4 py-2">Participant</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((c) => {
                const tone = c.direction === "missed" ? "text-danger-600" : c.direction === "incoming" ? "text-success-600" : "text-info-600";
                return (
                  <tr
                    key={c.id}
                    onClick={() => openCall(c)}
                    className={`cursor-pointer hover:bg-neutral-100 ${openId === c.id ? "bg-primary-100" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <svg className={`h-4 w-4 ${tone}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {c.direction === "outgoing" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H8M17 7v9" />
                        ) : c.direction === "incoming" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 7L7 17M7 17h9M7 17V8" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-caption font-semibold text-neutral-700">
                          {c.avatar_initial}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-950">{c.participant_name}</p>
                          <p className="truncate text-caption text-neutral-500">{c.participant_phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-small text-neutral-700">{fmtDuration(c.duration_seconds)}</td>
                    <td className="px-4 py-3 text-small text-neutral-700">{relTime(c.occurred_at)}</td>
                    <td className="px-4 py-3">
                      {c.linked_contact_id ? (
                        <span className="rounded-full bg-info-100 px-2 py-0.5 text-caption text-info-600">
                          {c.linked_contact_name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toast.show("Link contact — coming soon"); }}
                          className="text-small text-primary-700 hover:underline"
                        >
                          Link contact
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="min-h-[300px] rounded-md border border-neutral-300 bg-neutral-50 p-4">
          {!open ? (
            <p className="text-body text-neutral-500">Select a call to see details.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-heading text-h3 font-semibold text-neutral-950">{open.participant_name}</p>
                <p className="text-caption text-neutral-500">{open.participant_phone}</p>
              </div>
              <div className="flex gap-2 text-caption text-neutral-600">
                <Badge color={open.direction === "missed" ? "danger" : open.direction === "incoming" ? "success" : "info"}>{open.direction}</Badge>
                <span>{fmtDuration(open.duration_seconds)}</span>
                <span>· {relTime(open.occurred_at)}</span>
              </div>
              <div>
                <label className="text-caption text-neutral-500">Notes</label>
                <Textarea rows={4} className="w-full" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Log what you covered…" />
                <div className="mt-1 flex justify-end">
                  <Button variant="secondary" onClick={saveNotes}>Save notes</Button>
                </div>
              </div>
              <button
                type="button"
                onClick={summarize}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
              >
                {loading ? "Thinking…" : "AI: Summarize call"}
              </button>
              {ai && (
                <div className="space-y-2 overflow-hidden rounded-md border border-ai-600/40">
                  <AiBanner />
                  <div className="space-y-2 px-4 pb-3">
                    <p className="text-body text-neutral-800">{ai.summary}</p>
                    <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">Action items</p>
                    <ul className="space-y-1">
                      {ai.action_items.map((a) => (
                        <li key={a} className="flex items-start justify-between gap-2 rounded-md bg-neutral-100 px-2 py-1">
                          <span className="text-small text-neutral-800">{a}</span>
                          <button
                            type="button"
                            onClick={() => createTask(a)}
                            className="shrink-0 text-caption font-medium text-primary-700 hover:underline"
                          >
                            Create task
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
