"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { AiBanner } from "@/components/ui/AiBanner";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { mockZoom, type ZoomMeeting } from "@/lib/mock/communication";
import { generateAI } from "@/lib/ai/generate";

function inLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "started";
  const hrs = Math.round(diff / 3600000);
  if (hrs < 1) return "starting soon";
  if (hrs < 24) return `in ${hrs} hours`;
  return `in ${Math.round(hrs / 24)} days`;
}

export default function VideoPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [view, setView] = useState<"list" | "week">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(false);
  const [ai, setAi] = useState<{ summary: string; action_items: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const list = tab === "upcoming" ? mockZoom.upcoming : mockZoom.past;
  const open = openId ? list.find((m) => m.id === openId) : null;

  async function summarize(m: ZoomMeeting) {
    setLoading(true);
    setAi(null);
    const r = (await generateAI("Analyst", "summarize_meeting", { title: m.title })) as {
      summary: string;
      action_items: string[];
    };
    setAi(r);
    setLoading(false);
  }
  function joinMock(m: ZoomMeeting) {
    console.log("Join meeting (mock):", m.join_url);
    toast.show("Mock mode — not sent");
  }
  function copyLink(m: ZoomMeeting) {
    navigator.clipboard.writeText(m.join_url).catch(() => {});
    toast.show("Link copied");
  }
  function createTask(title: string) {
    console.log("Create task from meeting action (TODO):", title);
    toast.show("Task creation stub — logged to console");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Video</h1>
          <p className="mt-1 text-body text-neutral-600">Google Meet — upcoming and past meetings</p>
        </div>
        <Button onClick={() => setSchedule(true)}>+ Schedule meeting</Button>
      </div>

      <CommunicationBanner service="Google Meet" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setOpenId(null); }}
              className={`rounded-sm px-3 py-1.5 text-body-medium font-medium ${
                tab === t ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {t === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
          {(["list", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-sm px-3 py-1.5 text-body-medium font-medium ${
                view === v ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {v === "list" ? "List" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {view === "week" && <WeekStrip meetings={list} onOpen={setOpenId} />}

      {view === "list" && <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((m) => (
          <li key={m.id} className="rounded-md border border-neutral-300 bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading text-body-medium font-semibold text-neutral-950">{m.title}</p>
                <p className="mt-0.5 text-caption text-neutral-500">
                  {new Date(m.start_time).toLocaleString()} · {m.duration_minutes} min
                </p>
              </div>
              {tab === "upcoming" && <Badge color="warning">{inLabel(m.start_time)}</Badge>}
              {tab === "past" && (
                <div className="flex flex-wrap gap-1">
                  {m.has_transcript && <Badge color="info">Transcript</Badge>}
                  {m.has_recording && <Badge color="success">Recording</Badge>}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex -space-x-1.5">
                {m.participants.map((p) => (
                  <span
                    key={p.name}
                    title={p.name}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-50 bg-primary-100 text-caption font-semibold text-primary-700"
                  >
                    {p.avatar_initial}
                  </span>
                ))}
              </div>
              <span className="text-caption text-neutral-500 self-center">{m.participants.length} participants</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tab === "upcoming" ? (
                <>
                  <Button onClick={() => joinMock(m)}>Join via Google Meet</Button>
                  <Button variant="secondary" onClick={() => copyLink(m)}>Copy link</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setOpenId(m.id)}>View details</Button>
                  {m.has_transcript && (
                    <button
                      type="button"
                      onClick={() => summarize(m)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
                    >
                      {loading ? "Thinking…" : "AI: Summarize meeting"}
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>}

      {open && (
        <Modal onClose={() => { setOpenId(null); setAi(null); }} maxWidth="max-w-2xl">
          <div className="space-y-3">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">{open.title}</h3>
            <p className="text-caption text-neutral-500">
              {new Date(open.start_time).toLocaleString()} · {open.duration_minutes} min · {open.participants.length} participants
            </p>
            <div>
              <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">Participants</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {open.participants.map((p) => (
                  <li key={p.name} className="rounded-full bg-neutral-100 px-2 py-1 text-small text-neutral-700">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
            {open.transcript_preview && (
              <div>
                <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">Transcript preview</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-small text-neutral-800">
                  {open.transcript_preview}
                </pre>
              </div>
            )}
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
                        <button type="button" onClick={() => createTask(a)} className="shrink-0 text-caption font-medium text-primary-700 hover:underline">
                          Create task
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {schedule && (
        <Modal onClose={() => setSchedule(false)} maxWidth="max-w-md">
          <div className="space-y-3">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Schedule meeting</h3>
            <p className="text-body text-neutral-800">
              Google Meet scheduling lands with the real connector — the UI wiring is Phase 7.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setSchedule(false)}>Got it</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Compact 7-day strip: one column per day starting today, each with the
// meetings that fall on it as small clickable pills. Not a Gantt/grid — the
// full time-slotted week calendar would be overbuilt at this app's scale
// (single-digit meetings a week). This gives the "what's this week" glance
// without the layout cost.
function WeekStrip({ meetings, onOpen }: { meetings: ZoomMeeting[]; onOpen: (id: string) => void }) {
  const days: { iso: string; label: string; dayNum: number; meetings: ZoomMeeting[] }[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      iso,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      dayNum: d.getDate(),
      meetings: meetings.filter((m) => m.start_time.slice(0, 10) === iso).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    });
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  const total = days.reduce((s, d) => s + d.meetings.length, 0);

  if (total === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <p className="font-medium text-neutral-950">No meetings this week</p>
        <p className="mt-1 text-small text-neutral-600">Anything scheduled in the next 7 days will show here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const isToday = d.iso === todayIso;
        return (
          <div key={d.iso} className={`min-h-32 rounded-md border bg-neutral-50 p-2 ${isToday ? "border-primary-600" : "border-neutral-300"}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className={`text-caption font-medium uppercase tracking-wide ${isToday ? "text-primary-700" : "text-neutral-500"}`}>
                {d.label}
              </span>
              <span className={`font-heading text-body-medium font-semibold ${isToday ? "text-primary-700" : "text-neutral-950"}`}>
                {d.dayNum}
              </span>
            </div>
            <ul className="space-y-1">
              {d.meetings.length === 0 ? (
                <li className="text-caption text-neutral-400">—</li>
              ) : (
                d.meetings.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(m.id)}
                      title={m.title}
                      className="block w-full truncate rounded-sm bg-primary-100 px-2 py-1 text-left text-caption text-primary-700 hover:bg-primary-100/70"
                    >
                      <span className="font-medium">
                        {new Date(m.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>{" "}
                      {m.title}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
