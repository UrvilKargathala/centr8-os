"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { SectionSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Field, Textarea } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { AiButton, useAiCall } from "@/components/ui/AiTouchpoint";
import { useToast } from "@/components/ui/Toast";
import { RequestLeaveModal } from "@/components/hr/RequestLeaveModal";

export type LeaveType = { id: string; name: string; color: string; isPaid: boolean; isActive: boolean; requiresApproval: boolean; maxConsecutiveDays: number | null };
export type LeavePolicy = { id: string; leaveTypeId: string; name: string; appliesTo: string; annualAllotmentDays: number; carryForwardMaxDays: number; effectiveFrom: string; isActive: boolean };
export type LeaveBalanceRow = { allottedDays: number; carriedForwardDays: number; usedDays: number; pendingDays: number };
export type BalanceEntry = { leave_type: LeaveType; balance: LeaveBalanceRow | null };
export type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  requestedAt: string;
};
type Employee = { id: string; fullName: string; departmentId: string | null };

const STATUS_COLOR: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const TABS = ["My Leave", "Approvals", "Team Calendar", "Policies"] as const;
type Tab = (typeof TABS)[number];

export default function LeaveManagementPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canApprove = can("leave", "approve");
  const canViewAll = can("leave", "view_all");
  const canConfigure = can("leave", "configure");
  const [tab, setTab] = useState<Tab>("My Leave");
  const [showRequest, setShowRequest] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const visibleTabs = TABS.filter((t) => {
    if (t === "Approvals") return canApprove;
    if (t === "Team Calendar") return canViewAll || canApprove;
    if (t === "Policies") return canConfigure;
    return true;
  });

  if (orgLoading) return <SectionSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-display font-semibold text-neutral-950">Leave Management</h1>
          <p className="mt-1 text-body text-neutral-600">Request time off and manage your team&apos;s leave</p>
        </div>
        <Button onClick={() => setShowRequest(true)}>+ Request Leave</Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 text-body-medium font-medium transition-colors ${
              tab === t ? "border-b-2 border-success-600 text-success-600" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {t}
            {t === "Approvals" && pendingCount > 0 && (
              <span className="rounded-full bg-warning-600 px-1.5 py-0.5 text-caption font-semibold text-neutral-50">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "My Leave" && <MyLeaveTab orgId={selectedOrgId} refreshKey={refreshKey} onRequestLeave={() => setShowRequest(true)} />}
      {tab === "Approvals" && canApprove && <ApprovalsTab orgId={selectedOrgId} onPendingCount={setPendingCount} refreshKey={refreshKey} />}
      {tab === "Team Calendar" && (canViewAll || canApprove) && <TeamCalendarTab orgId={selectedOrgId} />}
      {tab === "Policies" && canConfigure && <PoliciesTab orgId={selectedOrgId} />}

      {showRequest && (
        <RequestLeaveModal
          orgId={selectedOrgId}
          onClose={() => setShowRequest(false)}
          onCreated={() => {
            setShowRequest(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function balanceRemaining(b: LeaveBalanceRow | null): number {
  if (!b) return 0;
  return b.allottedDays + b.carriedForwardDays - b.usedDays - b.pendingDays;
}

function MyLeaveTab({ orgId, refreshKey, onRequestLeave }: { orgId: string; refreshKey: number; onRequestLeave: () => void }) {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const { show: showToast } = useToast();

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/leave/my-balance?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/leave/my-requests?org_id=${orgId}`).then((r) => r.json()),
    ])
      .then(([balanceBody, requestsBody]) => {
        setBalances(balanceBody.data ?? []);
        setRequests(requestsBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [orgId, refreshKey]);

  if (loading) return <SectionSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map(({ leave_type, balance }) => {
          const remaining = balanceRemaining(balance);
          const allotted = balance ? balance.allottedDays + balance.carriedForwardDays : 0;
          const usedPct = allotted > 0 && balance ? Math.min(100, (balance.usedDays / allotted) * 100) : 0;
          const pendingPct = allotted > 0 && balance ? Math.min(100 - usedPct, (balance.pendingDays / allotted) * 100) : 0;
          return (
            <Card key={leave_type.id} padding="sm" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: leave_type.color }} />
                <p className="text-body-medium font-semibold text-neutral-950">{leave_type.name}</p>
              </div>
              {leave_type.isPaid ? (
                <>
                  <p className="text-display font-semibold text-neutral-950">{remaining}</p>
                  <p className="text-caption text-neutral-600">
                    of {allotted} · {balance?.usedDays ?? 0} used, {balance?.pendingDays ?? 0} pending
                  </p>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div className="h-full" style={{ width: `${usedPct}%`, backgroundColor: leave_type.color }} />
                    <div className="h-full opacity-40" style={{ width: `${pendingPct}%`, backgroundColor: leave_type.color }} />
                  </div>
                </>
              ) : (
                <p className="text-caption text-neutral-600">Unpaid — no annual ceiling</p>
              )}
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-h3 font-semibold text-neutral-950">My requests</h2>
        {requests.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </EmptyMedia>
              <EmptyTitle>No leave requests yet</EmptyTitle>
              <EmptyDescription>Request time off whenever you need it.</EmptyDescription>
            </EmptyHeader>
            <Button onClick={onRequestLeave}>+ Request Leave</Button>
          </Empty>
        ) : (
          <Card padding="sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const type = balances.find((b) => b.leave_type.id === r.leaveTypeId)?.leave_type;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {type ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} />
                            {type.name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {r.startDate} {r.startDate !== r.endDate && `→ ${r.endDate}`}
                      </TableCell>
                      <TableCell className="text-neutral-600">{r.totalDays}</TableCell>
                      <TableCell>
                        <Badge color={STATUS_COLOR[r.status] ?? "neutral"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-neutral-600">{r.reason ?? "—"}</TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <Button variant="secondary" onClick={() => setCancelTarget(r)}>
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {cancelTarget && (
        <CancelRequestModal
          request={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            setCancelTarget(null);
            showToast("Leave request cancelled");
            load();
          }}
        />
      )}
    </div>
  );
}

function CancelRequestModal({ request, onClose, onCancelled }: { request: LeaveRequest; onClose: () => void; onCancelled: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/leave/request/${request.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancellation_reason: reason || undefined }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to cancel");
      return;
    }
    onCancelled();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">Cancel this request?</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <p className="text-body text-neutral-600">
          {request.startDate} → {request.endDate} ({request.totalDays} day{request.totalDays === 1 ? "" : "s"})
        </p>
        <Field label="Reason (optional)">
          <Textarea className="w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? "Cancelling…" : "Cancel request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ApprovalsTab({ orgId, onPendingCount, refreshKey }: { orgId: string; onPendingCount: (n: number) => void; refreshKey: number }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const { show: showToast } = useToast();

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/leave/pending-approvals?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/leave/types?org_id=${orgId}`).then((r) => r.json()),
    ]).then(([reqBody, empBody, typesBody]) => {
      setRequests(reqBody.data ?? []);
      onPendingCount((reqBody.data ?? []).length);
      setEmployees(empBody.data ?? []);
      setTypes(typesBody.data ?? []);
      setLoading(false);
    });
  }
  useEffect(load, [orgId, refreshKey]);

  async function approve(id: string) {
    const res = await fetch(`/api/leave/request/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      showToast("Request approved");
      load();
    }
  }

  if (loading) return <SectionSkeleton variant="table" />;

  if (requests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </EmptyMedia>
          <EmptyTitle>No pending approvals</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <ApprovalRow
          key={r.id}
          request={r}
          employee={employees.find((e) => e.id === r.employeeId)}
          leaveType={types.find((t) => t.id === r.leaveTypeId)}
          teamSize={employees.length}
          onApprove={() => approve(r.id)}
          onReject={() => setRejectTarget(r)}
        />
      ))}
      {rejectTarget && (
        <RejectRequestModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            showToast("Request rejected");
            load();
          }}
        />
      )}
    </div>
  );
}

function ApprovalRow({
  request,
  employee,
  leaveType,
  teamSize,
  onApprove,
  onReject,
}: {
  request: LeaveRequest;
  employee: Employee | undefined;
  leaveType: LeaveType | undefined;
  teamSize: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const suggestAI = useAiCall<{ recommendation: "approve" | "flag"; reasoning: string }>("Analyst", "suggest_leave_approval");

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href={`/hr/employees/${request.employeeId}`} className="text-body-medium font-semibold text-neutral-950 hover:underline">
            {employee?.fullName ?? "Unknown"}
          </a>
          <p className="text-small text-neutral-600">
            {leaveType && (
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: leaveType.color }} />
            )}
            {leaveType?.name ?? "Leave"} · {request.startDate} → {request.endDate} · {request.totalDays} day{request.totalDays === 1 ? "" : "s"}
          </p>
          {request.reason && <p className="mt-1 text-caption text-neutral-500">&ldquo;{request.reason}&rdquo;</p>}
          <p className="text-caption text-neutral-400">Requested {new Date(request.requestedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <AiButton
            label="AI: Suggest approval"
            loading={suggestAI.loading}
            onClick={() => suggestAI.run({ team_size: teamSize, overlapping_leave_count: 0, total_days: request.totalDays })}
          />
          <Button variant="secondary" onClick={onApprove}>
            Approve
          </Button>
          <Button variant="danger" onClick={onReject}>
            Reject
          </Button>
        </div>
      </div>
      {suggestAI.result && (
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium ${
            suggestAI.result.recommendation === "approve" ? "bg-success-100 text-success-600" : "bg-warning-100 text-warning-600"
          }`}
          title={suggestAI.result.reasoning}
        >
          AI suggests: {suggestAI.result.recommendation === "approve" ? "Approve" : "Flag for review"}
        </div>
      )}
    </Card>
  );
}

function RejectRequestModal({ request, onClose, onRejected }: { request: LeaveRequest; onClose: () => void; onRejected: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/leave/request/${request.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_note: note }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to reject");
      return;
    }
    onRejected();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">Reject this request</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Review note (required)">
          <Textarea className="w-full" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={saving || !note.trim()}>
            {saving ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TeamCalendarTab({ orgId }: { orgId: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const year = month.getFullYear();
    const mon = month.getMonth();
    const start = `${year}-${String(mon + 1).padStart(2, "0")}-01`;
    const end = new Date(year, mon + 1, 0).toISOString().slice(0, 10);
    setLoading(true);
    Promise.all([
      fetch(`/api/leave/team-calendar?org_id=${orgId}&start_date=${start}&end_date=${end}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/leave/types?org_id=${orgId}`).then((r) => r.json()),
    ]).then(([reqBody, empBody, typesBody]) => {
      setRequests(reqBody.data ?? []);
      setEmployees(empBody.data ?? []);
      setTypes(typesBody.data ?? []);
      setLoading(false);
    });
  }, [orgId, month]);

  const filtered = requests.filter((r) => {
    const emp = employees.find((e) => e.id === r.employeeId);
    if (deptFilter && emp?.departmentId !== deptFilter) return false;
    if (typeFilter && r.leaveTypeId !== typeFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const departmentOptions = Array.from(new Set(employees.map((e) => e.departmentId).filter(Boolean))) as string[];

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1);
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(mon + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];

  function leaveForDay(dateIso: string) {
    return filtered.filter((r) => r.startDate <= dateIso && r.endDate >= dateIso);
  }

  if (loading) return <SectionSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Department">
          <Select className="w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d.slice(0, 8)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Leave type">
          <Select className="w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select className="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </Select>
        </Field>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMonth(new Date(year, mon - 1, 1))} className="rounded-sm px-2 py-1 text-small text-neutral-600 hover:bg-neutral-100" aria-label="Previous month">
            ‹
          </button>
          <p className="text-body-medium font-semibold text-neutral-950">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          <button type="button" onClick={() => setMonth(new Date(year, mon + 1, 1))} className="rounded-sm px-2 py-1 text-small text-neutral-600 hover:bg-neutral-100" aria-label="Next month">
            ›
          </button>
        </div>
        <div className="overflow-x-auto">
        <div className="min-w-[600px]">
        <div className="grid grid-cols-7 gap-1 text-center text-caption text-neutral-500">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateIso, i) => {
            if (!dateIso) return <div key={`b${i}`} />;
            const dayLeave = leaveForDay(dateIso);
            return (
              <div key={dateIso} className="min-h-[4.5rem] rounded-sm border border-neutral-200 p-1">
                <p className="text-caption text-neutral-500">{Number(dateIso.slice(-2))}</p>
                <div className="mt-0.5 space-y-0.5">
                  {dayLeave.slice(0, 3).map((r) => {
                    const type = types.find((t) => t.id === r.leaveTypeId);
                    const emp = employees.find((e) => e.id === r.employeeId);
                    return (
                      <div
                        key={r.id}
                        title={`${emp?.fullName ?? "Unknown"} · ${type?.name ?? "Leave"} · ${r.status}`}
                        className="truncate rounded-sm px-1 text-caption text-neutral-50"
                        style={{ backgroundColor: type?.color ?? "#5B5F68", opacity: r.status === "pending" ? 0.55 : 1 }}
                      >
                        {emp?.fullName?.split(" ")[0] ?? "?"}
                      </div>
                    );
                  })}
                  {dayLeave.length > 3 && <p className="text-caption text-neutral-500">+{dayLeave.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </div>
        <p className="mt-3 text-caption text-neutral-500">Solid = approved · faded = pending</p>
      </Card>
    </div>
  );
}

function PoliciesTab({ orgId }: { orgId: string }) {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState<LeaveType | "new" | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const { show: showToast } = useToast();

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/leave/types?org_id=${orgId}`).then((r) => r.json()),
      fetch(`/api/leave/policies?org_id=${orgId}`).then((r) => r.json()),
    ]).then(([typesBody, policiesBody]) => {
      setTypes(typesBody.data ?? []);
      setPolicies(policiesBody.data ?? []);
      setLoading(false);
    });
  }
  useEffect(load, [orgId]);

  async function toggleTypeField(t: LeaveType, field: "requiresApproval" | "isPaid" | "isActive") {
    const body: Record<string, boolean> = {};
    if (field === "requiresApproval") body.requires_approval = !t.requiresApproval;
    if (field === "isPaid") body.is_paid = !t.isPaid;
    if (field === "isActive") body.is_active = !t.isActive;
    const res = await fetch(`/api/leave/types/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) load();
  }

  async function togglePolicyActive(p: LeavePolicy) {
    const res = await fetch(`/api/leave/policies/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !p.isActive }) });
    if (res.ok) load();
  }

  if (loading) return <SectionSkeleton variant="table" />;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-neutral-950">Leave Types</h2>
          <Button onClick={() => setShowTypeModal("new")}>+ New Leave Type</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <Card key={t.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-body-medium font-semibold text-neutral-950">{t.name}</span>
                </span>
                {!t.isActive && <Badge color="neutral">Inactive</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 text-caption">
                <button onClick={() => toggleTypeField(t, "requiresApproval")} className={`rounded-full px-2 py-0.5 ${t.requiresApproval ? "bg-info-100 text-info-600" : "bg-neutral-100 text-neutral-600"}`}>
                  {t.requiresApproval ? "Requires approval" : "Auto-approved"}
                </button>
                <button onClick={() => toggleTypeField(t, "isPaid")} className={`rounded-full px-2 py-0.5 ${t.isPaid ? "bg-success-100 text-success-600" : "bg-warning-100 text-warning-600"}`}>
                  {t.isPaid ? "Paid" : "Unpaid"}
                </button>
              </div>
              <Button variant="secondary" onClick={() => setShowTypeModal(t)}>
                Edit
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-neutral-950">Leave Policies</h2>
          <Button onClick={() => setShowPolicyModal(true)}>+ New Policy</Button>
        </div>
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave type</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Annual allotment</TableHead>
                <TableHead>Carry forward max</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{types.find((t) => t.id === p.leaveTypeId)?.name ?? "—"}</TableCell>
                  <TableCell className="text-neutral-600">{p.appliesTo}</TableCell>
                  <TableCell className="text-neutral-600">{p.annualAllotmentDays}</TableCell>
                  <TableCell className="text-neutral-600">{p.carryForwardMaxDays}</TableCell>
                  <TableCell className="text-neutral-600">{p.effectiveFrom}</TableCell>
                  <TableCell>
                    <button onClick={() => togglePolicyActive(p)}>
                      <Badge color={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <BalanceAdjustmentTool orgId={orgId} types={types} onAdjusted={() => showToast("Balance adjusted")} />

      {showTypeModal && (
        <LeaveTypeModal orgId={orgId} type={showTypeModal === "new" ? null : showTypeModal} onClose={() => setShowTypeModal(null)} onSaved={() => { setShowTypeModal(null); load(); }} />
      )}
      {showPolicyModal && (
        <LeavePolicyModal orgId={orgId} types={types} onClose={() => setShowPolicyModal(false)} onSaved={() => { setShowPolicyModal(false); load(); }} />
      )}
    </div>
  );
}

function LeaveTypeModal({ orgId, type, onClose, onSaved }: { orgId: string; type: LeaveType | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(type?.name ?? "");
  const [color, setColor] = useState(type?.color ?? "#2E62F0");
  const [isPaid, setIsPaid] = useState(type?.isPaid ?? true);
  const [requiresApproval, setRequiresApproval] = useState(type?.requiresApproval ?? true);
  const [maxConsecutive, setMaxConsecutive] = useState(type?.maxConsecutiveDays?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name,
      color,
      is_paid: isPaid,
      requires_approval: requiresApproval,
      max_consecutive_days: maxConsecutive ? Number(maxConsecutive) : null,
    };
    const res = type
      ? await fetch(`/api/leave/types/${type.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/leave/types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org_id: orgId, ...payload }) });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">{type ? "Edit leave type" : "New leave type"}</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Name">
          <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Color">
          <Input type="color" className="h-10 w-20" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
        <Field label="Max consecutive days (optional)">
          <Input type="number" className="w-full" value={maxConsecutive} onChange={(e) => setMaxConsecutive(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-body text-neutral-950">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
          Paid
        </label>
        <label className="flex items-center gap-2 text-body text-neutral-950">
          <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
          Requires approval
        </label>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function LeavePolicyModal({ orgId, types, onClose, onSaved }: { orgId: string; types: LeaveType[]; onClose: () => void; onSaved: () => void }) {
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [name, setName] = useState("");
  const [allotment, setAllotment] = useState("");
  const [carryForward, setCarryForward] = useState("0");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !name.trim() || !allotment) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/leave/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        leave_type_id: leaveTypeId,
        name,
        annual_allotment_days: Number(allotment),
        carry_forward_max_days: Number(carryForward) || 0,
        effective_from: effectiveFrom,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-h3 font-semibold text-neutral-950">New policy</h3>
        {error && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{error}</p>}
        <Field label="Leave type">
          <Select className="w-full" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Policy name">
          <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Annual allotment (days)">
            <Input type="number" className="w-full" value={allotment} onChange={(e) => setAllotment(e.target.value)} />
          </Field>
          <Field label="Carry forward max">
            <Input type="number" className="w-full" value={carryForward} onChange={(e) => setCarryForward(e.target.value)} />
          </Field>
        </div>
        <Field label="Effective from">
          <Input type="date" className="w-full" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || !allotment}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BalanceAdjustmentTool({ orgId, types, onAdjusted }: { orgId: string; types: LeaveType[]; onAdjusted: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/employees?org_id=${orgId}`)
      .then((r) => r.json())
      .then((b) => setEmployees(b.data ?? []));
  }, [orgId]);
  useEffect(() => {
    if (!leaveTypeId && types[0]) setLeaveTypeId(types[0].id);
  }, [types, leaveTypeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !leaveTypeId || !adjustment || !reason.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/leave/balances/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        year: Number(year),
        adjustment_days: Number(adjustment),
        reason,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to adjust balance");
      return;
    }
    setAdjustment("");
    setReason("");
    onAdjusted();
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-h3 font-semibold text-neutral-950">Adjust balance</h2>
      <p className="text-small text-neutral-600">Manual corrections — e.g. migrating historical balances. Always audited.</p>
      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Employee">
          <Select className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Leave type">
          <Select className="w-full" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Year">
          <Input type="number" className="w-full" value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
        <Field label="Adjustment (+/- days)">
          <Input type="number" className="w-full" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
        </Field>
        <Field label="Reason">
          <Input className="w-full" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="submit" disabled={saving || !employeeId || !leaveTypeId || !adjustment || !reason.trim()}>
            {saving ? "Applying…" : "Apply Adjustment"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
