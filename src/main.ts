import { Plugin, WorkspaceLeaf } from "obsidian";
import { DASHBOARD_VIEW_TYPE, DashboardView } from "./view/DashboardView";

export interface AkcDashboardSettings {
  /** OAuth2 access token obtained via the TickTick authorization-code flow.
   *  Populate this from a settings tab; left undefined disables TickTick sync. */
  ticktickAccessToken: string | null;
}

const DEFAULT_SETTINGS: AkcDashboardSettings = {
  ticktickAccessToken: null,
};

export default class AkcDashboardPlugin extends Plugin {
  settings: AkcDashboardSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this));

    this.addRibbonIcon("layout-dashboard", "Today's Dashboard", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-today-dashboard",
      name: "Open Today's Dashboard",
      callback: () => this.activateView(),
    });
  }

  onunload(): void {
    // Obsidian tears down registered views automatically; nothing extra to
    // release here (no timers/sockets held at the plugin level).
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;

    const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf: WorkspaceLeaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  private async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
