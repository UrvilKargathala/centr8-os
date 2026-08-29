"use client";

import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { PageSkeleton } from "@/components/ui/skeleton";
import MembersPageClient from "../members/MembersPageClient";

export type OrgDetail = { id: string; name: string; slug: string; createdAt: string };

export default function OrganizationPageClient({ initial }: { initial?: OrgDetail }) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canManage = can("organization", "update");
  const toast = useToast();

  const [tab, setTab] = useState<"overview" | "members">("overview");
  const [org, setOrg] = useState<OrgDetail | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);

  const skippedInitialLoad = useRef(!!initial);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    if (!selectedOrgId) return;
    setLoading(true);
    fetch(`/api/orgs`)
      .then((r) => r.json())
      .then((body) => {
        const found = (body.data ?? []).find((o: { id: string }) => o.id === selectedOrgId);
        if (found) {
          setOrg({ id: found.id, name: found.name, slug: found.slug, createdAt: found.createdAt ?? "" });
          setName(found.name);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  async function handleSave() {
    if (!selectedOrgId || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${selectedOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setOrg((prev) => (prev ? { ...prev, name: name.trim() } : prev));
      toast.show("Organization updated", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  if (orgLoading || loading) return <PageSkeleton variant="form" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-semibold text-neutral-950">Organization</h1>
        <p className="mt-1 text-body text-neutral-600">Manage your organization's settings and members.</p>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "members", label: "Members" },
        ]}
      />

      {tab === "overview" ? (
        <Card>
          <div className="max-w-md space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </Field>
            <Field label="Slug">
              <Input value={org?.slug ?? ""} disabled />
            </Field>
            {org?.createdAt && (
              <p className="text-caption text-neutral-500">
                Created {new Date(org.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
            {canManage && (
              <Button onClick={handleSave} disabled={saving || !name.trim() || name.trim() === org?.name}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <MembersPageClient />
      )}
    </div>
  );
}
