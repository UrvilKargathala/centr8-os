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

export function NotificationBell({ orgId }: { orgId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function refreshCount() {
    if (!orgId) return;
    fetch(`/api/notifications/unread-count?org_id=${orgId}`)
      .then((r) => r.json())
      .then((body) => setUnreadCount(body.data?.count ?? 0));
  }

  useEffect(() => {
    refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    function onFocus() {
      refreshCount();
    }
    window.addEventListener("focus", onFocus);
    const interval = setInterval(refreshCount, 60_000);
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        title="Notifications"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-200"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-caption font-medium text-neutral-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 rounded-md border border-neutral-300 bg-neutral-50 shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
            <p className="font-heading text-body-medium font-semibold text-neutral-950">Notifications</p>
            <Link
              href="/settings/profile"
              onClick={() => setOpen(false)}
              title="Notification settings"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>

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
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
