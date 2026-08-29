"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PermissionAction, ResourceType } from "@/lib/api/permissions";

export type Org = { id: string; name: string; slug: string; role: string };

type OrgContextValue = {
  orgs: Org[];
  selectedOrgId: string | null;
  selectedOrg: Org | null;
  setSelectedOrgId: (id: string) => void;
  addOrg: (org: Org) => void;
  loading: boolean;
  error: string | null;
  // Table-driven, sourced from GET /api/permissions — the same `permissions`
  // rows requirePermission() enforces server-side (Prompt 1.4 task 4), not
  // a hardcoded role name check. Defaults to false while permissions are
  // still loading, so actions stay hidden/disabled rather than flash on.
  can: (resourceType: ResourceType, action: PermissionAction) => boolean;
  permissionsLoading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

// Same name as lib/org/currentOrg.ts's ORG_COOKIE — a plain (non-httpOnly)
// cookie so both this client provider and Server Components can read/write
// the selected org. Replaces localStorage: Server Components can't read
// localStorage, and this is the seed Server Components need to render
// org-scoped data without a client round trip.
const ORG_COOKIE = "centr8-selected-org-id";

function readOrgCookie(): string | null {
  if (typeof document === "undefined") return null;
  return document.cookie.match(new RegExp(`(?:^|; )${ORG_COOKIE}=([^;]*)`))?.[1] ?? null;
}

function writeOrgCookie(id: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${ORG_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}

export function OrgProvider({
  children,
  initialOrgs,
  initialOrgId,
  initialGrants,
}: {
  children: React.ReactNode;
  initialOrgs?: Org[];
  initialOrgId?: string | null;
  initialGrants?: { resourceType: string; action: string }[];
}) {
  const [orgs, setOrgs] = useState<Org[]>(initialOrgs ?? []);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(initialOrgId ?? null);
  const [loading, setLoading] = useState(!initialOrgs);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<Set<string>>(
    new Set((initialGrants ?? []).map((r) => `${r.resourceType}:${r.action}`)),
  );
  const [permissionsLoading, setPermissionsLoading] = useState(!initialGrants);

  useEffect(() => {
    if (initialOrgs) return; // already seeded by the server layout
    fetch("/api/orgs")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load organizations");
        return body.data as Org[];
      })
      .then((data) => {
        setOrgs(data);
        const stored = readOrgCookie();
        const initial = data.find((o) => o.id === stored)?.id ?? data[0]?.id ?? null;
        setSelectedOrgIdState(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load organizations"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skippedInitialGrantsFetch = useRef(!!initialGrants);
  useEffect(() => {
    if (!selectedOrgId) return;
    if (skippedInitialGrantsFetch.current) {
      skippedInitialGrantsFetch.current = false;
      return;
    }
    setPermissionsLoading(true);
    fetch(`/api/permissions?org_id=${selectedOrgId}`)
      .then((res) => res.json())
      .then((body) => {
        const rows = (body.data ?? []) as { resourceType: string; action: string }[];
        setGrants(new Set(rows.map((r) => `${r.resourceType}:${r.action}`)));
      })
      .catch(() => setGrants(new Set()))
      .finally(() => setPermissionsLoading(false));
  }, [selectedOrgId]);

  function setSelectedOrgId(id: string) {
    setSelectedOrgIdState(id);
    writeOrgCookie(id);
  }

  // Appends a just-created org and switches to it, without refetching the
  // whole list — used by the "+ New Organization" flow in AppShell.
  function addOrg(org: Org) {
    setOrgs((prev) => [...prev, org]);
    setSelectedOrgId(org.id);
  }

  function can(resourceType: ResourceType, action: PermissionAction) {
    return grants.has(`${resourceType}:${action}`);
  }

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{ orgs, selectedOrgId, selectedOrg, setSelectedOrgId, addOrg, loading, error, can, permissionsLoading }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
