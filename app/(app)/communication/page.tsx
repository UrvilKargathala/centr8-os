"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  buildActivityFeed,
  slackTotalUnread,
  gmailUnread,
  gmailRequiresReply,
  callsToday,
  callsMissedToday,
  nextMeeting,
  mockSlack,
} from "@/lib/mock/communication";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
function inLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hrs = Math.round(diff / 3600000);
  if (hrs < 1) return "starting soon";
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

export default function UnifiedInboxPage() {
  const [compose, setCompose] = useState(false);
  const toast = useToast();
  const feed = buildActivityFeed();
  const next = nextMeeting();

  const activeChannelsToday = mockSlack.channels.filter((c) => new Date(c.last_message_at) > new Date(Date.now() - 86400_000)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-display font-semibold text-neutral-950">Communication</h1>
          <p className="mt-1 text-body text-neutral-600">Your unified activity across connected tools</p>
        </div>
        <Button onClick={() => setCompose(true)}>+ Compose</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          href="/communication/messenger"
          icon={ICON_CHAT}
          label="Slack"
          value={slackTotalUnread()}
          sub={`${activeChannelsToday} channels active today`}
        />
        <SummaryCard
          href="/communication/mail"
          icon={ICON_MAIL}
          label="Mail"
          value={gmailUnread()}
          sub={`${gmailRequiresReply()} require a reply`}
        />
        <SummaryCard
          href="/communication/calls"
          icon={ICON_PHONE}
          label="Calls"
          value={callsToday()}
          sub={`${callsMissedToday()} missed today`}
        />
        <SummaryCard
          href="/communication/video"
          icon={ICON_VIDEO}
          label="Meetings"
          value={next ? new Date(next.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—"}
          sub={next ? `${next.title} · ${inLabel(next.start_time)}` : "No upcoming meetings"}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-h3 font-semibold text-neutral-950">Recent activity</h2>
          <span className="text-caption text-neutral-500">Last 24 hours</span>
        </div>
        {feed.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <p className="font-medium text-neutral-950">No recent activity</p>
            <p className="mt-1 text-small text-neutral-600">
              Once you&apos;re connected and active, your latest messages, emails, and meetings will show here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
            {feed.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-100">
                  <SourceIcon source={item.source} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-medium font-medium text-neutral-950">{item.actor}</p>
                    <p className="truncate text-small text-neutral-600">{item.preview}</p>
                  </div>
                  <span className="shrink-0 text-caption text-neutral-500">{timeAgo(item.at)}</span>
                  <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {compose && (
        <Modal onClose={() => setCompose(false)} maxWidth="max-w-md">
          <div className="space-y-3">
            <h3 className="font-heading text-h3 font-semibold text-neutral-950">Compose</h3>
            <p className="text-small text-neutral-600">Pick what you want to send.</p>
            <div className="space-y-2">
              {[
                { label: "Send email", note: "Opens Gmail composer (Phase 7 wiring)." },
                { label: "Send Slack message", note: "Posts to a channel or DM (Phase 7 wiring)." },
                { label: "Schedule meeting", note: "Creates a Google Meet meeting + Calendar invite (Phase 7 wiring)." },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    console.log("Compose action:", opt.label);
                    toast.show("Mock mode — not sent");
                    setCompose(false);
                  }}
                  className="w-full rounded-md border border-neutral-300 bg-neutral-50 p-3 text-left hover:bg-neutral-100"
                >
                  <p className="text-body-medium font-medium text-neutral-950">{opt.label}</p>
                  <p className="text-caption text-neutral-500">{opt.note}</p>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  href,
  icon,
  label,
  value,
  sub,
}: {
  href: string;
  icon: string;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-between rounded-md border border-neutral-300 border-l-4 border-l-warning-600 bg-neutral-50 p-4 hover:bg-neutral-100"
    >
      <div className="flex items-center gap-2 text-warning-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <span className="text-caption font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-4 font-heading text-h1 font-bold text-neutral-950">{value}</p>
      <p className="mt-0.5 text-caption text-neutral-500">{sub}</p>
    </Link>
  );
}

function SourceIcon({ source }: { source: "slack" | "mail" | "call" | "zoom" }) {
  const map = {
    slack: { path: ICON_CHAT, tone: "text-warning-600 bg-warning-100" },
    mail: { path: ICON_MAIL, tone: "text-info-600 bg-info-100" },
    call: { path: ICON_PHONE, tone: "text-success-600 bg-success-100" },
    zoom: { path: ICON_VIDEO, tone: "text-ai-600 bg-ai-100" },
  }[source];
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${map.tone}`}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={map.path} />
      </svg>
    </span>
  );
}

const ICON_CHAT = "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z";
const ICON_MAIL = "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
const ICON_PHONE = "M3 5a2 2 0 012-2h3.28a1 1 0 011 .76l1.12 4.49a1 1 0 01-.29.95l-1.6 1.6a11.04 11.04 0 005.53 5.53l1.6-1.6a1 1 0 01.95-.29l4.49 1.12a1 1 0 01.76 1V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z";
const ICON_VIDEO = "M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z";
