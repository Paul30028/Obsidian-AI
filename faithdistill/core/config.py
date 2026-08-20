from pathlib import Path
from dataclasses import dataclass, field
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    # Point this at the SAME Obsidian vault the obsidian-ai-dashboard plugin
    # is installed into (set OBSIDIAN_VAULT in .env) — that's what lets
    # notes written here show up in the plugin's MOC/core-card sidebar.
    vault_path: Path = Path(os.getenv("OBSIDIAN_VAULT", "./obsidian-vault"))

    # 输出目录结构
    permanent_dir: str = "03-Permanent-Notes"
    literature_dir: str = "02-Literature-Notes"
    moc_dir: str = "04-Maps-of-Content"
    comparison_dir: str = "06-Comparisons"
    inbox_dir: str = "00-Inbox"

    # LLM 配置（支持 Ollama 本地 或 OpenAI 兼容接口）
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "ollama")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:14b")  # 或 llama3.1, deepseek-r1 等

    # 蒸馏参数
    max_notes_per_chunk: int = 8
    chunk_size: int = 3000  # 字符

    # 默认主题分类
    default_themes: List[str] = field(default_factory=lambda: [
        "神论", "基督论", "圣灵论", "救赎论", "教会论",
        "末世论", "圣经论", "人论", "伦理学", "护教学",
        "历史神学", "实践神学", "跨宗教比较"
    ])

config = Config()
