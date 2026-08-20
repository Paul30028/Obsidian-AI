from openai import OpenAI
from datetime import datetime
from typing import List, Dict
import re
from .config import config
from .prompts import ATOMIC_DISTILL_PROMPT

def chunk_text(text: str, chunk_size: int) -> List[str]:
    """Splits long input (e.g. a whole book's extracted PDF text) into
    chunks around `chunk_size` characters each, so a single LLM call only
    ever has to digest one chunk instead of the entire document. Prefers
    paragraph boundaries (blank-line-separated) so notes aren't split
    mid-sentence; a single paragraph longer than chunk_size is hard-split
    as a last resort."""
    paragraphs = re.split(r"\n\s*\n", text.strip())
    chunks: List[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(para) > chunk_size:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(para), chunk_size):
                chunks.append(para[i:i + chunk_size])
            continue

        if current and len(current) + len(para) + 2 > chunk_size:
            chunks.append(current)
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para

    if current:
        chunks.append(current)
    return chunks


class Distiller:
    def __init__(self):
        self.client = OpenAI(
            base_url=config.llm_base_url,
            api_key=config.llm_api_key
        )

    def distill(self, text: str, theme: str = "救赎论", religion: str = "christianity") -> List[Dict]:
        """把长文本蒸馏成多张原子笔记"""
        prompt = ATOMIC_DISTILL_PROMPT.format(
            max_notes=config.max_notes_per_chunk,
            theme=theme,
            date=datetime.now().strftime("%Y-%m-%d")
        )

        response = self.client.chat.completions.create(
            model=config.llm_model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=4000
        )

        raw = response.choices[0].message.content
        return self._parse_notes(raw)

    def _parse_notes(self, raw: str) -> List[Dict]:
        """解析 LLM 返回的多笔记文本"""
        parts = re.split(r"---NOTE---", raw)
        notes = []

        for part in parts:
            part = part.strip()
            if not part or not part.startswith("---"):
                continue
            try:
                # 简单分离 YAML 和正文
                yaml_end = part.find("---", 3)
                if yaml_end == -1:
                    continue
                frontmatter = part[3:yaml_end].strip()
                body = part[yaml_end+3:].strip()

                # 提取标题
                title_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
                title = title_match.group(1).strip() if title_match else "未命名笔记"

                notes.append({
                    "frontmatter": frontmatter,
                    "body": body,
                    "title": title
                })
            except Exception:
                continue
        return notes
