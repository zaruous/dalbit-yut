#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
laya_venv="${LAYA_VENV:-$repo_dir/.venv-laya}"
if command -v uv >/dev/null 2>&1; then
  if [[ ! -x "$laya_venv/bin/python" ]]; then uv venv "$laya_venv"; fi
  uv pip install --python "$laya_venv/bin/python" --index-url https://download.pytorch.org/whl/cpu 'torch==2.14.1+cpu'
  uv pip install --python "$laya_venv/bin/python" -r "$repo_dir/requirements-laya.txt"
else
  if [[ ! -x "$laya_venv/bin/python" ]]; then python3 -m venv "$laya_venv"; fi
  "$laya_venv/bin/python" -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.14.1+cpu'
  "$laya_venv/bin/python" -m pip install -r "$repo_dir/requirements-laya.txt"
fi
"$laya_venv/bin/python" -I "$repo_dir/scripts/laya-worker.py" --check-install
