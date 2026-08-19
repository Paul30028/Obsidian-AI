import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { CardType, MocEntry, QuickNote, Task, TwelveWeekGoal } from "../types/dashboard";

/**
 * Bridges the dashboard's plain data model to the real Obsidian vault:
 * reading task checkboxes + frontmatter, flipping a checkbox in place, and
 * writing new Quick Capture notes as real markdown files with frontmatter.
 *
 * This is the ONLY file that should import from "obsidian" for the Action
 * (local half) and Knowledge layers — keeping the coupling to the host API
 * in one place is what lets `TodayDashboard.tsx` render standalone in a
 * plain web preview.
 */

const QUICK_NOTE_FOLDER = "10-Fleeting/QuickCapture";
const TASK_CHECKBOX_RE = /^(\s*[-*] )\[( |x|X)\]\s?(.*)$/;

/**
 * Scans every markdown file for `#today` tagged, unchecked-or-checked
 * checkbox lines. In a production build, prefer swapping this for the
 * Tasks plugin's or Dataview's index instead of a raw full-vault scan — this
 * naive version is here so the adapter has zero plugin-to-plugin dependency.
 */
export async function loadObsidianTasksForToday(app: App): Promise<Task[]> {
  const tasks: Task[] = [];
  const files = app.vault.getMarkdownFiles();

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    const fileHasTodayTag = cache?.tags?.some((t) => t.tag === "#today") ?? false;

    const content = await app.vault.cachedRead(file);
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const match = line.match(TASK_CHECKBOX_RE);
      if (!match) return;

      const lineHasTodayTag = /#today\b/.test(line);
      if (!fileHasTodayTag && !lineHasTodayTag) return;

      const [, , checkMark, rawTitle] = match;
      const title = rawTitle.replace(/#today\b/g, "").trim();
      const dueMatch = rawTitle.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      const priority = rawTitle.includes("🔺")
        ? "high"
        : rawTitle.includes("🔼")
        ? "medium"
        : rawTitle.includes("🔽")
        ? "low"
        : "none";

      tasks.push({
        id: `obs:${file.path}:${index}`,
        title,
        completed: checkMark.toLowerCase() === "x",
        source: "obsidian",
        priority,
        tags: (title.match(/#[\w-]+/g) ?? []).map((t) => t.slice(1)),
        dueDate: dueMatch?.[1] ?? null,
        project: file.parent?.name ?? null,
        filePath: file.path,
        lineNumber: index,
        completedAt: checkMark.toLowerCase() === "x" ? new Date(file.stat.mtime).toISOString() : null,
      });
    });
  }

  return tasks;
}

/**
 * Flips exactly one checkbox line in place using `Vault.process`, which
 * hands us the *current* file content and applies the returned string
 * atomically — safer than cachedRead + vault.modify, which can race another
 * writer (e.g. Obsidian Sync, or the user typing) between read and write.
 */
export async function toggleObsidianTask(app: App, task: Task): Promise<void> {
  if (task.source !== "obsidian" || !task.filePath || task.lineNumber === undefined) {
    throw new Error("toggleObsidianTask called with a non-Obsidian task");
  }

  const file = app.vault.getAbstractFileByPath(task.filePath);
  if (!(file instanceof TFile)) {
    throw new Error(`File not found: ${task.filePath}`);
  }

  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const line = lines[task.lineNumber!];
    if (line === undefined) return content;

    const match = line.match(TASK_CHECKBOX_RE);
    if (!match) return content;

    const nextMark = task.completed ? " " : "x"; // task.completed is the *pre-toggle* state
    lines[task.lineNumber!] = line.replace(/\[( |x|X)\]/, `[${nextMark}]`);
    return lines.join("\n");
  });
}

/**
 * Persists a Quick Capture note as its own markdown file with YAML
 * frontmatter carrying the AI-assigned metadata. Frontmatter (not inline
 * tags alone) is what lets Dataview / the sidebar's MOC index query cards
 * by `cardType` reliably.
 */
