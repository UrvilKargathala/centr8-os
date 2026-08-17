"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { PageSkeleton } from "@/components/ui/skeleton";

type Activity = {
  id: string;
  relatedType: string;
  type: string;
  subject: string | null;
  performedBy: string | null;
  activityDate: string;
};
type Employee = { id: string; fullName: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ActivitiesPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedType, setRelatedType] = useState("");
  const [activityType, setActivityType] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function load() {
    if (!selectedOrgId) return;
    setLoading(true);
    const params = new URLSearchParams({ org_id: selectedOrgId });
    if (relatedType) params.set("related_type", relatedType);
    if (activityType) params.set("activity_type", activityType);
    if (performedBy) params.set("performed_by", performedBy);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    Promise.all([
      fetch(`/api/crm/activities?${params}`).then((r) => r.json()),
      fetch(`/api/employees?org_id=${selectedOrgId}`).then((r) => r.json()),
    ])
      .then(([actBody, empBody]) => {
        setActivities((actBody.data ?? []).sort((a: Activity, b: Activity) => +new Date(b.activityDate) - +new Date(a.activityDate)));
        setEmployees(empBody.data ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [selectedOrgId, relatedType, activityType, performedBy, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeName = (id: string | null) => employees.find((e) => e.id === id)?.fullName ?? "—";

  if (orgLoading || loading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (!can("activity", "read")) return <p className="text-body text-neutral-600">You don&apos;t have access to activities.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-950">Activities</h1>
        <p className="text-body text-neutral-600">Cross-entity activity log across leads, accounts, and contacts.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Related to">
          <Select value={relatedType} onChange={(e) => setRelatedType(e.target.value)}>
            <option value="">All</option>
            <option value="lead">Lead</option>
            <option value="account">Account</option>
            <option value="contact">Contact</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            <option value="">All</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Performed by">
          <Select value={performedBy} onChange={(e) => setPerformedBy(e.target.value)}>
            <option value="">All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            setRelatedType("");
            setActivityType("");
            setPerformedBy("");
            setDateFrom("");
            setDateTo("");
          }}
        >
          Clear all
        </Button>
      </div>

      {activities.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No activities found</EmptyTitle>
            <EmptyDescription>Activities are logged from lead, account, and contact detail pages.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Related</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Badge color="neutral">{a.relatedType}</Badge>
                </TableCell>
                <TableCell className="capitalize">{a.type}</TableCell>
                <TableCell>{a.subject ?? "—"}</TableCell>
                <TableCell>{employeeName(a.performedBy)}</TableCell>
                <TableCell>{timeAgo(a.activityDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
