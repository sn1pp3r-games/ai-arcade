#!/usr/bin/env bash
# Copies a project folder into this directory (~/ai arcade).
#
# From Terminal, run ONE of:
#   cd "/path/to/your/game/project" && bash "$HOME/ai arcade/copy-into-ai-arcade.sh"
#   bash "$HOME/ai arcade/copy-into-ai-arcade.sh" "/path/to/your/game/project"
#
# Default source if you pass nothing: ~/ai in charge game dev (legacy name)
set -euo pipefail
DST="$HOME/ai arcade"
SRC="${1:-$HOME/ai in charge game dev}"

if [[ ! -d "$SRC" ]]; then
  echo "Source folder not found: $SRC"
  echo "Open Terminal, cd to the folder that has arcade.js, then run:"
  echo "  bash \"$HOME/ai arcade/copy-into-ai-arcade.sh\" \"\$PWD\""
  exit 1
fi

mkdir -p "$DST"
rsync -a "$SRC/" "$DST/"
echo "Done. Copied into: $DST"
ls -la "$DST"
