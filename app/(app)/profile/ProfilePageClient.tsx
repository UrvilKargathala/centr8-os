"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Skeleton, PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";

export default function ProfilePageClient({ initialEmail }: { initialEmail?: string | null }) {
  const { orgs, selectedOrgId, loading: orgLoading } = useOrg();
  const [email] = useState<string | null>(initialEmail ?? null);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">Profile settings</h1>

      <Card className="space-y-4">
        <div>
          <p className="text-small text-neutral-600">Email</p>
          <p className="text-body-medium font-medium text-neutral-950">{email ?? <Skeleton className="h-4 w-32 inline-block" />}</p>
        </div>

        <div>
          <p className="mb-2 text-small text-neutral-600">Organizations</p>
          {orgLoading ? (
            <PageSkeleton variant="form" />
          ) : orgs.length === 0 ? (
            <p className="text-body text-neutral-600">Not a member of any organization.</p>
          ) : (
            <ul className="space-y-2">
              {orgs.map((org) => (
                <li key={org.id} className="flex items-center justify-between">
                  <span className="text-body text-neutral-950">{org.name}</span>
                  <Badge>{org.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {selectedOrgId && <SsoConfigSection orgId={selectedOrgId} />}
      {selectedOrgId && <ApiKeysSection orgId={selectedOrgId} />}
    </div>
  );
}

type SsoConfig = {
  orgId: string;
  idpEntityId: string | null;
  idpSsoUrl: string | null;
  idpCertificate: string | null;
  enabled: boolean;
  updatedAt: string;
} | null;

// Prompt 3.3 — Supabase Auth's SAML SSO is a Team-plan feature ($599/mo),
// not available on the Free/Pro tiers this project runs on (CLAUDE.md §2:
// flag a paid-tier requirement rather than silently build around it —
// confirmed via Supabase's own pricing page and Team-plan feature list).
// This form saves IdP metadata for real so the setup work isn't lost, but
// there is no "Enable" control — see db/schema.ts's ssoConfigurations.enabled
// comment for exactly what has to happen before that can go live.
function SsoConfigSection({ orgId }: { orgId: string }) {
  const { can } = useOrg();
  const canRead = can("sso", "read");
  const canConfigure = can("sso", "configure");

  const [config, setConfig] = useState<SsoConfig>(null);
  const [loading, setLoading] = useState(true);
  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/sso-config?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => {
        setConfig(b.data);
        if (b.data) {
          setIdpEntityId(b.data.idpEntityId ?? "");
          setIdpSsoUrl(b.data.idpSsoUrl ?? "");
          setIdpCertificate(b.data.idpCertificate ?? "");
        }
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId, canRead]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/sso-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        idp_entity_id: idpEntityId || null,
        idp_sso_url: idpSsoUrl || null,
        idp_certificate: idpCertificate || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    setSaved(true);
    load();
  }

  if (!canRead) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-neutral-950">SSO (SAML)</h2>
        <p className="mt-1 text-small text-neutral-600">
          Configure your identity provider now — the login flow itself is blocked pending a plan upgrade (below).
        </p>
      </div>

      <div className="rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
        <p className="text-small font-medium text-warning-600">Blocked on the current plan</p>
        <p className="mt-1 text-small text-warning-600">
          SAML SSO login requires Supabase&apos;s Team plan ($599/mo) — not available on Free or Pro. This form saves
          your IdP metadata so it&apos;s ready, but no SSO login is possible until the Supabase project is upgraded
          and the flow is wired to Supabase&apos;s SAML provider on top of it.
        </p>
      </div>

      {loading ? (
        <SectionSkeleton variant="text" />
      ) : (
        <>
          {config && (
            <p className="text-small text-neutral-600">
              Last saved {new Date(config.updatedAt).toLocaleString()} · Status:{" "}
              <Badge color={config.enabled ? "success" : "neutral"}>{config.enabled ? "Enabled" : "Not enabled"}</Badge>
            </p>
          )}

          {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
          {saved && <p className="rounded-md bg-success-100 p-3 text-body text-success-600">Saved.</p>}

          {canConfigure ? (
            <form onSubmit={handleSave} className="space-y-3">
              <Field label="IdP Entity ID">
                <Input className="w-full" value={idpEntityId} onChange={(e) => setIdpEntityId(e.target.value)} placeholder="https://idp.example.com/entity" />
              </Field>
              <Field label="IdP SSO URL">
                <Input className="w-full" value={idpSsoUrl} onChange={(e) => setIdpSsoUrl(e.target.value)} placeholder="https://idp.example.com/sso" />
              </Field>
              <Field label="IdP x509 certificate">
                <textarea
                  className="glass-input w-full rounded-md px-3 py-2 text-body focus:outline focus:outline-2 focus:outline-primary-600"
                  rows={4}
                  value={idpCertificate}
                  onChange={(e) => setIdpCertificate(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----"
                />
              </Field>
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? "Saving…" : "Save IdP configuration"}
              </Button>
            </form>
          ) : (
            !config && <p className="text-body text-neutral-600">No SSO configuration set up yet.</p>
          )}
        </>
      )}
    </Card>
  );
}

type ApiKey = { id: string; name: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

// FR-3.x (Prompt 3.2) task 4 — credentials for the read-only finance
// export at /api/v1/finance/projects. Org-level, not a project setting, so
// this lives on the profile page rather than a project's Settings tab.
function ApiKeysSection({ orgId }: { orgId: string }) {
  const { can } = useOrg();
  const canRead = can("api_key", "read");
  const canCreate = can("api_key", "create");
  const canDelete = can("api_key", "delete");

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/api-keys?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setKeys(b.data ?? []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orgId, canRead]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create key");
      return;
    }
    setJustCreated({ name: body.data.name, key: body.data.key });
    setName("");
    load();
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  if (!canRead) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-h2 font-semibold text-neutral-950">API keys</h2>
        <p className="mt-1 text-small text-neutral-600">
          For the read-only finance export and SCIM user provisioning (
          <code className="text-caption">/api/v1/finance/projects</code>,{" "}
          <code className="text-caption">/api/scim/v2/Users</code>) — external tools authenticate with one of these
          instead of a user login.
        </p>
      </div>

      {justCreated && (
        <div className="space-y-1.5 rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
          <p className="text-small font-medium text-warning-600">
            Copy this now — “{justCreated.name}” won&apos;t be shown again.
          </p>
          <code className="block break-all rounded-sm bg-neutral-50 px-2 py-1.5 text-small text-neutral-950">
            {justCreated.key}
          </code>
          <Button variant="secondary" onClick={() => setJustCreated(null)}>
            Done
          </Button>
        </div>
      )}

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      {loading ? (
        <SectionSkeleton variant="text" />
      ) : keys.length === 0 ? (
        <p className="text-body text-neutral-600">No API keys yet.</p>
      ) : (
        <ul className="glass-table divide-y divide-neutral-200">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
              <div>
                <span className="text-neutral-950">{k.name}</span>
                <span className="ml-2 text-small text-neutral-600">
                  {k.revokedAt
                    ? "Revoked"
                    : k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                </span>
              </div>
              {canDelete && !k.revokedAt && (
                <button onClick={() => handleRevoke(k.id)} className="text-small text-danger-600 hover:underline">
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-4">
          <Field label="New key name">
            <Input
              className="min-w-0"
              placeholder="e.g. QuickBooks export"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={creating || !name}>
            {creating ? "Creating…" : "+ New Key"}
          </Button>
        </form>
      )}
    </Card>
  );
}
