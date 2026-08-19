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
  peopleById,
}: {
  tasks: Task[];
  canEdit: boolean;
  onTaskClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onAddTask?: (status: string) => void;
  peopleById?: Record<string, { fullName: string }>;
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "assignee" | "priority">("none");

  // Swimlane grouping: derive lanes from the task list. "none" → one lane.
  const lanes: { key: string; label: string; tasks: Task[] }[] = (() => {
    if (groupBy === "none") return [{ key: "all", label: "All", tasks }];
    if (groupBy === "assignee") {
      const byKey = new Map<string, Task[]>();
      for (const t of tasks) {
        const k = t.assigneeId ?? "__unassigned";
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(t);
      }
      return [...byKey.entries()].map(([k, ts]) => ({
        key: k,
        label: k === "__unassigned" ? "Unassigned" : peopleById?.[k]?.fullName ?? k.slice(0, 8),
        tasks: ts,
      }));
    }
    // priority
    const order = ["urgent", "high", "medium", "low"];
    const byKey = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = t.priority ?? "medium";
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(t);
    }
    return order
      .filter((k) => byKey.has(k))
      .map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), tasks: byKey.get(k)! }));
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-caption text-neutral-600">
        <span>Group by</span>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
          className="rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1 text-caption focus:border-primary-600 focus:outline-none"
        >
          <option value="none">None</option>
          <option value="assignee">Assignee</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      {lanes.map((lane) => (
        <div key={lane.key} className="space-y-2">
          {groupBy !== "none" && (
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-1 text-caption font-semibold uppercase tracking-wide text-neutral-600">
              <span>{lane.label}</span>
              <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-caption font-medium text-neutral-700">
                {lane.tasks.length}
              </span>
            </div>
          )}
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TASK_STATUSES.map((status) => {
              const columnTasks = lane.tasks.filter((t) => t.status === status);
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
            className={`w-64 shrink-0 rounded-md p-3 transition-colors ${
              dragOverStatus === status ? "border border-primary-600 bg-primary-100" : "glass-card"
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
                  peopleById={peopleById}
                />
              ))}
            </div>
          </div>
        );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
