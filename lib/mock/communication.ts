// Mock data for Communication pages not yet backed by real connectors
// (Mail, Calls). Messenger and Video are already wired to ClickUp Chat
// and Google Meet respectively.

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString();
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();

// ─────────────────────────────────────────────────────────────
// Slack (Messenger)
// ─────────────────────────────────────────────────────────────

export type SlackChannel = {
  id: string;
  name: string;
  unread_count: number;
  last_message_preview: string;
  last_message_at: string;
  member_count: number;
};
export type SlackDm = {
  id: string;
  user_name: string;
  avatar_initial: string;
  unread_count: number;
  last_message_preview: string;
  last_message_at: string;
};
export type SlackMessage = {
  id: string;
  sender_name: string;
  avatar_initial: string;
  content: string;
  sent_at: string;
  reactions: { emoji: string; count: number }[];
};

export const mockSlack: {
  channels: SlackChannel[];
  dms: SlackDm[];
  messages_by_channel: Record<string, SlackMessage[]>;
} = {
  channels: [
    { id: "c-general", name: "general", unread_count: 0, last_message_preview: "Welcome to the team!", last_message_at: daysAgo(1), member_count: 12 },
    { id: "c-eng", name: "engineering", unread_count: 4, last_message_preview: "PR #482 merged — deploying to prod", last_message_at: hoursAgo(2), member_count: 6 },
    { id: "c-design", name: "design", unread_count: 1, last_message_preview: "New hero mock in Figma, feedback welcome", last_message_at: hoursAgo(4), member_count: 4 },
    { id: "c-clients", name: "clients-acme", unread_count: 2, last_message_preview: "Can we push the review to Thursday?", last_message_at: hoursAgo(6), member_count: 5 },
    { id: "c-standup", name: "standup", unread_count: 0, last_message_preview: "Devon: Working on migration today", last_message_at: hoursAgo(8), member_count: 8 },
  ],
  dms: [
    { id: "dm-milind", user_name: "Milind Bhalala", avatar_initial: "MB", unread_count: 1, last_message_preview: "Quick call after lunch?", last_message_at: hoursAgo(3) },
    { id: "dm-aditi", user_name: "Aditi Rao", avatar_initial: "AR", unread_count: 0, last_message_preview: "Sent you the review link", last_message_at: hoursAgo(12) },
    { id: "dm-jules", user_name: "Jules Novak", avatar_initial: "JN", unread_count: 3, last_message_preview: "Client loved the new palette", last_message_at: hoursAgo(1) },
  ],
  messages_by_channel: {
    "c-eng": [
      { id: "m1", sender_name: "Devon Park", avatar_initial: "DP", content: "Migration 0067 shipped clean — no rollback needed", sent_at: hoursAgo(3), reactions: [{ emoji: "🎉", count: 3 }] },
      { id: "m2", sender_name: "Aditi Rao", avatar_initial: "AR", content: "Nice — bumping the review queue then", sent_at: hoursAgo(3), reactions: [] },
      { id: "m3", sender_name: "Marco Silva", avatar_initial: "MS", content: "PR #482 ready when you have a moment", sent_at: hoursAgo(2), reactions: [{ emoji: "👀", count: 2 }] },
      { id: "m4", sender_name: "Devon Park", avatar_initial: "DP", content: "Reviewing now", sent_at: hoursAgo(2), reactions: [] },
    ],
    "c-design": [
      { id: "m5", sender_name: "Jules Novak", avatar_initial: "JN", content: "New hero mock is in — feedback welcome. Went with the softer gradient we discussed.", sent_at: hoursAgo(4), reactions: [{ emoji: "🔥", count: 2 }] },
      { id: "m6", sender_name: "Chen Wu", avatar_initial: "CW", content: "Love it. One thought — can we tighten the CTA spacing?", sent_at: hoursAgo(4), reactions: [] },
    ],
    "c-clients": [
      { id: "m7", sender_name: "Sofía Lima", avatar_initial: "SL", content: "Acme just replied — they want to push the review to Thursday. Any conflicts?", sent_at: hoursAgo(6), reactions: [] },
      { id: "m8", sender_name: "Ravi Kapoor", avatar_initial: "RK", content: "Thursday works for me. Let me update the calendar.", sent_at: hoursAgo(5), reactions: [{ emoji: "👍", count: 1 }] },
    ],
    "c-general": [
      { id: "m9", sender_name: "Urvil Kargathala", avatar_initial: "UK", content: "Welcome Milind — glad to have you on the team!", sent_at: daysAgo(1), reactions: [{ emoji: "👋", count: 4 }] },
    ],
    "c-standup": [
      { id: "m10", sender_name: "Devon Park", avatar_initial: "DP", content: "Yesterday: migration. Today: continuing the DB work. Blockers: none.", sent_at: hoursAgo(8), reactions: [] },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Gmail (Mail)
// ─────────────────────────────────────────────────────────────

export type GmailEmail = {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  preview: string;
  is_unread: boolean;
  is_starred: boolean;
  requires_reply: boolean;
  received_at: string;
  has_attachments: boolean;
};
export type GmailMessage = {
  id: string;
  from_name: string;
  from_email: string;
  to: string[];
  cc?: string[];
  body: string;
  sent_at: string;
  attachments?: { name: string; size_kb: number }[];
};

export const mockGmail: {
  inbox: GmailEmail[];
  threads_by_id: Record<string, GmailMessage[]>;
} = {
  inbox: [
    { id: "e1", from_name: "Sarah Chen (Acme)", from_email: "sarah@acme.co", subject: "Sprint 3 review — moving to Thursday?", preview: "Hi team, we'd like to push the sprint 3 review to Thursday…", is_unread: true, is_starred: true, requires_reply: true, received_at: hoursAgo(2), has_attachments: false },
    { id: "e2", from_name: "GitHub", from_email: "notifications@github.com", subject: "[centr8-os] PR #482: Add project members table", preview: "Marco Silva opened a pull request…", is_unread: true, is_starred: false, requires_reply: false, received_at: hoursAgo(3), has_attachments: false },
    { id: "e3", from_name: "Vercel", from_email: "support@vercel.com", subject: "Your production deployment is live", preview: "centr8-os-amber.vercel.app deployed successfully…", is_unread: true, is_starred: false, requires_reply: false, received_at: hoursAgo(4), has_attachments: false },
    { id: "e4", from_name: "Diana at Beacon", from_email: "diana@beacon.io", subject: "Following up on our chat — proposal attached", preview: "Great chatting yesterday. Sending over the SOW as promised…", is_unread: true, is_starred: false, requires_reply: true, received_at: hoursAgo(6), has_attachments: true },
    { id: "e5", from_name: "Stripe", from_email: "receipts@stripe.com", subject: "Your July invoice is ready", preview: "$4,200.00 charged to Visa ending 4242…", is_unread: false, is_starred: false, requires_reply: false, received_at: daysAgo(1), has_attachments: true },
    { id: "e6", from_name: "Newsletter — Product Hunt", from_email: "digest@producthunt.com", subject: "Today's top launches", preview: "5 new products worth checking out…", is_unread: false, is_starred: false, requires_reply: false, received_at: daysAgo(1), has_attachments: false },
    { id: "e7", from_name: "Priya Nair", from_email: "priya@centr8.co", subject: "Notes from client sync", preview: "Wrote up what we talked about. Feel free to edit…", is_unread: false, is_starred: true, requires_reply: false, received_at: daysAgo(2), has_attachments: true },
  ],
  threads_by_id: {
    e1: [
      { id: "e1-1", from_name: "Sarah Chen (Acme)", from_email: "sarah@acme.co", to: ["team@centr8.co"], body: "Hi team, we'd like to push the sprint 3 review to Thursday. Something came up on our side and Wednesday isn't going to work. Same time — 2pm? Let me know if that clashes with anything.\n\nSarah", sent_at: hoursAgo(2) },
    ],
    e4: [
      { id: "e4-1", from_name: "Diana at Beacon", from_email: "diana@beacon.io", to: ["urvil@centr8.co"], body: "Great chatting yesterday. As promised, attaching the SOW for review. Standard terms, 90-day pilot, $25k. Let me know if anything needs to change.\n\nDiana", sent_at: hoursAgo(6), attachments: [{ name: "beacon-sow-2026-07.pdf", size_kb: 340 }] },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Calls
// ─────────────────────────────────────────────────────────────

export type CallLogEntry = {
  id: string;
  participant_name: string;
  participant_phone: string;
  avatar_initial: string;
  direction: "incoming" | "outgoing" | "missed";
  duration_seconds: number;
  occurred_at: string;
  linked_contact_id: string | null;
  linked_contact_name?: string;
  notes: string | null;
};

export const mockCalls: { log: CallLogEntry[] } = {
  log: [
    { id: "call-1", participant_name: "Sarah Chen", participant_phone: "+1 415-555-0142", avatar_initial: "SC", direction: "incoming", duration_seconds: 24 * 60 + 12, occurred_at: hoursAgo(1), linked_contact_id: "c-acme-sarah", linked_contact_name: "Sarah Chen (Acme)", notes: "Discussed sprint 3 timing. She'll follow up in email." },
    { id: "call-2", participant_name: "Diana Ford", participant_phone: "+1 415-555-0189", avatar_initial: "DF", direction: "outgoing", duration_seconds: 18 * 60 + 4, occurred_at: hoursAgo(4), linked_contact_id: "c-beacon-diana", linked_contact_name: "Diana Ford (Beacon)", notes: "Walked through the SOW. Green light on pilot terms." },
    { id: "call-3", participant_name: "Unknown", participant_phone: "+1 415-555-9922", avatar_initial: "?", direction: "missed", duration_seconds: 0, occurred_at: hoursAgo(6), linked_contact_id: null, notes: null },
    { id: "call-4", participant_name: "Milind Bhalala", participant_phone: "+91 98240-11122", avatar_initial: "MB", direction: "outgoing", duration_seconds: 3 * 60 + 45, occurred_at: hoursAgo(7), linked_contact_id: null, notes: "Quick sync on next-quarter plan." },
    { id: "call-5", participant_name: "James O'Brien", participant_phone: "+44 20 7946 0958", avatar_initial: "JO", direction: "missed", duration_seconds: 0, occurred_at: daysAgo(1), linked_contact_id: null, notes: null },
    { id: "call-6", participant_name: "Priya Nair", participant_phone: "+1 415-555-0104", avatar_initial: "PN", direction: "incoming", duration_seconds: 32 * 60 + 8, occurred_at: daysAgo(1), linked_contact_id: null, notes: "Long call — walked through the design system rewrite." },
    { id: "call-7", participant_name: "Support — Vercel", participant_phone: "+1 800-555-4433", avatar_initial: "V", direction: "outgoing", duration_seconds: 8 * 60 + 22, occurred_at: daysAgo(2), linked_contact_id: null, notes: "Resolved the framework preset issue." },
  ],
};

// ─────────────────────────────────────────────────────────────
// Zoom (Video)
// ─────────────────────────────────────────────────────────────

export type ZoomMeeting = {
  id: string;
  title: string;
  participants: { name: string; avatar_initial: string }[];
  start_time: string;
  duration_minutes: number;
  join_url: string;
  has_transcript?: boolean;
  has_recording?: boolean;
  transcript_preview?: string;
};

export const mockZoom: {
  upcoming: ZoomMeeting[];
  past: ZoomMeeting[];
} = {
  upcoming: [
    {
      id: "z-1",
      title: "Sprint 3 review — Acme",
      participants: [
        { name: "Sarah Chen", avatar_initial: "SC" },
        { name: "Urvil Kargathala", avatar_initial: "UK" },
        { name: "Milind Bhalala", avatar_initial: "MB" },
      ],
      start_time: inHours(2),
      duration_minutes: 60,
      join_url: "https://meet.google.com/mock-abc-defg",
    },
    {
      id: "z-2",
      title: "Design system sync",
      participants: [
        { name: "Jules Novak", avatar_initial: "JN" },
        { name: "Chen Wu", avatar_initial: "CW" },
        { name: "Aditi Rao", avatar_initial: "AR" },
      ],
      start_time: inHours(6),
      duration_minutes: 30,
      join_url: "https://meet.google.com/mock-hij-klmn",
    },
    {
      id: "z-3",
      title: "Weekly all-hands",
      participants: [
        { name: "Urvil Kargathala", avatar_initial: "UK" },
        { name: "Milind Bhalala", avatar_initial: "MB" },
        { name: "Priya Nair", avatar_initial: "PN" },
        { name: "Marco Silva", avatar_initial: "MS" },
      ],
      start_time: inHours(28),
      duration_minutes: 45,
      join_url: "https://meet.google.com/mock-opq-rstu",
    },
  ],
  past: [
    {
      id: "z-p1",
      title: "Kickoff — Beacon pilot",
      participants: [
        { name: "Diana Ford", avatar_initial: "DF" },
        { name: "Urvil Kargathala", avatar_initial: "UK" },
      ],
      start_time: daysAgo(1),
      duration_minutes: 45,
      join_url: "",
      has_transcript: true,
      has_recording: true,
      transcript_preview: "Diana: Excited to kick this off. Timeline is aggressive but we've done tighter…\nUrvil: We can hit the 30-day target. Main risk is the data-import piece…",
    },
    {
      id: "z-p2",
      title: "Standup — Engineering",
      participants: [
        { name: "Devon Park", avatar_initial: "DP" },
        { name: "Marco Silva", avatar_initial: "MS" },
        { name: "Aditi Rao", avatar_initial: "AR" },
      ],
      start_time: daysAgo(1),
      duration_minutes: 15,
      join_url: "",
      has_transcript: false,
      has_recording: false,
    },
    {
      id: "z-p3",
      title: "1:1 — Milind + Urvil",
      participants: [
        { name: "Milind Bhalala", avatar_initial: "MB" },
        { name: "Urvil Kargathala", avatar_initial: "UK" },
      ],
      start_time: daysAgo(3),
      duration_minutes: 30,
      join_url: "",
      has_transcript: true,
      has_recording: false,
      transcript_preview: "Milind: Q3 focus — three things. Urvil: Agreed, and let's write these down…",
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Cross-source activity feed for the unified inbox
// ─────────────────────────────────────────────────────────────

export type ActivityItem = {
  id: string;
  source: "slack" | "mail" | "call" | "zoom";
  actor: string;
  preview: string;
  at: string;
  href: string;
};
export function buildActivityFeed(): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const c of mockSlack.channels.filter((x) => x.unread_count > 0)) {
    items.push({ id: `s-${c.id}`, source: "slack", actor: `#${c.name}`, preview: c.last_message_preview, at: c.last_message_at, href: "/communication/messenger" });
  }
  for (const dm of mockSlack.dms.filter((x) => x.unread_count > 0)) {
    items.push({ id: `sdm-${dm.id}`, source: "slack", actor: dm.user_name, preview: dm.last_message_preview, at: dm.last_message_at, href: "/communication/messenger" });
  }
  for (const e of mockGmail.inbox.filter((x) => x.is_unread)) {
    items.push({ id: `e-${e.id}`, source: "mail", actor: e.from_name, preview: e.subject, at: e.received_at, href: "/communication/mail" });
  }
  for (const c of mockCalls.log) {
    items.push({
      id: `c-${c.id}`,
      source: "call",
      actor: c.participant_name,
      preview: c.direction === "missed" ? "Missed call" : c.direction === "incoming" ? `Incoming · ${Math.round(c.duration_seconds / 60)}m` : `Outgoing · ${Math.round(c.duration_seconds / 60)}m`,
      at: c.occurred_at,
      href: "/communication/calls",
    });
  }
  for (const m of mockZoom.upcoming) {
    items.push({ id: `z-${m.id}`, source: "zoom", actor: m.title, preview: `${m.duration_minutes} min · ${m.participants.length} people`, at: m.start_time, href: "/communication/video" });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 20);
}

// Helpers used by the Unified Inbox summary cards.
export function slackTotalUnread() {
  return mockSlack.channels.reduce((s, c) => s + c.unread_count, 0) + mockSlack.dms.reduce((s, d) => s + d.unread_count, 0);
}
export function gmailUnread() {
  return mockGmail.inbox.filter((e) => e.is_unread).length;
}
export function gmailRequiresReply() {
  return mockGmail.inbox.filter((e) => e.requires_reply).length;
}
export function callsToday() {
  const now = new Date();
  return mockCalls.log.filter((c) => new Date(c.occurred_at) > new Date(now.getTime() - 86400000)).length;
}
export function callsMissedToday() {
  const now = new Date();
  return mockCalls.log.filter((c) => c.direction === "missed" && new Date(c.occurred_at) > new Date(now.getTime() - 86400000)).length;
}
export function nextMeeting() {
  return mockZoom.upcoming[0] ?? null;
}
