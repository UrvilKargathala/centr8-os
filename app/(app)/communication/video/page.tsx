"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Field } from "@/components/ui/Input";
import { AiBanner } from "@/components/ui/AiBanner";
import { useToast } from "@/components/ui/Toast";
import { CommunicationBanner } from "@/components/CommunicationChrome";
import { generateAI } from "@/lib/ai/generate";

type GoogleMeeting = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetUrl: string | null;
  attendees: string[];
  htmlLink: string;
};

function inLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "started";
  const hrs = Math.round(diff / 3600000);
  if (hrs < 1) return "starting soon";
  if (hrs < 24) return `in ${hrs} hours`;
  return `in ${Math.round(hrs / 24)} days`;
}

export default function VideoPage() {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const toast = useToast();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [view, setView] = useState<"list" | "week">("list");
  const [upcoming, setUpcoming] = useState<GoogleMeeting[]>([]);
  const [past, setPast] = useState<GoogleMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState<GoogleMeeting | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [notesTemplate, setNotesTemplate] = useState<{ meeting: GoogleMeeting; text: string } | null>(null);
  const [notesLoading, setNotesLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    fetch(`/api/integrations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        const row = (body.data ?? []).find((i: { provider: string; status: string }) => i.provider === "google_meet");
        setConnected(row?.status === "connected");
      });
  }, [selectedOrgId]);

  function loadMeetings() {
    if (!selectedOrgId) return;
    setMeetingsLoading(true);
    setMeetingsError(null);
    const now = new Date();
    const lookback = new Date(now.getTime() - 30 * 86400000).toISOString();
    const lookahead = new Date(now.getTime() + 90 * 86400000).toISOString();

    Promise.all([
      fetch(`/api/integrations/google/meetings?org_id=${selectedOrgId}&time_min=${now.toISOString()}&time_max=${lookahead}`).then((r) => r.json()),
      fetch(`/api/integrations/google/meetings?org_id=${selectedOrgId}&time_min=${lookback}&time_max=${now.toISOString()}`).then((r) => r.json()),
    ])
      .then(([upcomingBody, pastBody]) => {
        if (!upcomingBody.data || !pastBody.data) throw new Error(upcomingBody.error ?? pastBody.error ?? "Failed to load meetings");
        setUpcoming(upcomingBody.data);
        setPast([...pastBody.data].reverse());
      })
      .catch((err) => setMeetingsError(err instanceof Error ? err.message : "Failed to load meetings"))
      .finally(() => setMeetingsLoading(false));
  }

  useEffect(() => {
    if (connected) loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, selectedOrgId]);

  function joinMeeting(m: GoogleMeeting) {
    if (m.meetUrl) window.open(m.meetUrl, "_blank", "noopener,noreferrer");
  }
  function copyLink(m: GoogleMeeting) {
    if (!m.meetUrl) return;
    navigator.clipboard.writeText(m.meetUrl).catch(() => {});
    toast.show("Link copied");
  }
  function cancelMeeting(m: GoogleMeeting) {
    if (!selectedOrgId) return;
    setCancelling(true);
    fetch(`/api/integrations/google/meetings/${m.id}?org_id=${selectedOrgId}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((body) => {
        if (body.data?.cancelled) {
          toast.show("Meeting cancelled");
          setCancelConfirm(null);
          loadMeetings();
        } else {
          toast.show(body.error ?? "Failed to cancel meeting");
        }
      })
      .finally(() => setCancelling(false));
  }
  async function draftNotes(m: GoogleMeeting) {
    setNotesLoading(m.id);
    const text = (await generateAI("Writer", "draft_meeting_notes_template", { title: m.title, attendees: m.attendees })) as string;
    setNotesTemplate({ meeting: m, text });
    setNotesLoading(null);
  }

  const list = tab === "upcoming" ? upcoming : past;

  if (orgLoading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Video</h1>
          <p className="mt-1 text-body text-neutral-600">Google Meet — upcoming and past meetings</p>
        </div>
        {connected && <Button onClick={() => setSchedule(true)}>+ Schedule Meeting</Button>}
      </div>

      {connected === false && (
        <CommunicationBanner service="Google Meet" connectHref="/admin/integrations" description="Connect it in Integrations to schedule and join meetings." />
      )}

      {connected && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
              {(["upcoming", "past"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
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

          {meetingsLoading ? (
            <p className="text-body text-neutral-500">Loading meetings…</p>
          ) : meetingsError ? (
            <p className="text-body text-danger-600">{meetingsError}</p>
          ) : (
            <>
              {view === "week" && <WeekStrip meetings={upcoming} onOpen={(m) => draftNotes(m)} />}

              {view === "list" &&
                (list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                    <p className="font-medium text-neutral-950">No {tab} meetings</p>
                    <p className="mt-1 text-small text-neutral-600">
                      {tab === "upcoming" ? "Schedule one to see it here." : "Nothing in the last 30 days."}
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {list.map((m) => (
                      <li key={m.id} className="rounded-md border border-neutral-300 bg-neutral-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-heading text-body-medium font-semibold text-neutral-950">{m.title}</p>
                            <p className="mt-0.5 text-caption text-neutral-500">{new Date(m.startTime).toLocaleString()}</p>
                          </div>
                          {tab === "upcoming" && (
                            <span className="shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-caption font-medium text-warning-600">
                              {inLabel(m.startTime)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.attendees.length > 0 ? (
                            <span className="text-caption text-neutral-500">{m.attendees.length} attendees</span>
                          ) : (
                            <span className="text-caption text-neutral-400">No attendees listed</span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {tab === "upcoming" ? (
                            <>
                              <Button onClick={() => joinMeeting(m)} disabled={!m.meetUrl}>
                                Join
                              </Button>
                              <Button variant="secondary" onClick={() => copyLink(m)} disabled={!m.meetUrl}>
                                Copy link
                              </Button>
                              <Button variant="secondary" onClick={() => setCancelConfirm(m)}>
                                Cancel
                              </Button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => draftNotes(m)}
                            disabled={notesLoading === m.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-ai-600 px-2.5 py-1 text-small font-medium text-ai-600 hover:bg-ai-100 disabled:opacity-60"
                          >
                            {notesLoading === m.id ? "Thinking…" : "AI: Draft meeting notes template"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
            </>
          )}
        </>
      )}

      {cancelConfirm && (
        <Modal onClose={() => setCancelConfirm(null)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Cancel meeting?</h3>
            <p className="text-body text-neutral-700">
              &quot;{cancelConfirm.title}&quot; will be removed from your Google Calendar and all attendees will be notified.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setCancelConfirm(null)}>
                Keep meeting
              </Button>
              <Button onClick={() => cancelMeeting(cancelConfirm)} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Cancel meeting"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {notesTemplate && (
        <Modal onClose={() => setNotesTemplate(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <AiBanner label="AI-drafted notes template — fill in during or after the meeting" />
            <pre className="whitespace-pre-wrap font-sans text-body text-neutral-800">{notesTemplate.text}</pre>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(notesTemplate.text).catch(() => {});
                  toast.show("Template copied");
                }}
              >
                Copy
              </Button>
              <Button onClick={() => setNotesTemplate(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {schedule && selectedOrgId && (
        <ScheduleMeetingModal
          orgId={selectedOrgId}
          onClose={() => setSchedule(false)}
          onCreated={() => {
            setSchedule(false);
            loadMeetings();
          }}
        />
      )}
    </div>
  );
}

function ScheduleMeetingModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");
  const [attendees, setAttendees] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ meetUrl: string | null } | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const startIso = new Date(`${date}T${startTime}:00`).toISOString();
      const endIso = new Date(`${date}T${endTime}:00`).toISOString();
      if (endIso <= startIso) { setError("End time must be after start time."); setSubmitting(false); return; }
      const attendeeEmails = attendees
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("/api/integrations/google/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          title: title.trim(),
          start_time: startIso,
          end_time: endIso,
          attendee_emails: attendeeEmails,
          description: description.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create meeting");
      setCreated({ meetUrl: body.data.meetUrl });
      toast.show("Meeting created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meeting");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Modal onClose={onCreated} maxWidth="max-w-sm">
        <div className="space-y-4 text-center">
          <h3 className="font-heading text-h3 font-semibold text-neutral-950">Meeting created</h3>
          {created.meetUrl ? (
            <>
              <p className="break-all text-small text-neutral-600">{created.meetUrl}</p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(created.meetUrl!).catch(() => {});
                    toast.show("Link copied");
                  }}
                >
                  Copy link
                </Button>
                <Button onClick={() => window.open(created.meetUrl!, "_blank", "noopener,noreferrer")}>Join now</Button>
              </div>
            </>
          ) : (
            <p className="text-body text-neutral-600">Created, but no Meet link came back — check the event in Google Calendar.</p>
          )}
          <Button variant="secondary" className="w-full" onClick={onCreated}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-3">
        <h3 className="font-heading text-h3 font-semibold text-neutral-950">Schedule meeting</h3>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" placeholder="Sprint review" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
          </Field>
          <Field label="Start">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full" />
          </Field>
          <Field label="End">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full" />
          </Field>
        </div>
        <Field label="Attendees (comma-separated emails)">
          <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} className="w-full" placeholder="a@example.com, b@example.com" />
        </Field>
        <Field label="Description (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" rows={3} />
        </Field>
        {error && <p className="rounded-md bg-danger-100 p-3 text-small text-danger-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create Meeting"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Compact 7-day strip: one column per day starting today, each with the
// meetings that fall on it as small clickable pills. Not a Gantt/grid — the
// full time-slotted week calendar would be overbuilt at this app's scale
// (single-digit meetings a week). This gives the "what's this week" glance
// without the layout cost. Clicking a pill opens the notes-template modal
// for that meeting — the old build's separate "view details" modal had
// nothing left to show once transcript/recording data was removed, so this
// reuses the one remaining secondary action instead of keeping a near-empty
// detail modal around.
function WeekStrip({ meetings, onOpen }: { meetings: GoogleMeeting[]; onOpen: (m: GoogleMeeting) => void }) {
  const days: { iso: string; label: string; dayNum: number; meetings: GoogleMeeting[] }[] = [];
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
      meetings: meetings.filter((m) => m.startTime.slice(0, 10) === iso).sort((a, b) => a.startTime.localeCompare(b.startTime)),
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
                      onClick={() => onOpen(m)}
                      title={m.title}
                      className="block w-full truncate rounded-sm bg-primary-100 px-2 py-1 text-left text-caption text-primary-700 hover:bg-primary-100/70"
                    >
                      <span className="font-medium">
                        {new Date(m.startTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
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
