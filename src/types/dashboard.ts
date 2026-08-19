/**
 * Core data model for Today's Dashboard (AKC: Action / Knowledge / Direction).
 *
 * These types are intentionally storage-agnostic: nothing here imports the
 * `obsidian` package. The mapping to real persistence (vault markdown files,
 * YAML frontmatter, the TickTick REST API, a local Ollama server) lives in
 * `src/lib/*Adapter.ts`. Components only ever see this shape.
 */

// ---------------------------------------------------------------------------
// Action layer
// ---------------------------------------------------------------------------

/** Where a task's data actually lives. Determines which adapter owns writes. */
export type TaskSource = "obsidian" | "ticktick";

export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  source: TaskSource;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null; // ISO 8601 date, e.g. "2026-08-19"
  project: string | null;

  /**
   * Obsidian-sourced tasks: identifies exactly which `- [ ]` line to flip.
   * Hook point: see `src/lib/vaultAdapter.ts#toggleObsidianTask`, which uses
   * `filePath` + `lineNumber` to patch the line via `Vault.process()`
   * instead of rewriting the whole file (avoids clobbering concurrent edits).
   */
  filePath?: string;
  lineNumber?: number;

  /**
   * TickTick-sourced tasks: the remote task id, required to PATCH
   * `/open/v1/project/{projectId}/task/{taskId}` on toggle.
   * Hook point: `src/lib/ticktickAdapter.ts#completeTask`.
   */
  ticktickId?: string;
  ticktickProjectId?: string;

  /**
   * Set the moment a task flips to completed=true. This is what the
   * end-of-day AI review reads: `tasks.filter(t => t.completedAt &&
   * isToday(t.completedAt))` becomes the "what did I actually do today"
   * context fed to the recap prompt.
   */
  completedAt: string | null; // ISO 8601 datetime
}

// ---------------------------------------------------------------------------
// Knowledge layer (Zettelkasten / card-box note-taking)
// ---------------------------------------------------------------------------

/**
 * - moc   -> "Map of Content" / index card: a hub note that links out to a
 *            cluster of related atomic notes.
 * - reading -> literature notes: source-bound (a book/article/video), not
 *            yet distilled into the writer's own words.
 * - core  -> permanent/evergreen notes: one atomic idea, written in your own
 *            words, is the durable unit the MOCs point to.
 */
export type CardType = "moc" | "reading" | "core";

export type QuickNoteStatus =
  | "draft" // just typed, not yet sent to the LLM
  | "processing" // sent to the local LLM, awaiting tags/links
  | "tagged" // LLM finished, ready for user confirmation
  | "error"; // LLM call failed; content is still saved, just unlabeled

/** A single Flomo-style captured thought before/after AI enrichment. */
export interface QuickNote {
  id: string;
  content: string;
  createdAt: string; // ISO 8601 datetime
  status: QuickNoteStatus;

  /** Null until the user accepts an AI suggestion or sets it manually. */
  cardType: CardType | null;

  tags: string[];

  /**
   * AI-suggested related core/reading cards, ranked by similarity.
   * Populated by `src/lib/ollamaAdapter.ts#analyzeQuickNote`. The card
   * component renders these as "possibly related" chips the user can
   * accept (which writes a `[[wikilink]]`) or dismiss.
   */
  suggestedLinks: SuggestedLink[];

  /** Populated once `vaultAdapter.persistQuickNote` writes the vault file. */
  filePath?: string;
}

export interface SuggestedLink {
  noteId: string;
  noteTitle: string;
  filePath: string;
  similarity: number; // 0..1, cosine similarity from the local embedding model
}

/** A Map-of-Content entry surfaced in the sidebar's Knowledge module. */
export interface MocEntry {
  id: string;
  title: string;
  filePath: string;
  linkedCardCount: number;
}

// ---------------------------------------------------------------------------
// Direction layer (12-week year)
// ---------------------------------------------------------------------------

export interface WeeklyObjective {
  id: string;
  title: string;
  /** 0..100. Derived from linked task completion, or set manually. */
  progressPct: number;
}

export interface TwelveWeekGoal {
  id: string;
  /** The quarterly vision statement this 12-week cycle decomposes. */
  title: string;
  cycleStartDate: string; // ISO 8601 date
  currentWeek: number; // 1..totalWeeks
  totalWeeks: number; // canonically 12
  objectives: WeeklyObjective[];
}

// ---------------------------------------------------------------------------
// Skill launcher (Terminal-style command bar)
// ---------------------------------------------------------------------------

export type SkillCommandCategory = "report" | "sync" | "ai" | "review";

/**
 * Name of a lucide-react icon component (e.g. "FileText", "RefreshCw").
 * Kept as a string (not a component reference) so SkillCommand stays a
 * plain, serializable data object — the actual component is resolved via
 * `src/components/icons.ts#iconRegistry` at render time.
 */
export type IconName = string;

export interface SkillCommand {
  id: string;
  /** Display label, e.g. "生成周报". */
  label: string;
  description: string;
  /** Terminal-style invocation text, e.g. "/weekly-report". */
  command: string;
  category: SkillCommandCategory;
  icon: IconName;
  isRunning: boolean;
  lastRunAt: string | null; // ISO 8601 datetime
  lastRunResult?: string; // short status message shown after completion
}

// ---------------------------------------------------------------------------
// Aggregate dashboard state
// ---------------------------------------------------------------------------

export interface DashboardData {
  tasks: Task[];
  quickNotes: QuickNote[];
  skillCommands: SkillCommand[];
  goal: TwelveWeekGoal;
  mocEntries: MocEntry[];
  coreCardCount: number;
}

// ---------------------------------------------------------------------------
// Host <-> component contract
// ---------------------------------------------------------------------------

/**
 * Everything the Obsidian host (DashboardView.tsx / main.ts) injects into
 * <TodayDashboard/>. Every handler is fire-and-forget from the component's
 * perspective — the component applies an optimistic UI update immediately,
 * then calls the handler; if the handler's promise rejects, the component
 * rolls the optimistic change back.
 */
export interface DashboardHandlers {
  onToggleTask: (taskId: string) => Promise<void>;
  onCaptureQuickNote: (content: string) => Promise<QuickNote>;
  onRunSkillCommand: (commandId: string) => Promise<string>; // resolves with a result message
  onOpenMoc: (mocId: string) => void;
  onOpenCoreLibrary: () => void;
}
