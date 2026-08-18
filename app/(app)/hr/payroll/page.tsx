"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton, SectionSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Select, Field } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { Pagination, usePagination } from "@/components/ui/Pagination";

type Period = { period_start: string; period_end: string; label: string };
type PayslipRecord = {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  currency: string;
  status: string;
};
type Employee = { id: string; fullName: string; departmentId: string | null };

function ComplianceLimitationBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border-l-4 border-warning-600 bg-warning-100 px-3 py-3">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-small text-warning-600">
        This module tracks compensation records only. It does not calculate taxes, statutory deductions (PF/ESI/TDS),
        or process actual payments. Consult a payroll/tax professional for compliance.
      </p>
    </div>
  );
}

export default function PayrollPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canGenerate = can("payroll", "generate");
  const canFinalize = can("payroll", "finalize");
  const canMarkPaid = can("payroll", "mark_paid");
  const hasAnyAccess = canGenerate || canFinalize || canMarkPaid;

  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [records, setRecords] = useState<PayslipRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const { show: showToast } = useToast();

  useEffect(() => {
    if (!selectedOrgId || !hasAnyAccess) return;
    fetch(`/api/payroll/periods?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((b) => {
        const list: Period[] = b.data ?? [];
        setPeriods(list);
        if (list[0]) setSelectedPeriod(`${list[0].period_start}|${list[0].period_end}`);
      });
    fetch(`/api/employees?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((b) => setEmployees(b.data ?? []));
  }, [selectedOrgId, hasAnyAccess]);

  const [periodStart, periodEnd] = selectedPeriod.split("|");

  function loadRecords() {
    if (!selectedOrgId || !periodStart || !periodEnd) return;
    setLoading(true);
    fetch(`/api/payroll/records?org_id=${selectedOrgId}&period_start=${periodStart}&period_end=${periodEnd}`)
      .then((r) => r.json())
      .then((b) => {
        setRecords(b.data ?? []);
        setSelected(new Set());
      })
      .finally(() => setLoading(false));
  }
  useEffect(loadRecords, [selectedOrgId, periodStart, periodEnd]);

  const filtered = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (deptFilter && employees.find((e) => e.id === r.employeeId)?.departmentId !== deptFilter) return false;
    return true;
  });

  const { page, setPage, pageSize, total, paged: pagedFiltered } = usePagination(filtered, 10);

  const kpis = useMemo(() => {
    const totalGross = filtered.reduce((s, r) => s + r.grossAmount, 0);
    const totalNet = filtered.reduce((s, r) => s + r.netAmount, 0);
    const draft = filtered.filter((r) => r.status === "draft").length;
    const finalized = filtered.filter((r) => r.status === "finalized").length;
    const paid = filtered.filter((r) => r.status === "paid").length;
    return { totalGross, totalNet, draft, finalized, paid };
  }, [filtered]);

  async function generate() {
    if (!selectedOrgId || !periodStart || !periodEnd) return;
    const res = await fetch("/api/payroll/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId, period_start: periodStart, period_end: periodEnd, employee_ids: "all" }),
    });
    setShowGenerateConfirm(false);
    if (res.ok) {
      const body = await res.json();
      showToast(`Generated ${body.data.created.length} payslip record(s)`);
      loadRecords();
    }
  }

  async function bulkFinalize() {
    await Promise.all([...selected].map((id) => fetch(`/api/payroll/records/${id}/finalize`, { method: "POST" })));
    showToast("Selected records finalized");
    loadRecords();
  }
  async function bulkMarkPaid() {
    await Promise.all([...selected].map((id) => fetch(`/api/payroll/records/${id}/mark-paid`, { method: "POST" })));
    showToast("Selected records marked paid");
    loadRecords();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedDraftCount = [...selected].filter((id) => records.find((r) => r.id === id)?.status === "draft").length;
  const selectedFinalizedCount = [...selected].filter((id) => records.find((r) => r.id === id)?.status === "finalized").length;
  const departmentOptions = Array.from(new Set(employees.map((e) => e.departmentId).filter(Boolean))) as string[];

  if (orgLoading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!hasAnyAccess) return <p className="text-body text-neutral-600">You don&apos;t have access to this page.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display font-semibold text-neutral-950">Payroll</h1>
        <p className="mt-1 text-body text-neutral-600">Generate and manage compensation records</p>
      </div>

      <ComplianceLimitationBanner />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Period">
          <Select className="w-56" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p.period_start} value={`${p.period_start}|${p.period_end}`}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        {canGenerate && <Button onClick={() => setShowGenerateConfirm(true)}>Generate Payroll for this Period</Button>}
      </div>

      {loading ? (
        <SectionSkeleton variant="table" />
      ) : records.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-7 8h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>No payroll generated for this period yet</EmptyTitle>
            <EmptyDescription>Generate payroll to create draft records for every employee with an active compensation record.</EmptyDescription>
          </EmptyHeader>
          {canGenerate && <Button onClick={() => setShowGenerateConfirm(true)}>Generate Payroll for this Period</Button>}
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Card padding="sm">
              <p className="text-small text-neutral-600">Total gross</p>
              <p className="mt-1 text-h2 font-semibold text-neutral-950">{kpis.totalGross.toLocaleString()}</p>
            </Card>
            <Card padding="sm">
              <p className="text-small text-neutral-600">Total net</p>
              <p className="mt-1 text-h2 font-semibold text-neutral-950">{kpis.totalNet.toLocaleString()}</p>
            </Card>
            <Card padding="sm">
              <p className="text-small text-neutral-600">Draft</p>
              <p className="mt-1 text-h2 font-semibold text-neutral-950">{kpis.draft}</p>
            </Card>
            <Card padding="sm">
              <p className="text-small text-neutral-600">Finalized</p>
              <p className="mt-1 text-h2 font-semibold text-neutral-950">{kpis.finalized}</p>
            </Card>
            <Card padding="sm">
              <p className="text-small text-neutral-600">Paid</p>
              <p className="mt-1 text-h2 font-semibold text-neutral-950">{kpis.paid}</p>
            </Card>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex gap-3">
              <Field label="Status">
                <Select className="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="draft">Draft</option>
                  <option value="finalized">Finalized</option>
                  <option value="paid">Paid</option>
                </Select>
              </Field>
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
            </div>
            <div className="flex gap-2">
              {canFinalize && selectedDraftCount > 0 && (
                <Button variant="secondary" onClick={bulkFinalize}>
                  Finalize Selected ({selectedDraftCount})
                </Button>
              )}
              {canMarkPaid && selectedFinalizedCount > 0 && (
                <Button variant="secondary" onClick={bulkMarkPaid}>
                  Mark as Paid ({selectedFinalizedCount})
                </Button>
              )}
            </div>
          </div>

          <Card padding="sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Employee</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFiltered.map((r) => {
                  const emp = employees.find((e) => e.id === r.employeeId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="h-4 w-4 rounded-sm border-neutral-300 text-success-600 focus:outline focus:outline-2 focus:outline-success-600"
                        />
                      </TableCell>
                      <TableCell>
                        <a href={`/hr/employees/${r.employeeId}`} className="font-medium text-neutral-950 hover:underline">
                          {emp?.fullName ?? "Unknown"}
                        </a>
                      </TableCell>
                      <TableCell>
                        {r.currency} {r.grossAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {r.currency} {r.totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.currency} {r.netAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge color={r.status === "paid" ? "success" : r.status === "finalized" ? "info" : "neutral"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <a href={`/api/payroll/records/${r.id}/export`} className="text-small font-medium text-primary-700 hover:underline">
                          View/Download
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </Card>
        </>
      )}

      {showGenerateConfirm && (
        <GenerateConfirmModal
          employeeCount={employees.length}
          periodLabel={periods.find((p) => p.period_start === periodStart)?.label ?? ""}
          onClose={() => setShowGenerateConfirm(false)}
          onConfirm={generate}
        />
      )}
    </div>
  );
}

function GenerateConfirmModal({
  employeeCount,
  periodLabel,
  onClose,
  onConfirm,
}: {
  employeeCount: number;
  periodLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [running, setRunning] = useState(false);
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4">
        <h3 className="text-h3 font-semibold text-neutral-950">Generate payroll for {periodLabel}?</h3>
        <p className="text-body text-neutral-600">
          This will create draft payslip records for up to {employeeCount} employee(s) with an active compensation
          record covering this period. Employees who already have a record for this exact period are skipped.
        </p>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              setRunning(true);
              await onConfirm();
              setRunning(false);
            }}
            disabled={running}
          >
            {running ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
