#!/usr/bin/env bash
# TruckerNet dev runner
# Starts Expo dev server + auto-commits and pushes every file save to GitHub.
# Usage: ./dev.sh

set -euo pipefail

REPO="/Users/novaboost/NovaBoostLabs/TruckerNet"
cd "$REPO"

# --- Expo dev server ---
echo "▶  Starting Expo dev server..."
npx expo start &
EXPO_PID=$!

cleanup() {
  echo ""
  echo "⏹  Stopping Expo (PID $EXPO_PID) and watcher..."
  kill "$EXPO_PID" 2>/dev/null || true
  kill "$WATCHER_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- Auto-commit watcher ---
echo "👀 Watching for file changes (auto-commit + push)..."

auto_commit() {
  local changed_file="$1"

  # Ignore files that shouldn't be committed
  [[ "$changed_file" == *"node_modules"* ]] && return
  [[ "$changed_file" == *".git/"* ]]        && return
  [[ "$changed_file" == *".expo/"* ]]        && return
  [[ "$changed_file" == *"__pycache__"* ]]   && return

  # Debounce: wait for writes to settle
  sleep 2

  # Nothing to commit? Skip.
  if git -C "$REPO" diff --quiet && git -C "$REPO" diff --cached --quiet && \
     [ -z "$(git -C "$REPO" ls-files --others --exclude-standard)" ]; then
    return
  fi

  local rel_file
  rel_file="${changed_file#$REPO/}"
  local msg="Auto-save: ${rel_file} ($(date '+%H:%M:%S'))"

  echo "💾  $msg"
  git -C "$REPO" add -A
  git -C "$REPO" commit -m "$msg" --quiet && \
    git -C "$REPO" push origin main --quiet && \
    echo "✅  Pushed to origin/main" || \
    echo "⚠️  Push failed (will retry on next save)"
}

export -f auto_commit
export REPO

fswatch \
  --exclude="\.git" \
  --exclude="node_modules" \
  --exclude="\.expo" \
  --exclude="\.DS_Store" \
  --latency 0.5 \
  --one-per-batch \
  "$REPO" | while IFS= read -r changed_file; do
    auto_commit "$changed_file" &
  done &
WATCHER_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Expo:    running (PID $EXPO_PID)"
echo "  Watcher: running (PID $WATCHER_PID)"
echo "  Ctrl-C to stop both"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Keep alive until Ctrl-C
wait $EXPO_PID
