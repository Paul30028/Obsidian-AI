from openai import OpenAI
from datetime import datetime
from typing import List, Dict
import re
from .config import config
from .prompts import ATOMIC_DISTILL_PROMPT

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
