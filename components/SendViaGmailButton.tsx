"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Field } from "@/components/ui/Input";

// Mirrors components/SendViaSlackButton.tsx — renders nothing if the org
// hasn't connected Gmail or the viewer can't see integration status.
export function SendViaGmailButton({ orgId, defaultSubject }: { orgId: string; defaultSubject?: string }) {
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
        setConnected(rows.some((r) => r.provider === "gmail" && r.status === "connected"));
      })
      .finally(() => setChecked(true));
  }, [orgId, canUse]);

  if (!checked || !canUse || !connected) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setShowModal(true)}>
        Send via Gmail
      </Button>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <SendGmailForm orgId={orgId} defaultSubject={defaultSubject} onClose={() => setShowModal(false)} />
        </Modal>
      )}
    </>
  );
}

function SendGmailForm({ orgId, defaultSubject, onClose }: { orgId: string; defaultSubject?: string; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !subject || !body) return;
    setSending(true);
    setError(null);

    const res = await fetch("/api/integrations/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, to, subject, body }),
    });
    const responseBody = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(responseBody.error ?? "Failed to send");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h2 className="text-h2 font-semibold text-neutral-950">Sent</h2>
        <p className="text-body text-neutral-600">Email sent via Gmail.</p>
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">Send via Gmail</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="To">
        <Input type="email" className="w-full" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" autoFocus />
      </Field>
      <Field label="Subject">
        <Input className="w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Message">
        <textarea
          className="w-full rounded-sm border border-neutral-300 bg-neutral-50 px-3 py-2 text-body focus:outline focus:outline-2 focus:outline-primary-600"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={sending || !to || !subject || !body}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
