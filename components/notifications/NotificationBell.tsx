"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { linkFor, notificationIconBg, notificationMeta, type Notification } from "./shared";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

type Approval = { id: string; action: string; agent: string; preview: string };

export function NotificationBell({ orgId }: { orgId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"notifications" | "approvals">("notifications");
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const totalBadge = unreadCount + approvals.length;

  function refreshCount() {
    if (!orgId) return;
    fetch(`/api/notifications/unread-count?org_id=${orgId}`)
      .then((r) => r.json())
      .then((body) => setUnreadCount(body.data?.count ?? 0));
  }

  function refreshApprovals() {
    if (!orgId) return;
    fetch(`/api/ai/sprint-plans?org_id=${orgId}&status=pending`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) =>
        setApprovals(
          (j.data ?? []).map((p: { id: string; title?: string; summary?: string }) => ({
            id: p.id,
            action: p.title ?? "Sprint plan",
            agent: "Planner",
            preview: p.summary ?? "",
          }))
        )
      )
      .catch(() => {});
  }

  useEffect(() => {
    refreshCount();
    refreshApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    function onFocus() {
      refreshCount();
      refreshApprovals();
    }
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => { refreshCount(); refreshApprovals(); }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function loadList() {
    if (!orgId) return;
    setLoading(true);
    fetch(`/api/notifications?org_id=${orgId}&limit=8`)
      .then((r) => r.json())
      .then((body) => setItems(body.data ?? []))
      .finally(() => setLoading(false));
  }

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) loadList();
      return next;
    });
  }

  function markAllRead() {
    if (!orgId) return;
    fetch(`/api/notifications/mark-all-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    }).then(() => {
      setItems((list) => list.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  }

  function openNotification(n: Notification) {
    if (!n.isRead) {
      fetch(`/api/notifications/${n.id}/read`, { method: "POST" }).then(() => {
        setUnreadCount((c) => Math.max(0, c - 1));
      });
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    setOpen(false);
    const href = linkFor(n);
    if (href) router.push(href);
  }

  function handleApprove(id: string) {
    fetch(`/api/ai/sprint-plans/${id}/approve`, { method: "POST" })
      .then((r) => { if (r.ok) setApprovals((list) => list.filter((x) => x.id !== id)); });
  }

  function handleReject(id: string) {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    fetch(`/api/ai/sprint-plans/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: reason }),
    }).then((r) => { if (r.ok) setApprovals((list) => list.filter((x) => x.id !== id)); });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        title="Notifications & Approvals"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-200"
      >
        <BellIcon />
        {totalBadge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-caption font-medium text-neutral-50">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-full z-50 mt-1 w-96 rounded-md shadow-lg">
          {/* Tab bar */}
          <div className="flex border-b border-neutral-200">
            <button
              type="button"
              onClick={() => setTab("notifications")}
              className={`flex-1 px-4 py-2.5 text-small font-medium ${
                tab === "notifications"
                  ? "border-b-2 border-primary-600 text-primary-700"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setTab("approvals")}
              className={`flex-1 px-4 py-2.5 text-small font-medium ${
                tab === "approvals"
                  ? "border-b-2 border-primary-600 text-primary-700"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Approvals{approvals.length > 0 ? ` (${approvals.length})` : ""}
            </button>
          </div>

          {tab === "notifications" ? (
            <>
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <p className="px-4 py-6 text-center text-body text-neutral-600">Loading…</p>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <BellIcon className="h-6 w-6 text-neutral-300" />
                    <p className="text-body text-neutral-500">No notifications yet</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-200">
                    {items.map((n) => {
                      const meta = notificationMeta(n.type);
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => openNotification(n)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-100 ${
                              !n.isRead ? "bg-neutral-100" : ""
                            }`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${notificationIconBg(meta.color)}`}>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={meta.path} />
                              </svg>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-medium font-medium text-neutral-950">{n.title}</span>
                              {n.body && <span className="block truncate text-small text-neutral-600">{n.body}</span>}
                              <span className="block text-caption text-neutral-400">{timeAgo(n.createdAt)}</span>
                            </span>
                            {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2">
                <button type="button" onClick={markAllRead} className="text-small text-primary-700 underline">
                  Mark all as read
                </button>
                <Link href="/notifications" onClick={() => setOpen(false)} className="text-small font-medium text-primary-700 underline">
                  View All
                </Link>
              </div>
            </>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {approvals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <svg className="h-6 w-6 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-body text-neutral-500">Nothing waiting on you</p>
                  <p className="text-caption text-neutral-400">AI actions queued for review (Tier 1)</p>
                </div>
              ) : (
                <ul className="divide-y divide-neutral-200">
                  {approvals.map((a) => (
                    <li key={a.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-body-medium font-medium text-neutral-950">{a.action}</p>
                          <p className="text-caption text-neutral-500">{a.agent}</p>
                        </div>
                      </div>
                      <p className="line-clamp-2 rounded-sm bg-ai-100 px-2 py-1 text-small text-neutral-700">
                        {a.preview}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(a.id)}
                          className="rounded-sm bg-primary-600 px-2.5 py-1 text-small font-medium text-neutral-50 hover:bg-primary-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(a.id)}
                          className="rounded-sm border border-neutral-300 px-2.5 py-1 text-small font-medium text-neutral-700 hover:bg-neutral-200"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
