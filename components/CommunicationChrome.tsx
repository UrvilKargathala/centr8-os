"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Shared connection banner + "Connect [service]" placeholder modal, used by
// every Communication sub-page while real Phase 7 wiring hasn't shipped yet.
// `connectHref`, when passed, is for a provider that's actually real (only
// ClickUp so far) — it links straight to the real Integrations connect flow
// instead of the "coming soon" placeholder modal every other mocked service
// still shows.
export function CommunicationBanner({
  service,
  connectHref,
  description,
}: {
  service: string;
  connectHref?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  if (connectHref) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-l-4 border-warning-600 bg-warning-100 px-4 py-2">
        <p className="text-body text-warning-600">
          <span className="font-medium">{service}</span> is not connected.{description ? ` ${description}` : ""}
        </p>
        <Button variant="secondary" href={connectHref}>
          Connect {service}
        </Button>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-l-4 border-warning-600 bg-warning-100 px-4 py-2">
        <p className="text-body text-warning-600">
          <span className="font-medium">{service}</span> is not connected. Data shown is a preview.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Connect {service}
        </Button>
      </div>
      {open && (
        <Modal onClose={() => setOpen(false)} maxWidth="max-w-md">
          <div className="space-y-3">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Real connector — coming soon</h3>
            <p className="text-body text-neutral-800">
              The {service} integration is wired up in a follow-up phase. The UI you&apos;re seeing works today
              with mocked data, so real-connector data will drop in without any interface changes.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Got it</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
