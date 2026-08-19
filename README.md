# Obsidian-AI — Today's Dashboard

An Obsidian plugin implementing a **Dashboard-First** workspace built around
the **AKC model**:

- **Action** — today's tasks (local Markdown checkboxes + TickTick sync),
  completed items feed an end-of-day AI review queue.
- **Knowledge** — Zettelkasten-style card capture (index/MOC, reading, core
  cards) with local-LLM auto-tagging and related-card suggestions.
- **Direction** — a 12-week goal cycle, decomposed into weekly objectives,
  tracked alongside the daily view instead of buried in a separate file.

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

## Status

Initial frontend scaffold: full type definitions, all four dashboard
components, optimistic local-first state management in `TodayDashboard.tsx`,
and adapter stubs wired into a working `ItemView`. Not yet built: the
TickTick OAuth settings tab, a persisted embedding index for related-card
ranking (currently recomputed from an empty list — see the `TODO` in
`DashboardView.tsx`), and the weekly-report/AI-review skill implementations.
