import type { DashboardData } from "../types/dashboard";

/**
 * Seed data used two places:
 *  1. `DashboardView.tsx` renders this immediately on mount (so the panel
 *     isn't blank) while the real vault/TickTick scan resolves.
 *  2. Any standalone preview of `<TodayDashboard/>` outside Obsidian.
 */
export const defaultSkillCommands: DashboardData["skillCommands"] = [
  {
    id: "weekly-report",
    label: "生成周报",
    description: "汇总本周已完成任务与核心卡片，生成周报草稿。",
    command: "/weekly-report",
    category: "report",
    icon: "FileText",
    isRunning: false,
    lastRunAt: null,
  },
  {
    id: "sync-ticktick",
    label: "同步滴答清单",
    description: "拉取滴答清单今日任务，双向同步完成状态。",
    command: "/sync-ticktick",
    category: "sync",
    icon: "RefreshCw",
    isRunning: false,
    lastRunAt: null,
  },
  {
    id: "ai-review",
    label: "AI 复盘",
    description: "基于今日已完成任务生成复盘摘要。",
    command: "/ai-review",
    category: "review",
    icon: "Sparkles",
    isRunning: false,
    lastRunAt: null,
  },
  {
    id: "list-inbox",
    label: "整理收件箱",
    description: "列出所有未分类的闪念速记。",
    command: "/list-inbox",
    category: "ai",
    icon: "ListChecks",
    isRunning: false,
    lastRunAt: null,
  },
];

export const emptyDashboardData: DashboardData = {
  tasks: [],
  quickNotes: [],
  skillCommands: defaultSkillCommands,
  goal: {
    id: "goal-current",
    title: "尚未设定本周期目标",
    cycleStartDate: new Date().toISOString().slice(0, 10),
    currentWeek: 1,
    totalWeeks: 12,
    objectives: [],
  },
  mocEntries: [],
  coreCardCount: 0,
};
