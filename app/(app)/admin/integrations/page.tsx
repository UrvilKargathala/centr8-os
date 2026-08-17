"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { PageSkeleton } from "@/components/ui/skeleton";

type Integration = {
  id: string;
  provider: string;
  status: string;
  connectedAt: string | null;
  accountLabel: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

const PROVIDERS = [
  {
    key: "slack",
    name: "Slack",
    description: "Send messages to a Slack channel from within Centr8 OS (e.g. project updates).",
    available: true,
    connectedLabel: "Workspace",
    connectRoute: "slack",
  },
  {
    key: "gmail",
    name: "Gmail",
    description: "Read your inbox and send replies via Gmail.",
    available: true,
    connectedLabel: "Connected as",
    connectRoute: "gmail",
  },
  {
    key: "google_meet",
    name: "Google Meet",
    description: "Schedule and link video meetings, with a real Meet link on every event.",
    available: true,
    connectedLabel: "Connected as",
    // Route folder is "google" (app/api/integrations/google/*), not
    // "google_meet" — Gmail and Google Meet share one OAuth client
    // (lib/api/googleOAuth.ts) but are still two separate integrations
    // rows/routes, so the URL segment doesn't just mirror the provider key
    // here the way it does for slack/gmail/clickup.
    connectRoute: "google",
  },
  {
    key: "clickup",
    name: "ClickUp",
    description: "Sync tasks, comments, and docs from your ClickUp workspace.",
    available: true,
    connectedLabel: "Connected to",
    connectRoute: "clickup",
  },
] as const;

function SlackIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 24 24">
      <path fill="#36C5F0" d="M8.7 15.5a1.9 1.9 0 11-1.9-1.9h1.9v1.9zM9.6 15.5a1.9 1.9 0 013.8 0v4.8a1.9 1.9 0 01-3.8 0v-4.8z" />
      <path fill="#2EB67D" d="M8.4 8.6a1.9 1.9 0 111.9-1.9v1.9H8.4zM8.4 9.6a1.9 1.9 0 010 3.8H3.6a1.9 1.9 0 010-3.8h4.8z" />
      <path fill="#ECB22E" d="M15.3 8.4a1.9 1.9 0 111.9 1.9h-1.9V8.4zM14.4 8.4a1.9 1.9 0 01-3.8 0V3.6a1.9 1.9 0 013.8 0v4.8z" />
      <path fill="#E01E5A" d="M15.6 15.3a1.9 1.9 0 11-1.9 1.9v-1.9h1.9zM15.6 14.4a1.9 1.9 0 010-3.8h4.8a1.9 1.9 0 010 3.8h-4.8z" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#EA4335" />
      <path d="M4 7.5l8 5.5 8-5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleMeetIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="12" height="12" rx="2" fill="#00897B" />
      <path d="M17 9.3L21 6.8V17.2L17 14.7z" fill="#00897B" />
    </svg>
  );
}

function ClickUpIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#7B68EE" />
      <path d="M6 15.5L12 10.5L18 15.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11L12 6L18 11" stroke="#FD71AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PROVIDER_ICON: Record<(typeof PROVIDERS)[number]["key"], () => React.ReactElement> = {
  slack: SlackIcon,
  gmail: GmailIcon,
  google_meet: GoogleMeetIcon,
  clickup: ClickUpIcon,
};

const CONTACT_ICON = "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z";
const CALENDAR_ICON = "M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z";
const BASIC_ICON = "M13 10V3L4 14h7v7l9-11h-7z";

// Scopes shown in the pre-connect consent modal — mirrors what the actual
// OAuth grant covers for each provider, so nothing here overstates access.
// ClickUp has no entry: it's a Personal API Token, not an OAuth grant, so
// it never renders through this consent-screen modal at all (see
// ClickUpConnectModal below).
type OAuthProviderKey = Exclude<(typeof PROVIDERS)[number]["key"], "clickup">;
const PROVIDER_SCOPES: Record<OAuthProviderKey, { icon: string; title: string; description: string }[]> = {
  slack: [
    { icon: CONTACT_ICON, title: "Post messages", description: "Send messages to a Slack channel on your behalf." },
    { icon: BASIC_ICON, title: "Basic functionality", description: "The basic scope required for authentication." },
  ],
  gmail: [
    { icon: CONTACT_ICON, title: "Read inbox", description: "View your emails and threads inside Centr8 OS." },
    { icon: CONTACT_ICON, title: "Send email", description: "Send replies and generated documents via Gmail." },
    { icon: BASIC_ICON, title: "Basic functionality", description: "The basic scope required for authentication." },
  ],
  google_meet: [
    { icon: CALENDAR_ICON, title: "Create meetings", description: "Schedule and link video meetings on your calendar." },
    { icon: BASIC_ICON, title: "Basic functionality", description: "The basic scope required for authentication." },
  ],
};

function ScopeIcon({ path }: { path: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </span>
  );
}

