import type { BadgeColor } from "@/components/ui/Badge";

export type Notification = {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  linkType: string | null;
  linkId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

// Shared between the bell dropdown and the full /notifications page — both
// need the exact same icon+color per type, unlike timeAgo() which is
// harmless to duplicate since it has no cross-surface consistency need.
const TYPE_META: Record<string, { path: string; color: BadgeColor; category: "project" | "hr" | "crm" | "ai" }> = {
  task_assigned: { path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "info", category: "project" },
  task_overdue: { path: "M12 9v2m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 004.11 21h15.78a2 2 0 001.99-2.96L13.71 3.86a2 2 0 00-3.42 0z", color: "danger", category: "project" },
  mention: { path: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", color: "info", category: "project" },
  leave_approved: { path: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "success", category: "hr" },
  leave_rejected: { path: "M6 18L18 6M6 6l12 12", color: "danger", category: "hr" },
  leave_request_pending: { path: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "warning", category: "hr" },
  hr_case_update: { path: "M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01", color: "info", category: "hr" },
  review_due: { path: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "warning", category: "hr" },
  deal_stage_changed: { path: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "warning", category: "crm" },
  deal_won: { path: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "success", category: "crm" },
  lead_assigned: { path: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8", color: "info", category: "crm" },
  sprint_plan_pending: { path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "info", category: "ai" },
  ai_recommendation: { path: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z", color: "ai", category: "ai" },
  document_ready: { path: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z", color: "ai", category: "ai" },
  system: { path: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", color: "neutral", category: "project" },
};

export function notificationMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.system;
}

const ICON_BG: Record<BadgeColor, string> = {
  neutral: "bg-neutral-200 text-neutral-700",
  info: "bg-info-100 text-info-600",
  warning: "bg-warning-100 text-warning-600",
  danger: "bg-danger-100 text-danger-600",
  success: "bg-success-100 text-success-600",
  ai: "bg-ai-100 text-ai-600",
};
export function notificationIconBg(color: BadgeColor) {
  return ICON_BG[color];
}

export function linkFor(n: Notification): string | null {
  if (!n.linkId) return null;
  switch (n.linkType) {
    case "project":
      return `/projects/${n.linkId}`;
    case "task":
      return `/tasks`;
    case "deal":
      return `/crm/deals/${n.linkId}`;
    case "lead":
      return `/crm/leads`;
    case "employee":
      return `/hr/employees/${n.linkId}`;
    case "leave_request":
      return `/hr/leave`;
    case "document":
      return `/ai/documents/${n.linkId}`;
    case "sprint_plan":
      return `/ai/sprint-plans`;
    case "hr_case":
      return `/hr/cases`;
    default:
      return null;
  }
}
