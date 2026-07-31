// DESIGN_SYSTEM.md §2 "Status Badge Mapping" gives five semantic buckets
// (Not Started, In Progress, In Review, Blocked, Done) plus AI Draft — but
// this app has several concrete status vocabularies (project/sprint/task
// status, task priority) that don't 1:1 match those five names. Every value
// below is placed into the closest semantic bucket rather than inventing a
// new color, per §5/§6 ("never freehand colors"). Judgment calls, made
// explicit here rather than silently:
//   - on_hold / archived / cancelled have no direct bucket. on_hold reads as
//     "at risk," which is exactly how §2 describes warning-600 ("At-risk
//     status, medium priority") — mapped to warning. archived/cancelled are
//     closed-out with no positive/negative signal — mapped to neutral, the
//     same bucket as Not Started.
//   - task priority isn't a status at all, but §2's Semantic Colors table
//     explicitly calls out "warning-600: ...medium priority" and
//     "danger-600: ...high risk" — so medium -> warning, high/urgent ->
//     danger (no 5th tier exists for urgent, so it shares danger with high
//     rather than inventing a new color).
//   - "overdue" and "on track" (project-health signals) aren't in the
//     table's status column, but §2 explicitly names both: "danger-600:
//     ...overdue" and "success-600: ...positive health signals."
const COLOR_CLASSES = {
  neutral: "bg-neutral-200 text-neutral-800",
  info: "bg-info-100 text-info-600",
  warning: "bg-warning-100 text-warning-600",
  danger: "bg-danger-100 text-danger-600",
  success: "bg-success-100 text-success-600",
  ai: "bg-ai-100 text-ai-600",
} as const;

export type BadgeColor = keyof typeof COLOR_CLASSES;

export function Badge({ children, color = "neutral" }: { children: React.ReactNode; color?: BadgeColor }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-caption font-medium uppercase tracking-wide ${COLOR_CLASSES[color]}`}
    >
      {children}
    </span>
  );
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

const PROJECT_STATUS_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  planning: "neutral",
  active: "info",
  on_hold: "warning",
  completed: "success",
  archived: "neutral",
};
const SPRINT_STATUS_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  planned: "neutral",
  active: "info",
  completed: "success",
};
const TASK_STATUS_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warning",
  done: "success",
  cancelled: "neutral",
};
const TASK_PRIORITY_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  urgent: "danger",
};
const EMPLOYMENT_STATUS_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  active: "success",
  onboarding: "info",
  on_leave: "warning",
  notice_period: "warning",
  terminated: "neutral",
};
const LEAD_STATUS_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  new: "info",
  contacted: "warning",
  qualified: "success",
  unqualified: "neutral",
  converted: "success",
  lost: "danger",
};
const ACCOUNT_TYPE_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  prospect: "neutral",
  customer: "success",
  partner: "info",
  vendor: "warning",
  other: "neutral",
};
const ACCOUNT_STATUS_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  active: "success",
  inactive: "neutral",
  churned: "danger",
};
// CRM Batch 2 — deal_stage. Early-pipeline stages read neutral/info, the
// two pre-close stages warning (getting real, still open), won success,
// lost danger — same "closer to done reads warmer" progression as
// TASK_STATUS_COLOR.
const DEAL_STAGE_COLOR: Record<string, keyof typeof COLOR_CLASSES> = {
  prospecting: "neutral",
  discovery: "info",
  proposal: "info",
  negotiation: "warning",
  contract_sent: "warning",
  won: "success",
  lost: "danger",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  return <Badge color={PROJECT_STATUS_COLOR[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
export function EmploymentStatusBadge({ status }: { status: string }) {
  return <Badge color={EMPLOYMENT_STATUS_COLOR[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
export function SprintStatusBadge({ status }: { status: string }) {
  return <Badge color={SPRINT_STATUS_COLOR[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
export function TaskStatusBadge({ status }: { status: string }) {
  return <Badge color={TASK_STATUS_COLOR[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
export function TaskPriorityBadge({ priority }: { priority: string }) {
  return <Badge color={TASK_PRIORITY_COLOR[priority] ?? "neutral"}>{humanize(priority)}</Badge>;
}
export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge color={LEAD_STATUS_COLOR[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
export function AccountTypeBadge({ type }: { type: string }) {
  return <Badge color={ACCOUNT_TYPE_COLOR[type] ?? "neutral"}>{humanize(type)}</Badge>;
}
export function AccountStatusBadge({ status }: { status: string }) {
  return <Badge color={ACCOUNT_STATUS_COLOR[status] ?? "neutral"}>{humanize(status)}</Badge>;
}
export function DealStageBadge({ stage }: { stage: string }) {
  return <Badge color={DEAL_STAGE_COLOR[stage] ?? "neutral"}>{humanize(stage)}</Badge>;
}

// Exposed so cards can accent themselves (colored left border) with the
// exact same color key their own status/priority badge already uses —
// keeps a card's border and its badge from ever disagreeing.
export function projectStatusColor(status: string) {
  return PROJECT_STATUS_COLOR[status] ?? "neutral";
}
export function sprintStatusColor(status: string) {
  return SPRINT_STATUS_COLOR[status] ?? "neutral";
}
export function taskPriorityColor(priority: string) {
  return TASK_PRIORITY_COLOR[priority] ?? "neutral";
}
export function taskStatusColor(status: string) {
  return TASK_STATUS_COLOR[status] ?? "neutral";
}

const BORDER_ACCENT_CLASSES: Record<keyof typeof COLOR_CLASSES, string> = {
  neutral: "border-l-neutral-300",
  info: "border-l-info-600",
  warning: "border-l-warning-600",
  danger: "border-l-danger-600",
  success: "border-l-success-600",
  ai: "border-l-ai-600",
};

// A 4px colored left border for card containers — same visual language as
// the locked AI-banner pattern (§5), extended to regular content cards so
// they're not flat neutral-on-neutral. `neutral` intentionally stays
// subtle (just the existing border color) rather than inventing a "no
// signal" accent color.
export function cardAccentClass(color: keyof typeof COLOR_CLASSES) {
  return `border-l-4 ${BORDER_ACCENT_CLASSES[color]}`;
}