function ConnectModal({
  provider,
  connectHref,
  onClose,
}: {
  provider: Extract<(typeof PROVIDERS)[number], { key: OAuthProviderKey }>;
  connectHref: string;
  onClose: () => void;
}) {
  const Icon = PROVIDER_ICON[provider.key];
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-5 text-center">
        <div className="flex items-center justify-center gap-3">
          <img src="/c8-favicon.png" alt="Centr8 OS" className="h-12 w-12 rounded-lg object-contain shadow-sm" />
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-warning-600" />
            ))}
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 shadow-sm">
            <Icon />
          </span>
        </div>

        <div>
          <h2 className="text-h3 font-semibold text-neutral-950">
            Connecting {provider.name} to <span className="whitespace-nowrap">Centr8 OS</span>
          </h2>
        </div>

        <div className="space-y-3 rounded-md border border-neutral-300 bg-neutral-100 p-4 text-left">
          <p className="text-small font-medium text-neutral-950">
            Centr8 OS is requesting access to your {provider.name} account. Continue connecting if you agree.
          </p>
          <p className="text-caption text-neutral-600">{provider.description}</p>

          <div className="space-y-3 pt-1">
            {PROVIDER_SCOPES[provider.key].map((scope) => (
              <div key={scope.title} className="flex items-start gap-3">
                <ScopeIcon path={scope.icon} />
                <div>
                  <p className="text-small font-medium text-neutral-950">{scope.title}</p>
                  <p className="text-caption text-neutral-500">{scope.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button href={connectHref} className="flex-1">
            Connect App
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  const [connectingProvider, setConnectingProvider] = useState<OAuthProviderKey | null>(null);
  const [connectingClickUp, setConnectingClickUp] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ id: string; providerKey: string; providerName: string } | null>(null);

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
    if (providerKey === "google_meet") {
      // Dedicated route — unlike the generic DELETE, this one actually
      // calls Google's revoke endpoint before clearing the stored tokens.
      await fetch(`/api/integrations/google/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrgId }),
      });
    } else {
      await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    }
    setBusyProvider(null);
    loadAll();
  }

  if (orgLoading || loading) return <PageSkeleton variant="cards" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!canConfigure) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const connectedByProvider = new Map(integrations.filter((i) => i.status === "connected").map((i) => [i.provider, i]));
  const erroredByProvider = new Map(integrations.filter((i) => i.status === "error").map((i) => [i.provider, i]));

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
          const errored = erroredByProvider.get(provider.key);
          const Icon = PROVIDER_ICON[provider.key];
          const isClickUp = provider.key === "clickup";
          const isGoogleMeet = provider.key === "google_meet";
          const needsDisconnectConfirm = isClickUp || isGoogleMeet;
          return (
            <Card key={provider.key} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Icon />
                  <h2 className="text-h3 font-semibold text-neutral-950">{provider.name}</h2>
                </div>
                {connected ? (
                  <Badge color="success">Connected</Badge>
                ) : errored ? (
                  <Badge color="danger">Connection error</Badge>
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
              {connected?.lastSyncedAt && (
                <p className="text-caption text-neutral-400">Last synced: {new Date(connected.lastSyncedAt).toLocaleString()}</p>
              )}
              {errored?.lastError && <p className="text-small text-danger-600">{errored.lastError} — reconnect to fix.</p>}

              {provider.available &&
                (connected ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      needsDisconnectConfirm
                        ? setDisconnectConfirm({ id: connected.id, providerKey: provider.key, providerName: provider.name })
                        : disconnect(connected.id, provider.key)
                    }
                    disabled={busyProvider === provider.key}
                  >
                    {busyProvider === provider.key ? "Disconnecting…" : "Disconnect"}
                  </Button>
                ) : isClickUp ? (
                  <Button onClick={() => setConnectingClickUp(true)}>{errored ? "Reconnect" : "Connect"}</Button>
                ) : (
                  <Button onClick={() => setConnectingProvider(provider.key)}>Connect</Button>
                ))}
            </Card>
          );
        })}
      </div>

      {connectingProvider && (
        <ConnectModal
          provider={PROVIDERS.find((p) => p.key === connectingProvider) as Extract<(typeof PROVIDERS)[number], { key: OAuthProviderKey }>}
          connectHref={`/api/integrations/${PROVIDERS.find((p) => p.key === connectingProvider)?.connectRoute}/connect?org_id=${selectedOrgId}`}
          onClose={() => setConnectingProvider(null)}
        />
      )}

      {connectingClickUp && selectedOrgId && (
        <ClickUpConnectModal
          orgId={selectedOrgId}
          onClose={() => setConnectingClickUp(false)}
          onConnected={() => {
            setConnectingClickUp(false);
            loadAll();
          }}
        />
      )}

      {disconnectConfirm && (
        <Modal onClose={() => setDisconnectConfirm(null)} maxWidth="max-w-sm">
          <div className="space-y-4">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Disconnect {disconnectConfirm.providerName}?</h3>
            <p className="text-body text-neutral-700">
              {disconnectConfirm.providerKey === "google_meet"
                ? "Centr8 OS will no longer be able to create or read meetings on this Google Calendar until you reconnect."
                : "Centr8 OS will no longer be able to read tasks or post comments to your ClickUp workspace until you reconnect."}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDisconnectConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const { id, providerKey } = disconnectConfirm;
                  setDisconnectConfirm(null);
                  await disconnect(id, providerKey);
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClickUpConnectModal({ orgId, onClose, onConnected }: { orgId: string; onClose: () => void; onConnected: () => void }) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!token.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/clickup/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, api_token: token.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to connect");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <ClickUpIcon />
          <h2 className="text-h3 font-semibold text-neutral-950">Enter your ClickUp API Token</h2>
        </div>
        <p className="text-small text-neutral-600">
          Centr8 OS stores this token server-side to sync tasks, comments, and docs from your ClickUp workspace. It is never
          shown in your browser after connecting.
        </p>
        <Input
          type="password"
          autoFocus
          placeholder="pk_1234567_ABCDEFGHIJKLMNOPQRSTUVWXYZ"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full"
        />
        <a
          href="https://app.clickup.com/settings/apps"
          target="_blank"
          rel="noreferrer"
          className="block text-small text-primary-700 underline"
        >
          How to find my token
        </a>
        {error && <p className="rounded-md bg-danger-100 p-3 text-small text-danger-600">{error}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={submit} disabled={submitting || !token.trim()}>
            {submitting ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
