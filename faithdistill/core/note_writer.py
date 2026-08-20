from pathlib import Path
from datetime import datetime
import re
from .config import config

class NoteWriter:
    def __init__(self):
        self.vault = config.vault_path
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [config.permanent_dir, config.literature_dir,
                  config.moc_dir, config.comparison_dir, config.inbox_dir]:
            (self.vault / d).mkdir(parents=True, exist_ok=True)

    def write_permanent_note(self, note: dict, theme: str) -> Path:
        """写入一张永久笔记，返回文件路径"""
        # 清理文件名
        safe_title = re.sub(r'[\\/*?:"<>|]', "", note["title"])[:80]
        filename = f"{safe_title}.md"

        theme_dir = self.vault / config.permanent_dir / theme
        theme_dir.mkdir(parents=True, exist_ok=True)

        filepath = theme_dir / filename

        content = f"---\n{note['frontmatter']}\n---\n\n{note['body']}\n"
        filepath.write_text(content, encoding="utf-8")
        return filepath

    def append_to_moc(self, theme: str, note_title: str, one_liner: str = ""):
        """把新笔记加入对应主题的 MOC"""
        moc_path = self.vault / config.moc_dir / f"MOC - {theme}.md"

        if not moc_path.exists():
            # cardType: moc (not "type: moc") -- this is what lets the
            # obsidian-ai-dashboard plugin's sidebar pick this file up as a
            # Map of Content via its whole-vault frontmatter scan.
            header = f"""---
cardType: moc
title: {theme}
theme: {theme}
---

# MOC - {theme}

## 核心笔记

"""
            moc_path.write_text(header, encoding="utf-8")

        # 追加条目（简单去重）
        current = moc_path.read_text(encoding="utf-8")
        entry = f"- [[{note_title}]]"
        if one_liner:
            entry += f" — {one_liner}"

        if f"[[{note_title}]]" not in current:
            with open(moc_path, "a", encoding="utf-8") as f:
                f.write(entry + "\n")
