import { TaskPriorityBadge, cardAccentClass, taskPriorityColor } from "@/components/ui/Badge";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimate: number | null;
  assigneeId: string | null;
  sprintId: string | null;
  dueDate?: string | null;
  attachmentCount?: number;
  // Set only by views that already resolve it (e.g. the org-wide Sprints/
  // Tasks pages) — project-scoped views show the project name once at the
  // page level instead of repeating it on every card.
  projectName?: string;
};

// No user directory/avatar endpoint exists — assigneeId is a raw id with no
// photo behind it. Rather than a flat "always primary" circle, the color is
// derived deterministically from the id so each assignee reads as a
// distinct person at a glance, same idea as a generated avatar.
const AVATAR_COLORS = [
  "bg-primary-100 text-primary-700",
  "bg-info-100 text-info-600",
  "bg-success-100 text-success-600",
  "bg-warning-100 text-warning-600",
  "bg-danger-100 text-danger-600",
  "bg-ai-100 text-ai-600",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function daysUntil(iso: string) {
  const t = new Date(iso + "T00:00:00").getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t - now.getTime()) / 86400000);
}
// Compact due-date label: "Today", "Tomorrow", "3 days", or a short date.
function dueDateLabel(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d > 0 && d <= 7) return `${d} days`;
  if (d < 0 && d >= -7) return `${-d} d overdue`;
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function dueDateTone(iso: string): "danger" | "warning" | "neutral" {
  const d = daysUntil(iso);
  if (d < 0) return "danger";
  if (d <= 2) return "danger";
  if (d <= 7) return "warning";
  return "neutral";
}

export function TaskCard({
  task,
  draggable,
  onDragStart,
  onClick,
}: {
  task: Task;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const dueTone = task.dueDate ? dueDateTone(task.dueDate) : "neutral";
  const dueClass =
    dueTone === "danger" ? "text-danger-600" : dueTone === "warning" ? "text-warning-600" : "text-neutral-600";
  const attachments = task.attachmentCount ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`flex flex-col gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-left shadow-sm transition-shadow hover:shadow-md ${cardAccentClass(taskPriorityColor(task.priority))} ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      {/* Priority pill top-left (matches the reference "High" pill placement) */}
      <div className="flex items-start justify-between gap-2">
        <TaskPriorityBadge priority={task.priority} />
      </div>

      <div className="space-y-1">
        <h4 className="font-heading text-body-medium font-semibold leading-tight text-neutral-950">{task.title}</h4>
        {task.description && <p className="line-clamp-2 text-small text-neutral-600">{task.description}</p>}
        {task.projectName && <p className="text-caption text-neutral-500">{task.projectName}</p>}
      </div>

      {task.dueDate && (
        <div className={`flex items-center gap-1.5 text-small ${dueClass}`}>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3M16 7V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{dueDateLabel(task.dueDate)}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {task.assigneeId ? (
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold ${avatarColor(task.assigneeId)}`}
            title={`Assignee ${task.assigneeId.slice(0, 8)}`}
          >
            {task.assigneeId.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <span className="text-caption text-neutral-400">Unassigned</span>
        )}
        <div className="flex items-center gap-3 text-caption text-neutral-500">
          {task.estimate != null && (
            <span className="rounded-sm bg-neutral-200 px-1.5 py-0.5 font-medium text-neutral-700">{task.estimate} pts</span>
          )}
          {attachments > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              {attachments}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
