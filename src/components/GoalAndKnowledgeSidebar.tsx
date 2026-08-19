import React from "react";
import { BookMarked, Library, Map, Target } from "lucide-react";
import type { MocEntry, TwelveWeekGoal } from "../types/dashboard";

interface GoalAndKnowledgeSidebarProps {
  goal: TwelveWeekGoal;
  mocEntries: MocEntry[];
  coreCardCount: number;
  onOpenMoc: (mocId: string) => void;
  onOpenCoreLibrary: () => void;
}

export function GoalAndKnowledgeSidebar({
  goal,
  mocEntries,
  coreCardCount,
  onOpenMoc,
  onOpenCoreLibrary,
}: GoalAndKnowledgeSidebarProps) {
  const weekPct = Math.round((goal.currentWeek / goal.totalWeeks) * 100);

  return (
    <div className="akc-dashboard flex h-full flex-col gap-4">
      {/* --- Direction module: 12-week goal --- */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-purple-400" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">12周目标</h2>
        </div>

        <p className="mb-2 truncate text-sm text-slate-200" title={goal.title}>
          {goal.title}
        </p>

        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>第 {goal.currentWeek} / {goal.totalWeeks} 周</span>
          <span>{weekPct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-purple-500 transition-[width]"
            style={{ width: `${weekPct}%` }}
          />
        </div>

        <ul className="mt-3 space-y-2">
          {goal.objectives.map((obj) => (
            <li key={obj.id}>
              <div className="mb-0.5 flex items-center justify-between text-xs">
                <span className="truncate text-slate-300" title={obj.title}>
                  {obj.title}
                </span>
                <span className="shrink-0 text-slate-500">{obj.progressPct}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${obj.progressPct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Knowledge module: MOC + core card library --- */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Map className="h-4 w-4 text-emerald-400" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">知识索引</h2>
        </div>

        <ul className="space-y-1">
          {mocEntries.map((moc) => (
            <li key={moc.id}>
              <button
                type="button"
                onClick={() => onOpenMoc(moc.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-emerald-300"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <BookMarked className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  <span className="truncate" title={moc.title}>{moc.title}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-600">{moc.linkedCardCount}</span>
              </button>
            </li>
          ))}

          {mocEntries.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-slate-600">还没有索引卡片</li>
          )}
        </ul>

        <button
          type="button"
          onClick={onOpenCoreLibrary}
          className="mt-2 flex w-full items-center justify-between rounded-md border border-slate-800 px-2 py-1.5 text-left text-sm text-slate-300 transition-colors hover:border-emerald-600 hover:text-emerald-300"
        >
          <span className="flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            核心卡片库
          </span>
          <span className="text-xs text-slate-600">{coreCardCount}</span>
        </button>
      </section>
    </div>
  );
}
