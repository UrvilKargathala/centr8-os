"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeColor } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const ACTION_COLORS: Record<string, BadgeColor> = {
  create: "success",
  update: "info",
  delete: "danger",
  approve: "success",
  reject: "warning",
  assign: "info",
  convert: "ai",
};

function actionColor(action: string): BadgeColor {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return "neutral";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function AuditLogPage() {
  const { selectedOrgId } = useOrg();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    fetch(`/api/audit-log?org_id=${selectedOrgId}&limit=${limit}`)
      .then((r) => r.json())
      .then((json) => setEntries(json.data ?? []))
      .finally(() => setLoading(false));
  }, [selectedOrgId, limit]);

  const targetTypes = [...new Set(entries.map((e) => e.targetType))].sort();
  const filtered = filter === "all" ? entries : entries.filter((e) => e.targetType === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-950">Audit Log</h1>
        <p className="text-body text-neutral-500">Every action taken across the organization, logged automatically.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-small font-medium ${filter === "all" ? "bg-primary-600 text-neutral-50" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}`}
        >
          All
        </button>
        {targetTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-small font-medium capitalize ${filter === t ? "bg-primary-600 text-neutral-50" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}`}
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <p className="py-8 text-center text-body text-neutral-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <svg className="h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </EmptyMedia>
              <EmptyTitle>No audit entries</EmptyTitle>
              <EmptyDescription>Actions will appear here as they happen.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(e.createdAt)}</TableCell>
                      <TableCell>
                        <Badge color={e.actorType === "ai" ? "ai" : "neutral"}>{e.actorType === "ai" ? "AI" : "User"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={actionColor(e.action)}>{e.action.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="capitalize text-neutral-700">{e.targetType.replace(/_/g, " ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {entries.length >= limit && (
              <div className="mt-4 text-center">
                <Button variant="secondary" onClick={() => setLimit((l) => l + 50)}>Load more</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
