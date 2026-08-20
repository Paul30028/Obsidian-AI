# FaithDistill — 宗教知识蒸馏引擎

把圣经、神学、基督教及其他宗教内容，批量蒸馏成结构化、可链接的 Obsidian
原子笔记。跟 `obsidian-ai-dashboard` 插件的 QuickCapture（一次一句闪念）不是
一回事——这个是"一次性把一整篇讲章/PDF 拆成一批原子笔记"的重活儿，跑在独立
的 Streamlit 进程里，通过写入同一个 vault 与插件对接（不需要插件代码知道
这个工具的存在）。

对接细节见仓库根目录 `README.md` 的「Pairing with a batch-ingestion tool」
一节——核心就一条：这里写的笔记用 `cardType: core`（MOC 用
`cardType: moc`），而不是原设计里的 `type: permanent`/`type: moc`，插件靠
`cardType` 字段的全库扫描才能认出这些笔记。

## 安装

推荐直接用仓库根目录的一键脚本（同时装好插件和这个工具）：

```bash
./scripts/install.sh /path/to/your/Obsidian/Vault          # macOS / Linux / Git Bash
.\scripts\install.ps1 "D:\path\to\your\Obsidian\Vault"      # Windows PowerShell
```

或者只装这一个工具：

```bash
cd faithdistill
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 编辑 .env，把 OBSIDIAN_VAULT 指向你的 vault
```

## 运行

```bash
./scripts/start-distill.sh          # macOS / Linux / Git Bash
.\scripts\start-distill.ps1         # Windows PowerShell
# 或者手动：cd faithdistill && source .venv/bin/activate && streamlit run app.py
```

浏览器打开 `http://localhost:8501`（或直接在 Dashboard 顶部指令栏点
"批量蒸馏" / 输入 `/distill`）。

## 使用

1. 粘贴文本，或上传 Markdown / PDF
2. 选主题、宗教视角、期望笔记数量
3. 点「开始蒸馏」——生成的原子笔记直接写进 vault 对应主题文件夹，并自动
   更新该主题的 MOC

## 依赖一个本地或云端的 LLM

默认配置指向本地 Ollama（`http://localhost:11434/v1`）。需要先：

```bash
ollama serve
ollama pull qwen2.5:14b   # 或 .env 里配置的其他模型
```

也可以把 `.env` 里的 `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` 换成任何
OpenAI 兼容的云端接口。
