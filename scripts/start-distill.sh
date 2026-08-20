#!/usr/bin/env bash
# Starts FaithDistill (Streamlit) after ./scripts/install.sh has set up its venv.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/faithdistill"

if [[ ! -d .venv ]]; then
  echo "还没装 FaithDistill 的 Python 环境，先运行 ./scripts/install.sh" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate
streamlit run app.py
