"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Integration = { id: string; provider: string; status: string; connectedAt: string | null; accountLabel: string | null };

const PROVIDERS = [
  {
    key: "slack",
    name: "Slack",
    description: "Send messages to a Slack channel from within Centr8 OS (e.g. project updates).",
    available: true,
    connectedLabel: "Workspace",
  },
  {
    key: "gmail",
    name: "Gmail",
    description: "Send generated documents and updates via Gmail.",
    available: true,
    connectedLabel: "Connected as",
  },
  {
    key: "zoom",
    name: "Zoom",
    description: "Schedule and link video meetings.",
    available: false,
    connectedLabel: "Connected as",
  },
] as const;

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsPageInner />
    </Suspense>
  );
}

function IntegrationsPageInner() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const canConfigure = can("integration", "configure");
  const callbackMessage = searchParams.get("message");
  const callbackStatus = (providerKey: string) => searchParams.get(providerKey);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/integrations?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load integrations");
        setIntegrations(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load integrations"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  async function disconnect(id: string, providerKey: string) {
    setBusyProvider(providerKey);
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    setBusyProvider(null);
    loadAll();
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading integrations…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!canConfigure) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const connectedByProvider = new Map(integrations.filter((i) => i.status === "connected").map((i) => [i.provider, i]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Integrations</h1>
        <p className="mt-1 text-body text-neutral-600">
          Connect external tools — Centr8 OS surfaces minimal relevant actions from them, not a rebuilt inbox/chat.
        </p>
      </div>

      {PROVIDERS.map((provider) => (
        <div key={provider.key}>
          {callbackStatus(provider.key) === "connected" && (
            <p className="rounded-md bg-success-100 p-3 text-body text-success-600">{provider.name} connected successfully.</p>
          )}
          {callbackStatus(provider.key) === "error" && (
            <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">
              {provider.name} connection failed{callbackMessage ? `: ${callbackMessage}` : "."}
            </p>
          )}
        </div>
      ))}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const connected = connectedByProvider.get(provider.key);
          return (
            <Card key={provider.key} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-h3 font-semibold text-neutral-950">{provider.name}</h2>
                {connected ? (
                  <Badge color="success">Connected</Badge>
                ) : provider.available ? (
                  <Badge color="neutral">Not connected</Badge>
                ) : (
                  <Badge color="neutral">Coming soon</Badge>
                )}
              </div>
              <p className="flex-1 text-small text-neutral-600">{provider.description}</p>
              {connected?.accountLabel && (
                <p className="text-small text-neutral-500">
                  {provider.connectedLabel}: {connected.accountLabel}
                </p>
              )}

              {provider.available &&
                (connected ? (
                  <Button
                    variant="secondary"
                    onClick={() => disconnect(connected.id, provider.key)}
                    disabled={busyProvider === provider.key}
                  >
                    {busyProvider === provider.key ? "Disconnecting…" : "Disconnect"}
                  </Button>
                ) : (
                  <Button href={`/api/integrations/${provider.key}/connect?org_id=${selectedOrgId}`}>Connect</Button>
                ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
