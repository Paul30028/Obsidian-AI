#!/usr/bin/env bash
# One-click setup for the AKC dashboard (Obsidian plugin) + FaithDistill
# (local batch-distillation tool), pointed at the same vault.
#
# Usage: ./scripts/install.sh /path/to/your/Obsidian/Vault
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT_PATH="${1:-}"

if [[ -z "$VAULT_PATH" ]]; then
  read -rp "Obsidian Vault 的绝对路径（一个已经存在的 vault 文件夹）: " VAULT_PATH
fi

if [[ ! -d "$VAULT_PATH" ]]; then
  echo "找不到目录：$VAULT_PATH" >&2
  exit 1
fi
VAULT_PATH="$(cd "$VAULT_PATH" && pwd)"

echo "==> 1/4 构建 Obsidian 插件"
if ! command -v npm >/dev/null 2>&1; then
  echo "需要先安装 Node.js（含 npm）：https://nodejs.org" >&2
  exit 1
fi
cd "$REPO_ROOT"
npm install
npm run css
npm run build

echo "==> 2/4 安装插件到 vault"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-ai-dashboard"
mkdir -p "$PLUGIN_DIR"
cp "$REPO_ROOT/manifest.json" "$REPO_ROOT/main.js" "$REPO_ROOT/styles.css" "$PLUGIN_DIR/"
echo "    已复制 manifest.json / main.js / styles.css 到 $PLUGIN_DIR"

echo "==> 3/4 配置 FaithDistill（批量蒸馏工具，可选）"
# paddlepaddle/paddleocr (used for scanned-PDF OCR) only ship wheels up to
# Python 3.12 as of writing. On a machine with multiple Pythons installed,
# "python"/"python3" often resolves to the newest one (3.13/3.14), which
# makes `pip install -r requirements.txt` fail with a confusing "No
# matching distribution found: paddlepaddle" -- so explicitly-versioned
# interpreters known to work are tried first, generic ones last.
PYTHON_BIN=()
for candidate in "py -3.12" "py -3.11" "py -3.10" "python3.12" "python3.11" "python3.10" "py -3.13" "python3.13" "python3" "python"; do
  # shellcheck disable=SC2206
  cmd=($candidate)
  if command -v "${cmd[0]}" >/dev/null 2>&1 \
    && "${cmd[@]}" -c 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PYTHON_BIN=("${cmd[@]}")
    break
  fi
done

if [[ ${#PYTHON_BIN[@]} -gt 0 ]]; then
  PY_VERSION="$("${PYTHON_BIN[@]}" -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")')"
  cd "$REPO_ROOT/faithdistill"
  "${PYTHON_BIN[@]}" -m venv .venv

  # A venv created by a native Windows Python (even when invoked from Git
  # Bash) lays out as .venv/Scripts/, not .venv/bin/ — check both.
  if [[ -f .venv/bin/activate ]]; then
    ACTIVATE=.venv/bin/activate
  else
    ACTIVATE=.venv/Scripts/activate
  fi
  # shellcheck disable=SC1090
  source "$ACTIVATE"
  # Don't let a failure here (e.g. no paddlepaddle wheel for this Python)
  # abort the whole script -- the plugin install above already succeeded
  # and its "next steps" summary should still print.
  set +e
  pip install --quiet -r requirements.txt
  PIP_STATUS=$?
  set -e
  deactivate

  if [[ $PIP_STATUS -ne 0 ]]; then
    echo "    FaithDistill 依赖安装失败（Python $PY_VERSION）。若上面提示 paddlepaddle 找不到匹配版本："
    echo "    PaddleOCR（扫描件识别）目前只支持到 Python 3.12，装一个 3.12 后重跑本脚本即可（会自动优先选中）。"
  else
    if [[ ! -f .env ]]; then
      cp .env.example .env
      # macOS/BSD sed needs -i '', GNU sed needs -i — try GNU first, fall back to BSD
      sed -i.bak "s#^OBSIDIAN_VAULT=.*#OBSIDIAN_VAULT=$VAULT_PATH#" .env 2>/dev/null \
        || sed -i '' "s#^OBSIDIAN_VAULT=.*#OBSIDIAN_VAULT=$VAULT_PATH#" .env
      rm -f .env.bak
    fi
    echo "    FaithDistill 的 Python 环境已就绪（.venv，Python $PY_VERSION），.env 已指向 $VAULT_PATH"
  fi
else
  echo "    未检测到 Python 3，跳过 FaithDistill 安装。之后装了 Python 可单独运行本脚本的这一步。"
fi

echo "==> 4/4 完成"
cat <<EOF

接下来手动做这几步：
  1. 打开 Obsidian → 设置 → Community plugins → 关掉 Restricted mode（如果还没关）
  2. 在插件列表里找到 "Today's Dashboard (AKC)"，打开开关启用
  3. （可选）本地跑 Ollama 才能用 AI 打标/复盘功能：
       ollama serve
       ollama pull qwen3:8b
       ollama pull bge-m3
  4. （可选）要用批量蒸馏功能：
       ./scripts/start-distill.sh
     然后在 Dashboard 顶部指令栏点 "批量蒸馏" 或输入 /distill 一键跳转

EOF
