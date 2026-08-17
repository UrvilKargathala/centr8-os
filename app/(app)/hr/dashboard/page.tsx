"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/Card";
import { EmploymentStatusBadge, Badge } from "@/components/ui/Badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/Chart";

const chartConfig = {
  count: { label: "Checked in", color: "var(--primary-600)" },
} satisfies ChartConfig;

type Employee = { id: string; fullName: string; employmentStatus: string };
type AttendanceRecord = { employeeId: string; checkIn: string | null; checkOut: string | null; status: string };
type LeaveRequest = { status: string };

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Real numbers only — no fabricated "Total Applicants"/"Total Projects"
// style stats, since there's no recruitment module and Projects isn't an
// HR concept. Every stat here maps 1:1 to a table this app actually has.
export default function HrDashboardPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const canViewAttendance = can("attendance", "record");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({});
  const [pendingLeave, setPendingLeave] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);

    const days = last7Days();
    const today = days[days.length - 1];

    Promise.all([
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/leave/pending-approvals?org_id=${selectedOrgId}`).then((r) => r.json()),
      canViewAttendance
        ? Promise.all(
            days.map((date) =>
              fetch(`/api/attendance?org_id=${selectedOrgId}&date=${date}`)
                .then((r) => r.json())
                .then((b) => [date, b.data ?? []] as const),
            ),
          )
        : Promise.resolve([]),
    ])
      .then(([empBody, leaveBody, attendanceByDay]) => {
        setEmployees(empBody.data ?? []);
        setPendingLeave((leaveBody.data ?? []).filter((r: LeaveRequest) => r.status === "pending").length);

        if (canViewAttendance) {
          const counts: Record<string, number> = {};
          let todayRows: AttendanceRecord[] = [];
          for (const [date, rows] of attendanceByDay as [string, AttendanceRecord[]][]) {
            counts[date] = rows.length;
            if (date === today) todayRows = rows;
          }
          setWeekCounts(counts);
          setTodayRecords(todayRows);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [selectedOrgId, canViewAttendance]);

  if (orgLoading || loading) return <PageSkeleton variant="dashboard" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  const onboardingCount = employees.filter((e) => e.employmentStatus === "onboarding").length;
  const days = last7Days();
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? "Unknown";

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold text-neutral-950">HR Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Employees" value={employees.length} />
        <StatCard label="Onboarding" value={onboardingCount} />
        <StatCard label="Pending Leave Requests" value={pendingLeave} />
        {canViewAttendance && <StatCard label="Checked In Today" value={todayRecords.length} />}
      </div>

      {canViewAttendance && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-h3 font-semibold text-neutral-950">Attendance — last 7 days</h2>
            <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
              <BarChart
                data={days.map((date) => ({
                  date,
                  day: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
                  count: weekCounts[date] ?? 0,
                }))}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </Card>

          <Card>
            <h2 className="mb-4 text-h3 font-semibold text-neutral-950">Checked in today</h2>
            {todayRecords.length === 0 ? (
              <p className="text-body text-neutral-600">No one has checked in yet today.</p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {todayRecords.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-2.5 text-body">
                    <span className="text-neutral-950">{employeeName(r.employeeId)}</span>
                    <span className="text-small text-neutral-600">
                      {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "—"}
                    </span>
                    <Badge>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Recently onboarding</h2>
        {onboardingCount === 0 ? (
          <p className="text-body text-neutral-600">No one currently onboarding.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
            {employees
              .filter((e) => e.employmentStatus === "onboarding")
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-3 text-body">
                  <a href={`/hr/employees/${e.id}`} className="text-neutral-950 hover:underline">
                    {e.fullName}
                  </a>
                  <EmploymentStatusBadge status={e.employmentStatus} />
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="sm">
      <p className="text-small text-neutral-600">{label}</p>
      <p className="mt-1 text-display font-semibold text-neutral-950">{value}</p>
    </Card>
  );
}