export async function persistQuickNote(
  app: App,
  note: Pick<QuickNote, "content" | "createdAt" | "cardType" | "tags">
): Promise<string> {
  await ensureFolder(app, QUICK_NOTE_FOLDER);

  const slug = note.content
    .slice(0, 40)
    .replace(/[\\/:*?"<>|#\[\]]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const timestamp = note.createdAt.replace(/[:.]/g, "-");
  const path = normalizePath(`${QUICK_NOTE_FOLDER}/${timestamp}-${slug || "note"}.md`);

  const frontmatter = [
    "---",
    `created: ${note.createdAt}`,
    `cardType: ${note.cardType ?? "unclassified"}`,
    `tags: [${note.tags.join(", ")}]`,
    "---",
    "",
    note.content,
    "",
  ].join("\n");

  await app.vault.create(path, frontmatter);
  return path;
}

/** Updates an existing quick-note file's frontmatter once the LLM finishes
 *  classifying it (called after the note was already created as "draft"). */
export async function updateQuickNoteFrontmatter(
  app: App,
  filePath: string,
  patch: { cardType: CardType | null; tags: string[] }
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) throw new Error(`File not found: ${filePath}`);

  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.cardType = patch.cardType ?? "unclassified";
    fm.tags = patch.tags;
  });
}

/**
 * Every file whose frontmatter has `cardType: moc` becomes a sidebar entry.
 * `linkedCardCount` counts outgoing `[[wikilinks]]` resolved via the
 * metadata cache, which is how a MOC's "how many cards does this index"
 * count stays accurate without re-parsing markdown by hand.
 */
export function loadMocEntries(app: App): MocEntry[] {
  const entries: MocEntry[] = [];

  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.cardType !== "moc") continue;

    const linkedCardCount = (cache.links ?? []).filter((link) => {
      const target = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      return target !== null;
    }).length;

    entries.push({
      id: file.path,
      title: cache.frontmatter?.title ?? file.basename,
      filePath: file.path,
      linkedCardCount,
    });
  }

  return entries;
}

/** Counts files whose frontmatter marks them as a permanent/"core" card. */
export function loadCoreCardCount(app: App): number {
  return app.vault
    .getMarkdownFiles()
    .filter((file) => app.metadataCache.getFileCache(file)?.frontmatter?.cardType === "core").length;
}

const GOAL_FILE_PATH = "30-Direction/CurrentGoal.md";

/**
 * Reads the active 12-week goal from a single canonical frontmatter file,
 * e.g.:
 *   ---
 *   title: 打磨 AKC 仪表盘并稳定日常复盘习惯
 *   cycleStartDate: 2026-06-08
 *   totalWeeks: 12
 *   objectives:
 *     - title: 完成 Dashboard 前端组件
 *       progressPct: 60
 *   ---
 * Falls back to a sensible empty goal (week 1 of 12, no objectives) if the
 * file doesn't exist yet, so a fresh vault never crashes the dashboard.
 */
export function loadCurrentGoal(app: App): TwelveWeekGoal {
  const file = app.vault.getAbstractFileByPath(GOAL_FILE_PATH);
  const fallback: TwelveWeekGoal = {
    id: "goal-current",
    title: "尚未设定本周期目标",
    cycleStartDate: new Date().toISOString().slice(0, 10),
    currentWeek: 1,
    totalWeeks: 12,
    objectives: [],
  };

  if (!(file instanceof TFile)) return fallback;

  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!fm) return fallback;

  const cycleStartDate: string = fm.cycleStartDate ?? fallback.cycleStartDate;
  const totalWeeks: number = fm.totalWeeks ?? 12;
  const elapsedWeeks =
    Math.floor((Date.now() - new Date(cycleStartDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  return {
    id: file.path,
    title: fm.title ?? fallback.title,
    cycleStartDate,
    currentWeek: Math.min(Math.max(elapsedWeeks, 1), totalWeeks),
    totalWeeks,
    objectives: (fm.objectives ?? []).map((o: { title: string; progressPct: number }, i: number) => ({
      id: `${file.path}#${i}`,
      title: o.title,
      progressPct: o.progressPct,
    })),
  };
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFolder) return;
  await app.vault.createFolder(path).catch(() => {
    // Folder already exists (race with another call) — safe to ignore.
  });
}
