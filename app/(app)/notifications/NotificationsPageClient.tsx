"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Button } from "@/components/ui/Button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";
import { linkFor, notificationIconBg, notificationMeta, type Notification } from "@/components/notifications/shared";
import { PageSkeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function groupByDate(items: Notification[]): [string, Notification[]][] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  const buckets: Record<string, Notification[]> = { Today: [], Yesterday: [], "This week": [], Earlier: [] };
  for (const item of items) {
    const t = new Date(item.createdAt);
    if (t >= startOfToday) buckets.Today.push(item);
    else if (t >= startOfYesterday) buckets.Yesterday.push(item);
    else if (t >= startOfWeek) buckets["This week"].push(item);
    else buckets.Earlier.push(item);
  }
  return Object.entries(buckets).filter(([, list]) => list.length > 0);
}

const FILTERS = ["All", "Unread", "project", "hr", "crm", "ai"] as const;
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  All: "All",
  Unread: "Unread",
  project: "Project",
  hr: "HR",
  crm: "CRM",
  ai: "AI",
};
const PAGE_SIZE = 20;

export type NotificationsInitialData = { items: Notification[]; hasMore: boolean };

export default function NotificationsPageClient({ initial }: { initial?: NotificationsInitialData }) {
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const [items, setItems] = useState<Notification[]>(initial?.items ?? []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function load(offset: number) {
    if (!selectedOrgId) return;
    setLoading(true);
    fetch(`/api/notifications?org_id=${selectedOrgId}&limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => r.json())
      .then((body) => {
        const rows = (body.data ?? []) as Notification[];
        setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => setLoading(false));
  }

  const skippedInitialLoad = useRef(!!initial);
  useEffect(() => {
    if (skippedInitialLoad.current) {
      skippedInitialLoad.current = false;
      return;
    }
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  const visible = useMemo(() => {
    if (filter === "All") return items;
    if (filter === "Unread") return items.filter((n) => !n.isRead);
    return items.filter((n) => notificationMeta(n.type).category === filter);
  }, [items, filter]);

  const grouped = useMemo(() => groupByDate(visible), [visible]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markAllRead() {
    if (!selectedOrgId) return;
    fetch(`/api/notifications/mark-all-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: selectedOrgId }),
    }).then(() => setItems((list) => list.map((n) => ({ ...n, isRead: true }))));
  }

  function bulkMarkRead() {
    const ids = [...selected];
    Promise.all(ids.map((id) => fetch(`/api/notifications/${id}/read`, { method: "POST" }))).then(() => {
      setItems((list) => list.map((n) => (selected.has(n.id) ? { ...n, isRead: true } : n)));
      setSelected(new Set());
    });
  }

  function bulkDismiss() {
    const ids = [...selected];
    Promise.all(ids.map((id) => fetch(`/api/notifications/${id}`, { method: "DELETE" }))).then(() => {
      setItems((list) => list.filter((n) => !selected.has(n.id)));
      setSelected(new Set());
    });
  }

  if (orgLoading) return <PageSkeleton variant="table" />;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-h2 font-bold text-neutral-950">Notifications</h1>
          <p className="text-body text-neutral-600">Everything that needs your attention, in one place.</p>
        </div>
        <Button variant="secondary" onClick={markAllRead}>
          Mark all as read
        </Button>
      </div>

      <div className="flex w-fit gap-1 glass p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-sm px-3 py-1 text-small font-medium ${filter === f ? "bg-primary-600 text-neutral-50" : "text-neutral-600"}`}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-primary-300 bg-primary-100 px-4 py-2">
          <p className="text-small text-primary-700">{selected.size} selected</p>
          <button type="button" onClick={bulkMarkRead} className="text-small font-medium text-primary-700 underline">
            Mark read
          </button>
          <button type="button" onClick={bulkDismiss} className="text-small font-medium text-danger-600 underline">
            Dismiss
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-small text-neutral-600 underline">
            Clear selection
          </button>
        </div>
      )}

      {visible.length === 0 && !loading ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No notifications</EmptyTitle>
            <EmptyDescription>You&apos;re all caught up.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-6">
          {grouped.map(([label, group]) => (
            <div key={label} className="space-y-2">
              <p className="text-caption font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
              <div className="glass-table divide-y divide-neutral-200">
                {group.map((n) => {
                  const meta = notificationMeta(n.type);
                  const href = linkFor(n);
                  return (
                    <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${!n.isRead ? "bg-neutral-100" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                        className="mt-1.5 h-4 w-4 shrink-0 rounded border-neutral-400"
                      />
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notificationIconBg(meta.color)}`}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={meta.path} />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={href ?? undefined}
                          onClick={() => {
                            if (!n.isRead) {
                              fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
                              setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                            }
                          }}
                          className={`block text-body-medium font-medium ${href ? "cursor-pointer hover:underline" : ""} text-neutral-950`}
                        >
                          {n.title}
                        </a>
                        {n.body && <p className="text-small text-neutral-600">{n.body}</p>}
                        <p className="text-caption text-neutral-400">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && visible.length > 0 && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => load(items.length)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
