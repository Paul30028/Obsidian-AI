import { App, ItemView, Notice, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { TodayDashboard } from "../components/TodayDashboard";
import type { DashboardData, DashboardHandlers, QuickNote, Task } from "../types/dashboard";
import {
  loadCoreCardCount,
  loadCurrentGoal,
  loadMocEntries,
  loadObsidianTasksForToday,
  persistQuickNote,
  toggleObsidianTask,
  updateQuickNoteFrontmatter,
} from "../lib/vaultAdapter";
import { completeTask as completeTickTickTask, fetchTodayTasks } from "../lib/ticktickAdapter";
import { analyzeQuickNote, type ExistingCard } from "../lib/ollamaAdapter";
import { emptyDashboardData } from "../lib/mockData";
import type AkcDashboardPlugin from "../main";

export const DASHBOARD_VIEW_TYPE = "akc-today-dashboard";

interface InternalPluginsApi {
  getPluginById: (id: string) => { instance: { openGlobalSearch: (query: string) => void } } | null;
}

export class DashboardView extends ItemView {
  private root: Root | null = null;
  private data: DashboardData = emptyDashboardData;

  constructor(leaf: WorkspaceLeaf, private plugin: AkcDashboardPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Today's Dashboard";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    this.root = createRoot(this.contentEl);
    this.render();
    await this.refreshData();

    // Keep the task list in sync with live edits made elsewhere in the vault
    // (e.g. checking a box directly in the editor).
    this.registerEvent(this.app.vault.on("modify", () => this.refreshData()));
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  private async refreshData(): Promise<void> {
    const obsidianTasks = await loadObsidianTasksForToday(this.app);

    let ticktickTasks: Task[] = [];
    const accessToken = this.plugin.settings.ticktickAccessToken;
    if (accessToken) {
      try {
        ticktickTasks = await fetchTodayTasks(accessToken);
      } catch (err) {
        console.error("[AKC Dashboard] TickTick fetch failed", err);
      }
    }

    this.data = {
      tasks: [...obsidianTasks, ...ticktickTasks],
      quickNotes: this.data.quickNotes, // quick notes are session-local until persisted
      skillCommands: this.data.skillCommands.length ? this.data.skillCommands : emptyDashboardData.skillCommands,
      goal: loadCurrentGoal(this.app),
      mocEntries: loadMocEntries(this.app),
      coreCardCount: loadCoreCardCount(this.app),
    };

    this.render();
  }

  private render(): void {
    this.root?.render(
      <React.StrictMode>
        <TodayDashboard data={this.data} handlers={this.buildHandlers()} />
      </React.StrictMode>
    );
  }

  private buildHandlers(): DashboardHandlers {
    return {
      onToggleTask: async (taskId) => {
        const task = this.data.tasks.find((t) => t.id === taskId);
        if (!task) throw new Error(`Unknown task ${taskId}`);

        if (task.source === "obsidian") {
          await toggleObsidianTask(this.app, task);
        } else {
          const accessToken = this.plugin.settings.ticktickAccessToken;
          if (!accessToken) throw new Error("未连接滴答清单账号");
          await completeTickTickTask(accessToken, task);
        }
      },

      onCaptureQuickNote: async (content): Promise<QuickNote> => {
        const createdAt = new Date().toISOString();
        const filePath = await persistQuickNote(this.app, {
          content,
          createdAt,
          cardType: null,
          tags: [],
        });

        // AI enrichment runs after the file already exists on disk, so a
        // failed/offline LLM never loses the captured thought.
        const existingCards: ExistingCard[] = []; // TODO: load from a persisted embedding index
        try {
          const analysis = await analyzeQuickNote(content, existingCards);
          await updateQuickNoteFrontmatter(this.app, filePath, {
            cardType: analysis.cardType,
            tags: analysis.tags,
          });
          return {
            id: filePath,
            content,
            createdAt,
            status: "tagged",
            cardType: analysis.cardType,
            tags: analysis.tags,
            suggestedLinks: analysis.suggestedLinks,
            filePath,
          };
        } catch (err) {
          console.error("[AKC Dashboard] Local LLM analysis failed", err);
          return {
            id: filePath,
            content,
            createdAt,
            status: "error",
            cardType: null,
            tags: [],
            suggestedLinks: [],
            filePath,
          };
        }
      },

      onRunSkillCommand: async (commandId) => {
        switch (commandId) {
          case "sync-ticktick":
            await this.refreshData();
            return "已同步";
          case "weekly-report":
            // Hook point: generate + open a weekly report note here, e.g.
            // await generateWeeklyReport(this.app, this.data);
            new Notice("周报生成功能待接入");
            return "已生成草稿";
          case "ai-review":
            new Notice("AI 复盘功能待接入");
            return "复盘完成";
          default:
            return "已执行";
        }
      },

      onOpenMoc: (mocId) => {
        const leaf = this.app.workspace.getLeaf("tab");
        const file = this.app.vault.getAbstractFileByPath(mocId);
        if (file) leaf.openFile(file as never);
      },

      onOpenCoreLibrary: () => {
        // Hook point: `internalPlugins` is undocumented but stable in
        // practice — used here to open Obsidian's built-in global search
        // scoped to `cardType: core` instead of a single file.
        const globalSearch = (this.app as App & { internalPlugins: InternalPluginsApi }).internalPlugins.getPluginById(
          "global-search"
        );
        globalSearch?.instance.openGlobalSearch('["cardType": core]');
      },
    };
  }
}
