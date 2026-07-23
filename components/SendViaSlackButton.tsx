"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Field } from "@/components/ui/Input";

// Contextual "Send via Slack" action (Prompt 7.1) — renders nothing if the
// org hasn't connected Slack or the viewer can't see integration status,
// rather than showing a disabled/dead button. Reusable anywhere a quick
// external notification makes sense (currently: project detail header).
export function SendViaSlackButton({ orgId, defaultText }: { orgId: string; defaultText?: string }) {
  const { can } = useOrg();
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const canUse = can("integration", "read");

  useEffect(() => {
    if (!canUse) {
      setChecked(true);
      return;
    }
    fetch(`/api/integrations?org_id=${orgId}`)
      .then((r) => r.json())
      .then((body) => {
        const rows = (body.data ?? []) as { provider: string; status: string }[];
        setConnected(rows.some((r) => r.provider === "slack" && r.status === "connected"));
      })
      .finally(() => setChecked(true));
  }, [orgId, canUse]);

  if (!checked || !canUse || !connected) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setShowModal(true)}>
        Send via Slack
      </Button>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <SendSlackForm orgId={orgId} defaultText={defaultText} onClose={() => setShowModal(false)} />
        </Modal>
      )}
    </>
  );
}

function SendSlackForm({ orgId, defaultText, onClose }: { orgId: string; defaultText?: string; onClose: () => void }) {
  const [channel, setChannel] = useState("");
  const [text, setText] = useState(defaultText ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!channel || !text) return;
    setSending(true);
    setError(null);

    const res = await fetch("/api/integrations/slack/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, channel, text }),
    });
    const body = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to send");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h2 className="text-h2 font-semibold text-neutral-950">Sent</h2>
        <p className="text-body text-neutral-600">Message posted to Slack.</p>
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">Send via Slack</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Channel">
        <Input className="w-full" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="#general" autoFocus />
      </Field>
      <Field label="Message">
        <textarea
          className="w-full rounded-sm border border-neutral-300 bg-neutral-50 px-3 py-2 text-body focus:outline focus:outline-2 focus:outline-primary-600"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={sending || !channel || !text}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
