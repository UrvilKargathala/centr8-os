"use client";

import { useState } from "react";
import { TaskCard, type Task } from "@/components/TaskCard";
import { taskStatusColor, type BadgeColor } from "@/components/ui/Badge";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";

// Soft-tint palette per status color. Header pill = -100 background + -700
// text; count circle = -600 solid + -50 text. Matches the pattern used for
// priority pills and access badges elsewhere.
const HEADER_BG: Record<BadgeColor, string> = {
  neutral: "bg-neutral-200 text-neutral-700",
  info: "bg-info-100 text-info-600",
  warning: "bg-warning-100 text-warning-600",
  danger: "bg-danger-100 text-danger-600",
  success: "bg-success-100 text-success-600",
  ai: "bg-ai-100 text-ai-600",
};
const COUNT_BG: Record<BadgeColor, string> = {
  neutral: "bg-neutral-500 text-neutral-50",
  info: "bg-info-600 text-neutral-50",
  warning: "bg-warning-600 text-neutral-50",
  danger: "bg-danger-600 text-neutral-50",
  success: "bg-success-600 text-neutral-50",
  ai: "bg-ai-600 text-neutral-50",
};

// The mock spec (Prompt 0.3) names four columns (To Do / In Progress / In
// Review / Done), but the real task_status enum has six values (backlog,
// cancelled too) — dropping backlog/cancelled tasks off the board entirely
// would make them silently disappear, so all six are shown.
export function SprintBoard({
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
  onAddTask,
}: {
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onAddTask?: (status: string) => void;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        const tone = taskStatusColor(status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setDragOverStatus(status);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/plain");
              setDragOverStatus(null);
              if (taskId) onStatusChange(taskId, status);
            }}
            className={`w-64 shrink-0 rounded-md border p-3 transition-colors ${
              dragOverStatus === status ? "border-primary-600 bg-primary-100" : "border-neutral-300 bg-neutral-100"
            }`}
          >
            <div className={`mb-3 flex items-center gap-2 rounded-full px-2 py-1.5 ${HEADER_BG[tone]}`}>
              <span
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-caption font-semibold ${COUNT_BG[tone]}`}
              >
                {columnTasks.length}
              </span>
              <h3 className="flex-1 truncate text-body-medium font-semibold">{TASK_STATUS_LABELS[status]}</h3>
              {onAddTask && canEdit && (
                <button
                  type="button"
                  onClick={() => onAddTask(status)}
                  aria-label={`Add task to ${TASK_STATUS_LABELS[status]}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-neutral-50/60"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                  onClick={() => onTaskClick(task.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
