import React, { useCallback, useState } from "react";
import { SkillLauncherBar } from "./SkillLauncherBar";
import { TodayTasksCard } from "./TodayTasksCard";
import { QuickCaptureCard } from "./QuickCaptureCard";
import { GoalAndKnowledgeSidebar } from "./GoalAndKnowledgeSidebar";
import type { DashboardData, DashboardHandlers, QuickNote, Task } from "../types/dashboard";

interface TodayDashboardProps {
  data: DashboardData;
  /**
   * Injected by DashboardView.tsx (the Obsidian ItemView host). Each handler
   * talks to a real adapter (vaultAdapter / ticktickAdapter / ollamaAdapter).
   * Optional so this component also renders standalone (Storybook, a plain
   * web preview) against the built-in no-op mocks below.
   */
  handlers?: Partial<DashboardHandlers>;
}

const noopHandlers: DashboardHandlers = {
  onToggleTask: async () => {},
  onCaptureQuickNote: async (content) => ({
    id: `local-${Date.now()}`,
    content,
    createdAt: new Date().toISOString(),
    status: "tagged",
    cardType: null,
    tags: [],
    suggestedLinks: [],
  }),
  onRunSkillCommand: async () => "完成",
  onOpenMoc: () => {},
  onOpenCoreLibrary: () => {},
};

/**
 * Today's Dashboard — the AKC (Action / Knowledge / Direction) command
 * center. This component owns UI state and applies every mutation
 * optimistically (state updates immediately; the host-provided handler
 * persists it). If a handler's promise rejects, the optimistic change is
 * rolled back and surfaced via a transient error banner.
 *
 * Local-first contract: `data` is the last-known-good snapshot the host
 * loaded from the vault (+ TickTick + settings) at mount time. This
 * component never re-fetches on its own — the host pushes fresh `data` down
 * via props (e.g. after a vault file-change event) and React reconciles it.
 */
export function TodayDashboard({ data, handlers }: TodayDashboardProps) {
  const h: DashboardHandlers = { ...noopHandlers, ...handlers };

  const [tasks, setTasks] = useState<Task[]>(data.tasks);
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>(data.quickNotes);
  const [skillCommands, setSkillCommands] = useState(data.skillCommands);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const flashError = useCallback((message: string) => {
    setErrorMessage(message);
    window.setTimeout(() => setErrorMessage(null), 4000);
  }, []);

  // --- Action layer: task toggle -------------------------------------------
  const handleToggleTask = useCallback(
    (taskId: string) => {
      const previous = tasks;
      const now = new Date().toISOString();

      setTasks((current) =>
        current.map((t) =>
          t.id === taskId
            ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : null }
            : t
        )
      );

      h.onToggleTask(taskId).catch((err) => {
        setTasks(previous); // roll back the optimistic flip
        flashError(`任务同步失败，已回滚：${(err as Error).message}`);
      });
    },
    [tasks, h, flashError]
  );

  // --- Knowledge layer: quick capture --------------------------------------
  const handleCaptureQuickNote = useCallback(
    (content: string) => {
      const draftId = `draft-${Date.now()}`;
      const draft: QuickNote = {
        id: draftId,
        content,
        createdAt: new Date().toISOString(),
        status: "processing",
        cardType: null,
        tags: [],
        suggestedLinks: [],
      };

      // Optimistically show the note immediately with a "processing" badge
      // while the local LLM call (see ollamaAdapter.ts) runs in the background.
      setQuickNotes((current) => [draft, ...current]);

      h.onCaptureQuickNote(content)
        .then((enriched) => {
          setQuickNotes((current) =>
            current.map((n) => (n.id === draftId ? { ...enriched, id: enriched.id || draftId } : n))
          );
        })
        .catch((err) => {
          setQuickNotes((current) =>
            current.map((n) => (n.id === draftId ? { ...n, status: "error" as const } : n))
          );
          flashError(`闪念保存失败：${(err as Error).message}`);
        });
    },
    [h, flashError]
  );

  // --- Skill launcher --------------------------------------------------------
  const handleRunSkillCommand = useCallback(
    (commandId: string) => {
      setSkillCommands((current) =>
        current.map((c) => (c.id === commandId ? { ...c, isRunning: true } : c))
      );

      h.onRunSkillCommand(commandId)
        .then((resultMessage) => {
          setSkillCommands((current) =>
            current.map((c) =>
              c.id === commandId
                ? {
                    ...c,
                    isRunning: false,
                    lastRunAt: new Date().toISOString(),
                    lastRunResult: resultMessage,
                  }
                : c
            )
          );
        })
        .catch((err) => {
          setSkillCommands((current) =>
            current.map((c) => (c.id === commandId ? { ...c, isRunning: false } : c))
          );
          flashError(`指令执行失败：${(err as Error).message}`);
        });
    },
    [h, flashError]
  );

  return (
    <div className="akc-dashboard flex h-full flex-col gap-4 bg-slate-950 p-4 text-slate-100">
      <SkillLauncherBar commands={skillCommands} onRun={handleRunSkillCommand} />

      {errorMessage && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[2fr_2fr_1.2fr]">
        <TodayTasksCard tasks={tasks} onToggle={handleToggleTask} />
        <QuickCaptureCard notes={quickNotes} onCapture={handleCaptureQuickNote} />
        <GoalAndKnowledgeSidebar
          goal={data.goal}
          mocEntries={data.mocEntries}
          coreCardCount={data.coreCardCount}
          onOpenMoc={h.onOpenMoc}
          onOpenCoreLibrary={h.onOpenCoreLibrary}
        />
      </div>
    </div>
  );
}
