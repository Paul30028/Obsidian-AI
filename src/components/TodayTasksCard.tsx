import React, { useMemo } from "react";
import { Check, CloudCog, FileEdit, Flag } from "lucide-react";
import type { Task, TaskPriority } from "../types/dashboard";

interface TodayTasksCardProps {
  tasks: Task[];
  /** Parent applies the optimistic flip and calls DashboardHandlers.onToggleTask. */
  onToggle: (taskId: string) => void;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  none: "text-slate-600",
  low: "text-slate-400",
  medium: "text-purple-400",
  high: "text-rose-400",
};

export function TodayTasksCard({ tasks, onToggle }: TodayTasksCardProps) {
  // Incomplete tasks first (highest priority first), completed tasks sink to
  // the bottom — this is what makes "already handled" visually recede while
  // still staying visible enough to build the review queue from.
  const sorted = useMemo(() => {
    const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2, none: 3 };
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return priorityRank[a.priority] - priorityRank[b.priority];
    });
  }, [tasks]);

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="akc-dashboard flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">今日行动</h2>
        <span className="text-xs text-slate-500">
          {completedCount}/{tasks.length} 已完成
        </span>
      </div>

      <ul className="flex-1 space-y-1.5 overflow-y-auto">
        {sorted.map((task) => (
          <li
            key={task.id}
            className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
              task.completed
                ? "border-transparent bg-slate-900/40 opacity-60"
                : "border-slate-800 bg-slate-950 hover:border-slate-700"
            }`}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={task.completed}
              onClick={() => onToggle(task.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                task.completed
                  ? "border-emerald-500 bg-emerald-500 text-slate-950"
                  : "border-slate-600 text-transparent hover:border-emerald-400"
              }`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </button>

            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                task.completed ? "text-slate-500 line-through" : "text-slate-200"
              }`}
              title={task.title}
            >
              {task.title}
            </span>

            {task.priority !== "none" && !task.completed && (
              <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_STYLES[task.priority]}`} aria-hidden />
            )}

            {/* Data-source badge: distinguishes a local vault checkbox from a
                task that only exists via the TickTick sync adapter. */}
            {task.source === "ticktick" ? (
              <CloudCog className="h-3.5 w-3.5 shrink-0 text-purple-400" aria-label="来自滴答清单" />
            ) : (
              <FileEdit className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-label="来自本地 Markdown" />
            )}
          </li>
        ))}

        {tasks.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-sm text-slate-600">
            今天还没有任务，去 Direction 面板拆解一个吧。
          </li>
        )}
      </ul>
    </div>
  );
}
