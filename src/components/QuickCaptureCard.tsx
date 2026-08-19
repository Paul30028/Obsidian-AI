import React, { useState } from "react";
import { Loader2, Send, Sparkles, Link2 } from "lucide-react";
import type { QuickNote } from "../types/dashboard";

interface QuickCaptureCardProps {
  notes: QuickNote[];
  /** Parent creates the optimistic draft QuickNote and calls
   *  DashboardHandlers.onCaptureQuickNote, which in turn calls the local
   *  LLM adapter for tagging/link suggestions. */
  onCapture: (content: string) => void;
}

/** Flomo-style: type, hit send (or Cmd/Ctrl+Enter), input clears immediately. */
export function QuickCaptureCard({ notes, onCapture }: QuickCaptureCardProps) {
  const [draft, setDraft] = useState("");

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCapture(trimmed);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const recent = notes.slice(0, 5);

  return (
    <div className="akc-dashboard flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">闪念速记</h2>

      <div className="mb-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="记录一个念头… (⌘/Ctrl + Enter 发送)"
          rows={2}
          className="min-w-0 flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-slate-950 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
          aria-label="发送"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ul className="flex-1 space-y-2 overflow-y-auto">
        {recent.map((note) => (
          <li key={note.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-sm text-slate-200">{note.content}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {note.status === "processing" && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  本地 LLM 分析中…
                </span>
              )}

              {note.status === "error" && (
                <span className="text-xs text-rose-400">AI 打标失败，已保存原文</span>
              )}

              {note.cardType && (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400">
                  {note.cardType === "moc" ? "索引卡片" : note.cardType === "reading" ? "阅读卡片" : "核心卡片"}
                </span>
              )}

              {note.tags.map((tag) => (
                <span key={tag} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                  #{tag}
                </span>
              ))}
            </div>

            {note.suggestedLinks.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Link2 className="h-3 w-3 text-purple-400" aria-hidden />
                {note.suggestedLinks.map((link) => (
                  <span
                    key={link.noteId}
                    title={`相似度 ${(link.similarity * 100).toFixed(0)}%`}
                    className="rounded border border-purple-800 bg-purple-950/40 px-1.5 py-0.5 text-xs text-purple-300"
                  >
                    {link.noteTitle}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}

        {recent.length === 0 && (
          <li className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-sm text-slate-600">
            <Sparkles className="h-4 w-4" aria-hidden />
            还没有闪念，随手记一个吧。
          </li>
        )}
      </ul>
    </div>
  );
}
