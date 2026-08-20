import { Plugin, WorkspaceLeaf } from "obsidian";
import { DASHBOARD_VIEW_TYPE, DashboardView } from "./view/DashboardView";

export interface AkcDashboardSettings {
  /** OAuth2 access token obtained via the TickTick authorization-code flow.
   *  Populate this from a settings tab; left undefined disables TickTick sync. */
  ticktickAccessToken: string | null;

  /**
   * Base URL of a locally running batch-distillation tool (e.g. FaithDistill,
   * a Streamlit app that explodes a whole PDF/article into many atomic notes
   * in one pass — a different job than this plugin's one-thought-at-a-time
   * QuickCapture). This plugin does not launch or manage that process; the
   * user starts it themselves (e.g. `streamlit run app.py`), and the
   * "打开批量蒸馏工具" skill command just opens this URL. Left as the
   * Streamlit default so it works with zero configuration for that pairing.
   */
  distillToolUrl: string;
}

const DEFAULT_SETTINGS: AkcDashboardSettings = {
  ticktickAccessToken: null,
  distillToolUrl: "http://localhost:8501",
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
