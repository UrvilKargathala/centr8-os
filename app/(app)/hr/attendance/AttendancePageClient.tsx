"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useOrg } from "@/lib/context/OrgContext";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select, Field } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { AiButton, AiSuggestionCard, useAiCall } from "@/components/ui/AiTouchpoint";
import { AttendanceCalendar, isLate, type AttendanceRecord, type AttendanceSettings } from "@/components/hr/AttendanceCalendar";
import { AttendanceHistoryList } from "@/components/hr/AttendanceHistoryList";
import { ManualEntryModal } from "@/components/hr/ManualEntryModal";
import { Pagination, usePagination } from "@/components/ui/Pagination";

type Employee = { id: string; fullName: string; departmentId: string | null; departmentName: string | null; employmentType: string; location: string | null };
type Stats = { attendance_rate_percent: number; avg_hours_per_day: number; late_arrivals_this_week: number; on_time_rate: number };

const VIEWS = ["My Attendance", "Team Today"] as const;
type View = (typeof VIEWS)[number];

export type MyAttendanceInitialData = { settings: AttendanceSettings; stats: Stats | null; history: AttendanceRecord[] };

export function AttendancePageClient({ initialMyAttendance }: { initialMyAttendance?: MyAttendanceInitialData }) {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canViewAll = can("attendance", "view_all");
  const canEditAny = can("attendance", "edit_any");
  const [view, setView] = useState<View>("My Attendance");
  const [showManual, setShowManual] = useState(false);

  if (orgLoading) return <SectionSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">Attendance</h1>
          <p className="mt-1 text-body text-neutral-600">Your check-in history and team overview</p>
        </div>
        <div className="flex items-center gap-3">
          {canViewAll && (
            <div className="glass flex items-center gap-0.5 rounded-md p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-sm px-3 py-1.5 text-small font-medium transition-colors ${
                    view === v ? "bg-success-100 text-success-600" : "text-neutral-500 hover:bg-neutral-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {canEditAny && <Button onClick={() => setShowManual(true)}>Manual Entry</Button>}
          {canEditAny && (
            <a href="/hr/attendance/settings" aria-label="Attendance settings" className="rounded-sm p-2 text-neutral-600 hover:bg-neutral-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {view === "My Attendance" ? (
        <MyAttendanceView orgId={selectedOrgId} initial={initialMyAttendance} />
      ) : (
        <TeamTodayView orgId={selectedOrgId} canEditAny={canEditAny} />
      )}

      {showManual && (
        <ManualEntryPicker orgId={selectedOrgId} onClose={() => setShowManual(false)} onSaved={() => setShowManual(false)} />
      )}
    </div>
  );
}

function ManualEntryPicker({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    fetch(`/api/employees?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setEmployees(b.data ?? []));
  }, [orgId]);

  if (!employeeId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" onClick={onClose}>
        <div className="glass w-full max-w-sm rounded-lg p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 text-h3 font-semibold text-neutral-950">Manual entry — pick employee</h3>
          <Field label="Employee">
            <Select className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} autoFocus>
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <ManualEntryModal orgId={orgId} employeeId={employeeId} onClose={onClose} onSaved={onSaved} />;
}

function useAttendanceSettings(orgId: string, skip = false): AttendanceSettings | null {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  useEffect(() => {
    if (skip) return;
    fetch(`/api/attendance/settings?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setSettings(b.data ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, skip]);
  return settings;
}

function MyAttendanceView({ orgId, initial }: { orgId: string; initial?: MyAttendanceInitialData }) {
  const fallbackSettings = useAttendanceSettings(orgId, !!initial);
  const settings = initial?.settings ?? fallbackSettings;
  const [stats, setStats] = useState<Stats | null>(initial?.stats ?? null);
  const [history, setHistory] = useState<AttendanceRecord[]>(initial?.history ?? []);
  const [month, setMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(!initial);

  const skippedInitialLoad = useRef(!!initial);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/attendance/stats?org_id=${orgId}&scope=me`).then((r) => r.json()),
      fetch(`/api/attendance/my-history?org_id=${orgId}&limit=30`).then((r) => r.json()),
    ])
      .then(([statsBody, historyBody]) => {
        setStats(statsBody.data ?? null);
        setHistory(historyBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading || !settings) return <SectionSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card padding="sm">
          <p className="text-small text-neutral-600">Attendance rate this month</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.attendance_rate_percent ?? 0}%</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Avg hours/day</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.avg_hours_per_day ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Late arrivals this week</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.late_arrivals_this_week ?? 0}</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">On-time rate</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{stats?.on_time_rate ?? 0}%</p>
        </Card>
      </div>

      <Card>
        <AttendanceCalendar month={month} onMonthChange={setMonth} records={history} settings={settings} />
      </Card>

      <AttendanceHistoryList history={history} settings={settings} />
    </div>
  );
}

type TeamRecord = AttendanceRecord & { employeeId: string };

function TeamTodayView({ orgId, canEditAny }: { orgId: string; canEditAny: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "check_in" | "status" | "department">("name");
  const settings = useAttendanceSettings(orgId);
  const summaryAI = useAiCall<string>("Analyst", "summarize_team_attendance");
  const anomaliesAI = useAiCall<{ anomalies: { employee_name: string; pattern: string }[]; reasoning: string }>("Monitor", "flag_attendance_anomalies");

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/attendance/team-today?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([empBody, recBody]) => {
        setEmployees((empBody.data ?? []).filter((e: { employmentStatus: string }) => e.employmentStatus !== "terminated"));
        setRecords(recBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId]);

  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));

  const rows = useMemo(() => {
    return employees
      .filter((e) => !deptFilter || e.departmentId === deptFilter)
      .filter((e) => !typeFilter || e.employmentType === typeFilter)
      .filter((e) => !locationFilter || e.location === locationFilter)
      .map((e) => ({ employee: e, record: recordByEmployee.get(e.id) }))
      .filter((r) => !statusFilter || (r.record?.status ?? "absent") === statusFilter)
      .sort((a, b) => {
        if (sortBy === "name") return a.employee.fullName.localeCompare(b.employee.fullName);
        if (sortBy === "check_in") return (a.record?.checkInTime ?? "").localeCompare(b.record?.checkInTime ?? "");
        if (sortBy === "status") return (a.record?.status ?? "absent").localeCompare(b.record?.status ?? "absent");
        return (a.employee.departmentId ?? "").localeCompare(b.employee.departmentId ?? "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, records, deptFilter, typeFilter, locationFilter, statusFilter, sortBy]);

  const { page, setPage, pageSize, total, paged: pagedRows } = usePagination(rows, 10);

  const kpis = useMemo(() => {
    const checkedIn = rows.filter((r) => r.record?.status === "checked_in").length;
    const checkedOut = rows.filter((r) => r.record?.status === "checked_out" || r.record?.status === "half_day").length;
    const onLeave = rows.filter((r) => r.record?.status === "on_leave").length;
    const absent = rows.filter((r) => !r.record).length; // active employee, no record today — weekend/holiday would still show a record with that status
    const lateToday = settings ? rows.filter((r) => r.record && isLate(r.record, settings)).length : 0;
    return { checkedIn, checkedOut, onLeave, absent, lateToday, total: rows.length };
  }, [rows, settings]);

  const departmentOptions = Array.from(new Map(employees.filter((e) => e.departmentId && e.departmentName).map((e) => [e.departmentId!, e.departmentName!])).entries());
  const locationOptions = Array.from(new Set(employees.map((e) => e.location).filter(Boolean))) as string[];

  if (loading) return <SectionSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card padding="sm">
          <p className="text-small text-neutral-600">Checked in now</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">
            {kpis.checkedIn} of {kpis.total}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Checked out</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">
            {kpis.checkedOut} of {kpis.total}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">On leave today</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{kpis.onLeave}</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Absent today</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{kpis.absent}</p>
        </Card>
        <Card padding="sm">
          <p className="text-small text-neutral-600">Late arrivals today</p>
          <p className="mt-1 text-display font-semibold text-neutral-950">{kpis.lateToday}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AiButton
          label="AI: Weekly attendance summary"
          loading={summaryAI.loading}
          onClick={() => summaryAI.run({ late_arrivals_this_week: kpis.lateToday, absent_today: kpis.absent })}
        />
        <AiButton
          label="AI: Flag anomalies"
          loading={anomaliesAI.loading}
          onClick={() => anomaliesAI.run({ employee_names: employees.map((e) => e.fullName) })}
        />
      </div>
      {summaryAI.result && (
        <AiSuggestionCard onAccept={() => summaryAI.setResult(null)} onReject={() => summaryAI.setResult(null)}>
          <p className="whitespace-pre-wrap text-body text-neutral-800">{summaryAI.result}</p>
        </AiSuggestionCard>
      )}
      {anomaliesAI.result && (
        <AiSuggestionCard reasoning={anomaliesAI.result.reasoning} onAccept={() => anomaliesAI.setResult(null)} onReject={() => anomaliesAI.setResult(null)}>
          {anomaliesAI.result.anomalies.length === 0 ? (
            <p className="text-body text-neutral-600">No anomalies flagged.</p>
          ) : (
            <ul className="space-y-1.5">
              {anomaliesAI.result.anomalies.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-small text-neutral-800">
                  <span>
                    <strong>{a.employee_name}</strong> — {a.pattern}
                  </span>
                  <Link href="/hr/employees" className="text-caption font-medium text-primary-700 hover:underline">
                    View employee
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AiSuggestionCard>
      )}

      <div className="flex flex-wrap items-end gap-3">
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
            {["checked_in", "checked_out", "half_day", "on_leave", "holiday"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sort by">
          <Select className="w-40" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="name">Name</option>
            <option value="check_in">Check-in time</option>
            <option value="status">Status</option>
            <option value="department">Department</option>
          </Select>
        </Field>
      </div>

      {rows.length === 0 ? (
        <p className="text-body text-neutral-600">No team activity today yet</p>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Total hours today</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map(({ employee, record }) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <a href={`/hr/employees/${employee.id}`} className="font-medium text-neutral-950 hover:underline">
                      {employee.fullName}
                    </a>
                  </TableCell>
                  <TableCell className="text-neutral-600">{employee.departmentName ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">
                    {settings && record && isLate(record, settings) && (
                      <span title="Late arrival" className="mr-1 text-warning-600">
                        ⚠
                      </span>
                    )}
                    {record?.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : "—"}
                  </TableCell>
                  <TableCell className="text-neutral-600">{record?.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell className="text-neutral-600">{record?.totalMinutes != null ? (record.totalMinutes / 60).toFixed(1) : "—"}</TableCell>
                  <TableCell>
                    <Badge>{(record?.status ?? "absent").replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-neutral-600">{record?.location?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell>
                    {canEditAny && <RowActions employeeId={employee.id} record={record} orgId={orgId} onChanged={load} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}

function RowActions({
  employeeId,
  record,
  orgId,
  onChanged,
}: {
  employeeId: string;
  record: AttendanceRecord | undefined;
  orgId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200" aria-label="Row actions">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md shadow-lg">
          <a href={`/hr/employees/${employeeId}`} className="block px-3 py-2 text-small text-neutral-800 hover:bg-neutral-100">
            View details
          </a>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowModal(true);
            }}
            className="block w-full px-3 py-2 text-left text-small text-neutral-800 hover:bg-neutral-100"
          >
            Add manual entry
          </button>
        </div>
      )}
      {showModal && (
        <ManualEntryModal
          orgId={orgId}
          employeeId={employeeId}
          existing={
            record
              ? { id: record.id, workDate: record.workDate, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, status: record.status, manualEntryReason: null }
              : null
          }
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
