#!/usr/bin/env bash
# Starts FaithDistill (Streamlit) after ./scripts/install.sh has set up its venv.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/faithdistill"

if [[ ! -d .venv ]]; then
  echo "还没装 FaithDistill 的 Python 环境，先运行 ./scripts/install.sh" >&2
  exit 1
fi

# A venv created by a native Windows Python (even when invoked from Git Bash)
# lays out as .venv/Scripts/, not .venv/bin/ — check both.
if [[ -f .venv/bin/activate ]]; then
  ACTIVATE=.venv/bin/activate
else
  ACTIVATE=.venv/Scripts/activate
fi
# shellcheck disable=SC1090
source "$ACTIVATE"
streamlit run app.py
