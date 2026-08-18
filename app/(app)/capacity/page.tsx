"use client";

import { useEffect, useState } from "react";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { useOrg } from "@/lib/context/OrgContext";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { Avatar } from "@/components/ui/Avatar";

type Person = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  availableHoursPerWeek: number;
  avatarUrl: string | null;
};

type Task = { id: string; title: string; assigneeId: string | null; status: string; estimate: number | null };

export default function CapacityPlanningPage() {
  const { selectedOrgId } = useOrg();
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrgId) return;
    Promise.all([
      fetch(`/api/people?org_id=${selectedOrgId}`).then((r) => r.json()),
      fetch(`/api/tasks?org_id=${selectedOrgId}&status=todo,in_progress,in_review`).then((r) => r.json()),
    ])
      .then(([pRes, tRes]) => {
        setPeople(pRes.data ?? []);
        setTasks(tRes.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  const totalCapacity = people.reduce((s, p) => s + p.availableHoursPerWeek, 0);
  const totalAllocated = tasks.reduce((s, t) => s + (t.estimate ?? 0), 0);
  const utilization = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  const byPerson = people.map((p) => {
    const assigned = tasks.filter((t) => t.assigneeId === p.id);
    const allocated = assigned.reduce((s, t) => s + (t.estimate ?? 0), 0);
    const util = p.availableHoursPerWeek > 0 ? Math.round((allocated / p.availableHoursPerWeek) * 100) : 0;
    return { ...p, taskCount: assigned.length, allocated, util };
  });

  const unassignedTasks = tasks.filter((t) => !t.assigneeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-950">Capacity Planning</h1>
        <p className="text-body text-neutral-500">Team workload and availability overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="!p-4">
          <p className="text-caption text-neutral-500">Team Members</p>
          <p className="text-h3 font-semibold text-neutral-950">{people.length}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-caption text-neutral-500">Total Capacity</p>
          <p className="text-h3 font-semibold text-neutral-950">{totalCapacity}h/wk</p>
        </Card>
        <Card className="!p-4">
          <p className="text-caption text-neutral-500">Allocated</p>
          <p className="text-h3 font-semibold text-neutral-950">{totalAllocated}h</p>
        </Card>
        <Card className="!p-4">
          <p className="text-caption text-neutral-500">Utilization</p>
          <p className={`text-h3 font-semibold ${utilization > 100 ? "text-danger-600" : utilization > 80 ? "text-warning-600" : "text-success-600"}`}>
            {utilization}%
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-body-medium font-semibold text-neutral-950">Team Allocation</h2>
        {loading ? (
          <PageSkeleton variant="table" />
        ) : people.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <svg className="h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </EmptyMedia>
              <EmptyTitle>No team members</EmptyTitle>
              <EmptyDescription>Add team members to Project Management → Team to see capacity data.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <TeamAllocationTable byPerson={byPerson} />
        )}
      </Card>

      {unassignedTasks.length > 0 && (
        <Card>
          <h2 className="mb-4 text-body-medium font-semibold text-neutral-950">
            Unassigned Tasks <Badge color="warning">{unassignedTasks.length}</Badge>
          </h2>
          <UnassignedTasksTable tasks={unassignedTasks} />
        </Card>
      )}
    </div>
  );
}

function TeamAllocationTable({ byPerson }: { byPerson: { id: string; fullName: string; jobTitle: string | null; availableHoursPerWeek: number; allocated: number; taskCount: number; util: number }[] }) {
  const { page, setPage, pageSize, total, paged } = usePagination(byPerson, 10);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
            <TableHead className="text-right">Allocated</TableHead>
            <TableHead className="text-right">Tasks</TableHead>
            <TableHead className="text-right">Utilization</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar name={p.fullName} />
                  <span className="font-medium">{p.fullName}</span>
                </div>
              </TableCell>
              <TableCell className="text-neutral-500">{p.jobTitle ?? "—"}</TableCell>
              <TableCell className="text-right">{p.availableHoursPerWeek}h</TableCell>
              <TableCell className="text-right">{p.allocated}h</TableCell>
              <TableCell className="text-right">{p.taskCount}</TableCell>
              <TableCell className="text-right">
                <Badge color={p.util > 100 ? "danger" : p.util > 80 ? "warning" : "success"}>{p.util}%</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}

function UnassignedTasksTable({ tasks }: { tasks: Task[] }) {
  const { page, setPage, pageSize, total, paged } = usePagination(tasks, 10);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead className="text-right">Estimate</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.title}</TableCell>
              <TableCell className="text-right">{t.estimate ? `${t.estimate}h` : "—"}</TableCell>
              <TableCell><Badge>{t.status.replace(/_/g, " ")}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}
