"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmploymentStatusBadge } from "@/components/ui/Badge";
import { Card, CardLink } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, Field, Input } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { EmployeeWizard } from "@/components/hr/EmployeeWizard";
import { Pagination, usePagination } from "@/components/ui/Pagination";

export type Employee = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  employmentStatus: string;
  employmentType: string;
  startDate: string | null;
  departmentId: string | null;
  departmentName: string | null;
  teamId: string | null;
  managerId: string | null;
  location: string | null;
  employeeCode: string | null;
  availableHoursPerWeek: number;
  roles: string[];
  skills: string[];
};

type ViewMode = "grid" | "list" | "org-chart";
type KpiFilter = "all" | "onboarding" | "on_leave" | "notice_period";

export function EmployeesPageClient({ initialEmployees }: { initialEmployees?: Employee[] }) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees ?? []);
  const [loading, setLoading] = useState(!initialEmployees);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("all");
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load employees");
        setEmployees(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load employees"))
      .finally(() => setLoading(false));
  }

  const skippedInitialLoad = useRef(!!initialEmployees);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of employees) {
      if (e.departmentId && e.departmentName) seen.set(e.departmentId, e.departmentName);
    }
    return Array.from(seen.entries());
  }, [employees]);
  const locationOptions = useMemo(
    () => Array.from(new Set(employees.map((e) => e.location).filter(Boolean))) as string[],
    [employees],
  );

  const kpis = useMemo(
    () => ({
      total: employees.length,
      onboarding: employees.filter((e) => e.employmentStatus === "onboarding").length,
      on_leave: employees.filter((e) => e.employmentStatus === "on_leave").length,
      notice_period: employees.filter((e) => e.employmentStatus === "notice_period").length,
    }),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return employees.filter((e) => {
      if (kpiFilter !== "all" && e.employmentStatus !== kpiFilter) return false;
      if (deptFilter && e.departmentId !== deptFilter) return false;
      if (typeFilter && e.employmentType !== typeFilter) return false;
      if (locationFilter && e.location !== locationFilter) return false;
      if (statusFilter && e.employmentStatus !== statusFilter) return false;
      if (q) {
        const hay = [e.fullName, e.jobTitle, e.email, e.employeeCode].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [employees, debouncedSearch, kpiFilter, deptFilter, typeFilter, locationFilter, statusFilter]);

  const anyFilterActive = Boolean(deptFilter || typeFilter || locationFilter || statusFilter || kpiFilter !== "all" || search);
  function clearFilters() {
    setDeptFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setStatusFilter("");
    setKpiFilter("all");
    setSearch("");
  }

  if (orgLoading || loading) {
    return <PageSkeleton variant="table" />;
  }
  if (!selectedOrgId) {
    return <p className="text-body text-neutral-600">No organization selected.</p>;
  }
  if (error) {
    return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">Employee Directory</h1>
          <p className="mt-1 text-body text-neutral-600">{employees.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onChange={setView} />
          {can("employee", "create") && <Button onClick={() => setShowWizard(true)}>+ Add Employee</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total" value={kpis.total} active={kpiFilter === "all"} onClick={() => setKpiFilter("all")} />
        <KpiCard
          label="Onboarding"
          value={kpis.onboarding}
          active={kpiFilter === "onboarding"}
          onClick={() => setKpiFilter(kpiFilter === "onboarding" ? "all" : "onboarding")}
        />
        <KpiCard
          label="On Leave"
          value={kpis.on_leave}
          active={kpiFilter === "on_leave"}
          onClick={() => setKpiFilter(kpiFilter === "on_leave" ? "all" : "on_leave")}
        />
        <KpiCard
          label="Departing"
          value={kpis.notice_period}
          active={kpiFilter === "notice_period"}
          onClick={() => setKpiFilter(kpiFilter === "notice_period" ? "all" : "notice_period")}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Search">
          <Input
            className="w-56"
            placeholder="Name, title, email, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Department">
          <Select className="w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All</option>
            {departmentOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employment type">
          <Select className="w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            {["full_time", "part_time", "contract", "intern", "consultant"].map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location">
          <Select className="w-40" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All</option>
            {locationOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select className="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {["active", "onboarding", "on_leave", "notice_period", "terminated"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        {anyFilterActive && (
          <Button variant="secondary" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8"
                />
              </svg>
            </EmptyMedia>
            <EmptyTitle>{employees.length === 0 ? "No employees yet" : "No matches"}</EmptyTitle>
            <EmptyDescription>
              {employees.length === 0
                ? "Add your first employee to start building the directory."
                : "Try clearing a filter or search term."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((employee) => (
            <CardLink key={employee.id} href={`/hr/employees/${employee.id}`} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-h3 font-semibold text-neutral-950">{employee.fullName}</h2>
                <EmploymentStatusBadge status={employee.employmentStatus} />
              </div>
              <p className="text-small text-neutral-600">{employee.jobTitle ?? "No title set"}</p>
              <p className="text-caption text-neutral-500">{employee.location ?? "—"}</p>
            </CardLink>
          ))}
        </div>
      ) : view === "list" ? (
        <EmployeeTable employees={filtered} />
      ) : (
        <OrgChart employees={filtered} />
      )}

      {showWizard && (
        <EmployeeWizard
          orgId={selectedOrgId}
          onClose={() => setShowWizard(false)}
          onSaved={() => {
            setShowWizard(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card padding="sm" color={active ? "success" : undefined} className={active ? "outline outline-2 outline-success-600" : ""}>
        <p className="text-small text-neutral-600">{label}</p>
        <p className="mt-1 text-display font-semibold text-neutral-950">{value}</p>
      </Card>
    </button>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const base = "rounded-sm p-1.5 transition-colors";
  const active = "bg-primary-100 text-primary-700";
  const inactive = "text-neutral-500 hover:bg-neutral-200";
  const items: { mode: ViewMode; label: string; path: string }[] = [
    { mode: "list", label: "List view", path: "M4 6h16M4 12h16M4 18h16" },
    { mode: "grid", label: "Grid view", path: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" },
    { mode: "org-chart", label: "Org chart view", path: "M12 3v6m0 0H5v6m7-6h7v6M5 15v3h6m2-3v3h6" },
  ];
  return (
    <div className="flex items-center gap-0.5 glass rounded-md p-0.5">
      {items.map((it) => (
        <button
          key={it.mode}
          type="button"
          aria-label={it.label}
          onClick={() => onChange(it.mode)}
          className={`${base} ${view === it.mode ? active : inactive}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={it.path} />
          </svg>
        </button>
      ))}
    </div>
  );
}

function EmployeeTable({ employees }: { employees: Employee[] }) {
  const { page, setPage, pageSize, total, paged } = usePagination(employees, 10);
  return (
    <Card padding="sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Start date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <a href={`/hr/employees/${e.id}`} className="font-medium text-neutral-950 hover:underline">
                  {e.fullName}
                </a>
              </TableCell>
              <TableCell className="text-neutral-600">{e.jobTitle ?? "—"}</TableCell>
              <TableCell className="text-neutral-600">{e.employmentType.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-neutral-600">{e.location ?? "—"}</TableCell>
              <TableCell className="text-neutral-600">{e.email ?? e.phone ?? "—"}</TableCell>
              <TableCell className="text-neutral-600">{e.startDate ?? "—"}</TableCell>
              <TableCell>
                <EmploymentStatusBadge status={e.employmentStatus} />
              </TableCell>
              <TableCell>
                <RowMenu employeeId={e.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </Card>
  );
}

function RowMenu({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-md shadow-lg">
          <a href={`/hr/employees/${employeeId}`} className="block px-3 py-2 text-small text-neutral-800 hover:bg-neutral-100">
            View profile
          </a>
          <a href={`/hr/employees/${employeeId}?edit=1`} className="block px-3 py-2 text-small text-neutral-800 hover:bg-neutral-100">
            Edit
          </a>
        </div>
      )}
    </div>
  );
}

// Recursive tree from managerId. TODO: swap for a real tree-layout library
// (e.g. react-organizational-chart) once the directory has enough real
// hierarchy depth to need proper edge routing — this is a plain nested
// expand/collapse list, fine for a handful of levels.
function OrgChart({ employees }: { employees: Employee[] }) {
  const byManager = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const e of employees) {
      const key = e.managerId ?? "__root__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [employees]);
  const roots = byManager.get("__root__") ?? [];

  if (roots.length === 0) {
    return <p className="text-body text-neutral-600">No unmanaged root employees in the current filter — try clearing filters.</p>;
  }

  return (
    <Card>
      <ul className="space-y-1">
        {roots.map((e) => (
          <OrgChartNode key={e.id} employee={e} byManager={byManager} depth={0} />
        ))}
      </ul>
    </Card>
  );
}

function OrgChartNode({ employee, byManager, depth }: { employee: Employee; byManager: Map<string, Employee[]>; depth: number }) {
  const children = byManager.get(employee.id) ?? [];
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <li>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100" style={{ paddingLeft: `${depth * 1.5}rem` }}>
        {children.length > 0 ? (
          <button type="button" onClick={() => setExpanded((x) => !x)} className="text-neutral-500">
            <svg className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <a href={`/hr/employees/${employee.id}`} className="text-body-medium font-medium text-neutral-950 hover:underline">
          {employee.fullName}
        </a>
        <span className="text-small text-neutral-500">{employee.jobTitle ?? ""}</span>
        <EmploymentStatusBadge status={employee.employmentStatus} />
      </div>
      {expanded && children.length > 0 && (
        <ul className="space-y-1">
          {children.map((c) => (
            <OrgChartNode key={c.id} employee={c} byManager={byManager} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
