import React, { useMemo, useState } from "react";
import { ChevronRight, Loader2, Terminal } from "lucide-react";
import type { SkillCommand } from "../types/dashboard";
import { resolveIcon } from "./icons";

interface SkillLauncherBarProps {
  commands: SkillCommand[];
  /** Parent (TodayDashboard) owns state + calls DashboardHandlers.onRunSkillCommand. */
  onRun: (commandId: string) => void;
}

/**
 * Terminal-styled quick-command strip. Two ways to trigger a skill:
 *  1. Click one of the preset chips.
 *  2. Type its `/command` text (or a substring of the label) into the
 *     inline prompt and hit Enter — mirrors a real terminal/command palette.
 */
export function SkillLauncherBar({ commands, onRun }: SkillLauncherBarProps) {
  const [input, setInput] = useState("");

  const matchedCommand = useMemo(() => {
    const query = input.trim().toLowerCase().replace(/^\//, "");
    if (!query) return null;
    return (
      commands.find((c) => c.command.toLowerCase().replace(/^\//, "") === query) ??
      commands.find(
        (c) =>
          c.command.toLowerCase().includes(query) ||
          c.label.toLowerCase().includes(query)
      ) ??
      null
    );
  }, [commands, input]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (matchedCommand && !matchedCommand.isRunning) {
      onRun(matchedCommand.id);
      setInput("");
    }
  }

  return (
    <div className="akc-dashboard flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-sm shadow-inner">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Terminal className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        {commands.map((cmd) => {
          const Icon = resolveIcon(cmd.icon);
          return (
            <button
              key={cmd.id}
              type="button"
              disabled={cmd.isRunning}
              onClick={() => onRun(cmd.id)}
              title={cmd.description}
              className="group flex shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200 transition-colors hover:border-emerald-500 hover:text-emerald-300 disabled:cursor-wait disabled:opacity-60"
            >
              {cmd.isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" aria-hidden />
              ) : (
                <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-400" aria-hidden />
              )}
              <span>{cmd.label}</span>
              <span className="text-slate-600">{cmd.command}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-800 pt-2">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-purple-400" aria-hidden />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入指令，例如 /weekly-report 后回车…"
          className="min-w-0 flex-1 bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none"
        />
        {matchedCommand && (
          <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400">
            ↵ {matchedCommand.label}
          </span>
        )}
      </form>
    </div>
  );
}
