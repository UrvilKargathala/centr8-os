import { TaskPriorityBadge, cardAccentClass, taskPriorityColor, taskStatusColor } from "@/components/ui/Badge";
import { TASK_STATUS_PROGRESS } from "@/lib/constants";

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

const PROGRESS_BAR_CLASSES: Record<string, string> = {
  neutral: "bg-neutral-400",
  info: "bg-info-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  success: "bg-success-600",
  ai: "bg-ai-600",
};

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
  const progress = TASK_STATUS_PROGRESS[task.status as keyof typeof TASK_STATUS_PROGRESS] ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`space-y-3 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-left shadow-sm transition-shadow hover:shadow-md ${cardAccentClass(taskPriorityColor(task.priority))} ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="space-y-1">
        <p className="text-body-medium font-medium text-neutral-950">{task.title}</p>
        {task.projectName && <p className="text-small text-neutral-600">{task.projectName}</p>}
        <TaskPriorityBadge priority={task.priority} />
      </div>

      <div className="flex items-center justify-between">
        {task.assigneeId ? (
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-caption font-medium ${avatarColor(task.assigneeId)}`}
            title={task.assigneeId}
          >
            {task.assigneeId.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <span />
        )}
        {task.estimate != null && (
          <span className="rounded-sm bg-neutral-200 px-2 py-0.5 text-caption font-medium text-neutral-600">
            {task.estimate} pts
          </span>
        )}
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full ${PROGRESS_BAR_CLASSES[taskStatusColor(task.status)]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
