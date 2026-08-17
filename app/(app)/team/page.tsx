"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { KpiCard } from "@/components/ui/KpiCard";
import Link from "next/link";

export type Person = {
  id: string;
  orgId: string;
  fullName: string;
  workEmail: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  department: string | null;
  availableHoursPerWeek: number;
  roles: string[];
  skills: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const ROLE_OPTIONS = ["Developer", "Designer", "Project Manager", "QA", "DevOps", "Marketing", "Sales", "Other"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TeamPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState<Person | null | "new">(null);
  const [taskEstimates, setTaskEstimates] = useState<Record<string, number>>({});

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    Promise.all([
      fetch(`/api/team?${params}`).then((r) => r.json()),
      fetch(`/api/tasks?${params}`).then((r) => r.json()),
    ])
      .then(([teamBody, taskBody]) => {
        if (teamBody.data) setPeople(teamBody.data);
        else setError(teamBody.error ?? "Failed to load team");
        const tasks = (taskBody.data ?? []) as { assigneeId: string | null; estimate: number | null; status: string }[];
        const est: Record<string, number> = {};
        for (const t of tasks) {
          if (t.assigneeId && t.status !== "done" && t.status !== "cancelled") {
            est[t.assigneeId] = (est[t.assigneeId] ?? 0) + (t.estimate ?? 0);
          }
        }
        setTaskEstimates(est);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load team"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (roleFilter && !p.roles.includes(roleFilter)) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      return (
        p.fullName.toLowerCase().includes(needle) ||
        p.workEmail.toLowerCase().includes(needle) ||
        (p.jobTitle ?? "").toLowerCase().includes(needle)
      );
    });
  }, [people, q, roleFilter]);

  async function handleDeactivate(id: string) {
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    loadAll();
  }

  const kpis = useMemo(() => {
    const active = people.filter((p) => p.isActive);
    const totalCapacity = active.reduce((s, p) => s + (p.availableHoursPerWeek || 0), 0);
    const rolesSet = new Set(active.flatMap((p) => p.roles));
    const deptsSet = new Set(active.map((p) => p.department).filter(Boolean) as string[]);
    return {
      total: active.length,
      totalCapacity,
      roles: rolesSet.size,
      depts: deptsSet.size,
    };
  }, [people]);

  if (orgLoading || loading) return <PageSkeleton variant="cards" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Team</h1>
          <p className="mt-1 text-body text-neutral-600">Manage the people in your organization</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Total members" value={kpis.total} pattern={kpis.total} tone="primary" />
        <KpiCard title="Total capacity" value={`${kpis.totalCapacity} hrs`} pattern={Math.round(kpis.totalCapacity / 20)} tone="info" />
        <KpiCard title="Roles covered" value={kpis.roles} pattern={kpis.roles * 3} tone="success" />
        <KpiCard title="Departments" value={kpis.depts} pattern={kpis.depts * 4} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name, email, title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-40">
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        {can("team", "create") && <Button onClick={() => setEditing("new")}>+ Add person</Button>}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>{people.length === 0 ? "No team members yet" : "No people match this filter"}</EmptyTitle>
            <EmptyDescription>
              {people.length === 0 ? "Add the people who will work on your projects." : "Try clearing the search or role filter."}
            </EmptyDescription>
          </EmptyHeader>
          {people.length === 0 && can("team", "create") && (
            <div className="mt-3 flex justify-center">
              <Button onClick={() => setEditing("new")}>+ Add person</Button>
            </div>
          )}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-300">
          <table className="w-full min-w-[880px] text-body">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Job title</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Capacity</th>
                <th className="px-4 py-2">Roles</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-neutral-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-caption font-semibold text-neutral-800">
                        {initials(p.fullName)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-950">{p.fullName}</p>
                        <p className="truncate text-small text-neutral-600">{p.workEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-800">{p.jobTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.department ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const used = taskEstimates[p.id] ?? 0;
                      const pct = p.availableHoursPerWeek > 0 ? Math.min(100, Math.round((used / p.availableHoursPerWeek) * 100)) : 0;
                      const color = pct > 90 ? "bg-danger-600" : pct > 70 ? "bg-warning-600" : "bg-primary-600";
                      return (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-small text-neutral-600">{used}/{p.availableHoursPerWeek}h</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.roles.length === 0 ? (
                        <span className="text-small text-neutral-400">—</span>
                      ) : (
                        p.roles.map((r) => (
                          <span key={r} className="rounded-full bg-neutral-200 px-2 py-0.5 text-caption text-neutral-700">
                            {r}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? <Badge color="success">Active</Badge> : <Badge color="neutral">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/team/${p.id}`}
                        title="View"
                        aria-label="View"
                        className="rounded-md p-1.5 text-neutral-600 hover:bg-primary-100 hover:text-primary-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </Link>
                      {can("team", "update") && (
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-200"
                          aria-label="Edit"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L15.732 3.732z"
                            />
                          </svg>
                        </button>
                      )}
                      {can("team", "delete") && p.isActive && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(p.id)}
                          className="rounded-md p-1.5 text-neutral-600 hover:bg-danger-100 hover:text-danger-600"
                          aria-label="Deactivate"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PersonModal
          orgId={selectedOrgId}
          person={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function PersonModal({
  orgId,
  person,
  onClose,
  onSaved,
}: {
  orgId: string;
  person: Person | null;
  onClose: () => void;
  onSaved: (p: Person) => void;
}) {
  const [fullName, setFullName] = useState(person?.fullName ?? "");
  const [workEmail, setWorkEmail] = useState(person?.workEmail ?? "");
  const [jobTitle, setJobTitle] = useState(person?.jobTitle ?? "");
  const [department, setDepartment] = useState(person?.department ?? "");
  const [availableHours, setAvailableHours] = useState(String(person?.availableHoursPerWeek ?? 40));
  const [roles, setRoles] = useState<string[]>(person?.roles ?? []);
  const [customRole, setCustomRole] = useState("");
  const [skillsInput, setSkillsInput] = useState((person?.skills ?? []).join(", "));
  const [isActive, setIsActive] = useState(person?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }
  function addCustomRole() {
    const r = customRole.trim();
    if (!r || roles.includes(r)) return;
    setRoles((prev) => [...prev, r]);
    setCustomRole("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const body = {
      org_id: orgId,
      full_name: fullName,
      work_email: workEmail,
      job_title: jobTitle || null,
      department: department || null,
      available_hours_per_week: Number(availableHours) || 40,
      roles,
      skills: skillsInput
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      is_active: isActive,
    };
    const res = person
      ? await fetch(`/api/team/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const responseBody = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(responseBody.error ?? "Failed to save");
      return;
    }
    onSaved(responseBody.data);
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="font-heading text-h2 font-semibold text-neutral-950">{person ? "Edit person" : "Add person"}</h2>

        {err && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{err}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name *">
            <Input className="w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Work email *">
            <Input type="email" className="w-full" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} required />
          </Field>
          <Field label="Job title">
            <Input className="w-full" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          {/* Becomes an FK dropdown when HR builds the departments table. */}
          <Field label="Department">
            <Input className="w-full" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
          </Field>
          <Field label="Available hours per week *">
            <Input
              type="number"
              className="w-full"
              min="1"
              max="168"
              value={availableHours}
              onChange={(e) => setAvailableHours(e.target.value)}
              required
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-body text-neutral-800">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
            Active
          </label>
        </div>

        <Field label="Roles">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => {
                const on = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`rounded-full px-3 py-1 text-small ${
                      on ? "bg-primary-100 text-primary-700 outline outline-1 outline-primary-600" : "bg-neutral-100 text-neutral-600 outline outline-1 outline-neutral-300"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
              {roles
                .filter((r) => !ROLE_OPTIONS.includes(r))
                .map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className="rounded-full bg-primary-100 px-3 py-1 text-small text-primary-700 outline outline-1 outline-primary-600"
                  >
                    {r} ×
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Add custom role and press Enter"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomRole();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={addCustomRole}>
                Add
              </Button>
            </div>
          </div>
        </Field>

        <Field label="Skills (comma-separated)">
          <Textarea className="w-full" rows={2} value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="e.g. React, TypeScript, Postgres" />
        </Field>

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !fullName || !workEmail}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
