# Obsidian-AI — Today's Dashboard

An Obsidian plugin implementing a **Dashboard-First** workspace built around
the **AKC model**:

- **Action** — today's tasks (local Markdown checkboxes + TickTick sync),
  completed items feed an end-of-day AI review queue.
- **Knowledge** — Zettelkasten-style card capture (index/MOC, reading, core
  cards) with local-LLM auto-tagging and related-card suggestions.
- **Direction** — a 12-week goal cycle, decomposed into weekly objectives,
  tracked alongside the daily view instead of buried in a separate file.

## 快速开始（一键安装）

前提：装好 [Node.js](https://nodejs.org)，有一个已存在的 Obsidian vault
文件夹。（要用批量蒸馏功能的话再装 [Python 3](https://python.org)、
[Ollama](https://ollama.com)——没装也不影响插件本身能用。）

**macOS / Linux / Git Bash：**
```bash
git clone https://github.com/Paul30028/Obsidian-AI.git
cd Obsidian-AI
./scripts/install.sh /path/to/your/Obsidian/Vault
```

**Windows（原生 PowerShell，不是 Git Bash）：**
```powershell
git clone https://github.com/Paul30028/Obsidian-AI.git
cd Obsidian-AI
.\scripts\install.ps1 "D:\path\to\your\Obsidian\Vault"
```
如果报错说脚本被禁止运行（"running scripts is disabled"），改用：
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 "D:\path\to\vault"
```

跑完之后，打开 Obsidian → 设置 → Community plugins → 启用
"Today's Dashboard (AKC)" 就能用了。详细步骤、逐项验证方式见脚本跑完后打
印的提示，或本文件后面的「Development」「Pairing with a batch-ingestion
tool」两节。批量蒸馏工具的启动脚本对应是 `scripts/start-distill.sh`
（macOS/Linux）或 `scripts\start-distill.ps1`（Windows）。

## Project layout

```
src/
  types/dashboard.ts        Storage-agnostic data model (Task, QuickNote, SkillCommand, ...)
  components/
    TodayDashboard.tsx       Top-level container: state + optimistic updates
    SkillLauncherBar.tsx     Terminal-style quick-command bar
    TodayTasksCard.tsx       Mixed local/TickTick task list
    QuickCaptureCard.tsx     Flomo-style capture + AI tagging status
    GoalAndKnowledgeSidebar.tsx  12-week goal + MOC/core-card index
  lib/
    vaultAdapter.ts           Reads/writes the Obsidian vault (tasks, frontmatter, MOC index, goal file)
    ticktickAdapter.ts        TickTick Open API client (OAuth2 access token required)
    ollamaAdapter.ts          Local LLM hook (classification + embeddings) via a local Ollama server
    mockData.ts               Seed/fallback data
  view/DashboardView.tsx      Obsidian ItemView hosting the React tree
  main.ts                     Plugin entry point (ribbon icon, command, settings)
```

## Development

```bash
npm install
npm run css        # compile Tailwind -> styles.css (once)
npm run dev         # esbuild watch -> main.js
```

Symlink (or copy) the repo into a test vault's `.obsidian/plugins/obsidian-ai-dashboard/`
folder, then enable it from Obsidian's Community Plugins settings.

## Hooking up real data sources

- **Vault / Frontmatter**: see `src/lib/vaultAdapter.ts`. Tasks are detected
  from `- [ ]` / `- [x]` lines tagged `#today`; Quick Capture notes are
  written to `10-Fleeting/QuickCapture/` with `cardType`/`tags` frontmatter;
  the 12-week goal is read from `30-Direction/CurrentGoal.md`'s frontmatter.
- **TickTick**: see `src/lib/ticktickAdapter.ts`. Requires an OAuth2 access
  token (authorization-code flow) stored in plugin settings
  (`AkcDashboardSettings.ticktickAccessToken`); a settings tab to run that
  flow is not yet implemented (`TODO`).
- **Local LLM (Ollama)**: see `src/lib/ollamaAdapter.ts`. Calls
  `POST /api/generate` (classification/tags) and `POST /api/embeddings`
  (related-card ranking) against `http://127.0.0.1:11434` by default.
- **Smart Connections** (optional): see `src/lib/smartConnectionsAdapter.ts`.
  If the community plugin is installed, related-card suggestions reuse its
  existing vault-wide embedding index instead of recomputing one; falls back
  to the Ollama path above otherwise.

## Pairing with a batch-ingestion tool (e.g. a distillation pipeline)

This plugin's QuickCapture is deliberately for one thought at a time — it's
not built to take a whole PDF or article and explode it into a dozen notes in
one pass. That's a different, heavier job (chunking, batch LLM calls, PDF
parsing) better done by a separate tool running against the same vault.

Two things make that pairing work with zero glue code, as long as the other
tool's output matches this contract:

1. **Frontmatter, not folders, is the index.** `vaultAdapter.ts`'s
   `loadMocEntries` / `loadCoreCardCount` scan the *entire* vault for
   `cardType: moc` / `cardType: core` frontmatter — they don't care what
   folder a note lives in. A batch tool can keep its own folder layout
   (e.g. `03-Permanent-Notes/<theme>/`, `04-Maps-of-Content/`) and its notes
   will still show up in this plugin's sidebar, as long as it writes
   `cardType: core` (not some other field name like `type: permanent`) and
   `cardType: moc` on its index notes.
2. **`CardType` includes `comparison`** specifically for cross-tradition /
   cross-source comparison notes (two theological positions, two religions,
   etc. discussed side by side) — these are structurally different from a
   `core` note's single atomic claim, so a batch tool that produces this
   kind of note should tag it `cardType: comparison` rather than force-fitting
   it into `core`.

In short: point the other tool's vault path at the same vault, make it emit
`cardType` frontmatter instead of its own scheme, and this plugin picks up
its output automatically on the next vault scan — no import step needed.

For quick access while the two run side by side, the SkillLauncherBar's
`/distill` command (`open-distill-tool` in `mockData.ts`) opens
`AkcDashboardSettings.distillToolUrl` (default `http://localhost:8501`, the
Streamlit default) in the browser — this plugin never launches or manages
that process, it just assumes you've already started it yourself.

## Status

Initial frontend scaffold: full type definitions, all four dashboard
components, optimistic local-first state management in `TodayDashboard.tsx`,
and adapter stubs wired into a working `ItemView`. Not yet built: the
TickTick OAuth settings tab, a persisted embedding index for related-card
ranking (currently recomputed from an empty list — see the `TODO` in
`DashboardView.tsx`), and the weekly-report/AI-review skill implementations.
