"use client";

import { useState } from "react";
import { TaskPriorityBadge, taskStatusColor } from "@/components/ui/Badge";
import type { Task } from "@/components/TaskCard";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";

const DOT_CLASSES: Record<string, string> = {
  neutral: "bg-neutral-400",
  info: "bg-info-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  success: "bg-success-600",
  ai: "bg-ai-600",
};

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const COLORS = ["bg-primary-100 text-primary-700", "bg-info-100 text-info-600", "bg-success-100 text-success-600", "bg-warning-100 text-warning-600", "bg-danger-100 text-danger-600"];
  return COLORS[hash % COLORS.length];
}

// Grouped-by-status list view, collapsible sections — an alternative to
// the flat filterable table TasksTab already had, styled after a
// Backlog/To Do/On Progress kanban-adjacent list reference the user
// shared. Reuses the same Task type/data TasksTab already fetches; no new
// API calls.
export function TaskListView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (taskId: string) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {TASK_STATUSES.map((status) => {
        const rows = tasks.filter((t) => t.status === status);
        if (rows.length === 0) return null;
        const isCollapsed = collapsed[status];

        return (
          <div key={status} className="overflow-hidden rounded-md border border-neutral-300">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
              className="flex w-full items-center gap-2 bg-neutral-100 px-4 py-2.5 text-left"
            >
              <svg
                className={`h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[taskStatusColor(status)]}`} />
              <span className="text-body-medium font-medium text-neutral-950">{TASK_STATUS_LABELS[status]}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-200 px-1.5 text-caption text-neutral-600">
                {rows.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-body">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium">Due date</th>
                      <th className="px-4 py-2 font-medium">Priority</th>
                      <th className="px-4 py-2 font-medium">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-neutral-50">
                    {rows.map((t) => (
                      <tr key={t.id} onClick={() => onTaskClick(t.id)} className="cursor-pointer hover:bg-neutral-100">
                        <td className="px-4 py-3 font-medium text-neutral-950">{t.title}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-neutral-600">{t.description ?? "—"}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          {t.dueDate
                            ? new Date(t.dueDate + "T00:00:00").toLocaleDateString(undefined, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <TaskPriorityBadge priority={t.priority} />
                        </td>
                        <td className="px-4 py-3">
                          {t.assigneeId ? (
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-caption font-medium ${avatarColor(t.assigneeId)}`}
                              title={t.assigneeId}
                            >
                              {t.assigneeId.slice(0, 1).toUpperCase()}
                            </div>
                          ) : (
                            <span className="text-neutral-400">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
