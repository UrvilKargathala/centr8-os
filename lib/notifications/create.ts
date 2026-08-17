import { randomUUID } from "node:crypto";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { notifications } from "@/db/schema";

export type NotificationType =
  | "task_assigned"
  | "task_overdue"
  | "mention"
  | "leave_approved"
  | "leave_rejected"
  | "leave_request_pending"
  | "deal_stage_changed"
  | "deal_won"
  | "lead_assigned"
  | "sprint_plan_pending"
  | "ai_recommendation"
  | "hr_case_update"
  | "review_due"
  | "document_ready"
  | "system";

// Default icon per type — the bell dropdown/full page key off this to color
// the row's icon circle (see NOTIFICATION_ICON in components/notifications).
const DEFAULT_ICON: Record<NotificationType, string> = {
  task_assigned: "clipboard",
  task_overdue: "alert-triangle",
  mention: "chat",
  leave_approved: "check-circle",
  leave_rejected: "x-circle",
  leave_request_pending: "clock",
  deal_stage_changed: "trending",
  deal_won: "check-circle",
  lead_assigned: "user",
  sprint_plan_pending: "clipboard",
  ai_recommendation: "sparkle",
  hr_case_update: "briefcase",
  review_due: "clock",
  document_ready: "document",
  system: "bell",
};

export type LinkType = "project" | "task" | "deal" | "lead" | "employee" | "leave_request" | "document" | "sprint_plan" | "hr_case";

export async function createNotification(
  db: OrgScopedDb,
  params: {
    orgId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    linkType?: LinkType;
    linkId?: string;
  },
) {
  // No .returning() here deliberately: INSERT ... RETURNING also has to
  // satisfy the SELECT policy on the row it hands back, and
  // notifications_select requires user_id = auth.uid() — but the actor
  // creating a notification is almost never its recipient (a manager
  // notifying a requester), so RETURNING would fail the row-security check
  // even though the INSERT itself is allowed. Generate the id client-side
  // instead and return the known values directly.
  const row = {
    id: randomUUID(),
    orgId: params.orgId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    icon: DEFAULT_ICON[params.type],
    linkType: params.linkType ?? null,
    linkId: params.linkId ?? null,
    isRead: false,
    readAt: null as Date | null,
    createdAt: new Date(),
  };
  await db.insert(notifications).values(row);
  return row;
}
