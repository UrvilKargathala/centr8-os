"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { ACTIVITY_TYPES } from "@/lib/constants";

type Activity = {
  id: string;
  type: (typeof ACTIVITY_TYPES)[number];
  notes: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
};

const TYPE_LABEL: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  call: "Call",
  meeting: "Meeting",
  task: "Task",
  note: "Note",
  email: "Email",
};

// Attaches to any CRM entity via relatedType/relatedId — generic on
// purpose (Prompt 6.2: "activities attach to any CRM entity as a simple
// timeline"), currently only mounted from the deal detail modal since
// leads/contacts/accounts don't have detail views yet to host it in.
export function ActivityTimeline({
  orgId,
  relatedType,
  relatedId,
  canEdit,
}: {
  orgId: string;
  relatedType: "lead" | "contact" | "account" | "deal";
  relatedId: string;
  canEdit: boolean;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>("note");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/activities?org_id=${orgId}&related_type=${relatedType}&related_id=${relatedId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load activities");
        setActivities(
          [...body.data].sort((a: Activity, b: Activity) => b.createdAt.localeCompare(a.createdAt)),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load activities"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId, relatedType, relatedId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return;
    setSaving(true);
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, related_type: relatedType, related_id: relatedId, type, notes }),
    });
    setSaving(false);
    if (!res.ok) return;
    setNotes("");
    load();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-h3 font-semibold text-neutral-950">Activity</h3>

      {canEdit && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-start gap-2 rounded-md border border-neutral-300 bg-neutral-100 p-3">
          <Select className="w-32" value={type} onChange={(e) => setType(e.target.value as (typeof ACTIVITY_TYPES)[number])}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Input
            className="min-w-[12rem] flex-1"
            placeholder="Log a call, note, meeting…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button type="submit" disabled={saving || !notes.trim()}>
            {saving ? "Adding…" : "Log"}
          </Button>
        </form>
      )}

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      {loading ? (
        <p className="text-body text-neutral-600">Loading activity…</p>
      ) : activities.length === 0 ? (
        <p className="text-body text-neutral-600">No activity logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-md border border-neutral-200 p-3">
              <span className="mt-0.5 shrink-0 rounded-sm bg-neutral-200 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-neutral-600">
                {TYPE_LABEL[a.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body text-neutral-950">{a.notes ?? "—"}</p>
                <p className="text-small text-neutral-500">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
