#!/usr/bin/env bash
#
# loop-cron.sh — guarded automatic runner for the jx2-web feature pipeline.
#
# Runs at most one L2 feature-pipeline cycle per invocation, only when it is
# safe to do so. Designed to be driven by cron (e.g. hourly during the day).
#
# It refuses to run when:
#   - it is outside the configured day window,
#   - another cycle already holds the lock,
#   - the working tree is dirty,
#   - we are not on the `develop` branch,
#   - a leftover `loop/*` branch/worktree exists (an interrupted run).
#
# Configure via environment variables (all optional):
#   JX2_REPO       repo path          (default: /home/theanh/projects/jx2-web)
#   JX2_AGENT      opencode agent     (default: loop-feature)
#   JX2_MODEL      model slug         (default: opencode/deepseek-v4.1-flash-free)
#   JX2_TIMEOUT    per-run timeout    (default: 30m)
#   JX2_START_HOUR window start hour  (default: 8, inclusive, local time)
#   JX2_END_HOUR   window end hour    (default: 22, exclusive, local time)
#   JX2_LOG        log file           (default: /tmp/jx2-loop-cron.log)
#   JX2_AUTO_FLAG  permission flag    (default: --auto)
#
set -euo pipefail

REPO="${JX2_REPO:-/home/theanh/projects/jx2-web}"
AGENT="${JX2_AGENT:-loop-feature}"
MODEL="${JX2_MODEL:-opencode/deepseek-v4.1-flash-free}"
TIMEOUT="${JX2_TIMEOUT:-30m}"
START_HOUR="${JX2_START_HOUR:-8}"
END_HOUR="${JX2_END_HOUR:-22}"
LOG="${JX2_LOG:-/tmp/jx2-loop-cron.log}"
AUTO_FLAG="${JX2_AUTO_FLAG:---auto}"

LOCK="${JX2_LOCK:-/tmp/jx2-loop.lock}"
PROMPT="Run one feature pipeline cycle"

say() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG"
}

# --- 0. Dependencies -------------------------------------------------------
for cmd in git flock timeout opencode; do
  command -v "$cmd" >/dev/null 2>&1 || { say "required command '$cmd' not found; abort"; exit 1; }
done

# --- 1. Day window ---------------------------------------------------------
hour=$(date +%-H)
if (( hour < START_HOUR || hour >= END_HOUR )); then
  say "outside window ${START_HOUR}:00-${END_HOUR}:00 (now ${hour}h); skip"
  exit 0
fi

# --- 2. Single-instance lock ----------------------------------------------
exec 9>"$LOCK"
if ! flock -n 9; then
  say "another cycle holds $LOCK; skip"
  exit 0
fi

cd "$REPO" || { say "cannot cd into JX2_REPO='$REPO'; skip"; exit 0; }

# --- 3. Preconditions -----------------------------------------------------
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "develop" ]]; then
  say "on branch '$branch', not 'develop'; skip"
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  say "working tree is dirty; skip"
  exit 0
fi

if git branch --list 'loop/*' | grep -q .; then
  say "leftover 'loop/*' branch present (interrupted run?); skip"
  exit 0
fi

if [[ $(git worktree list | wc -l) -gt 1 ]]; then
  say "leftover loop worktree present; skip"
  exit 0
fi

# --- 4. Sync develop (fast-forward only) ----------------------------------
if ! git fetch origin --quiet; then
  say "git fetch failed (offline?); skip"
  exit 0
fi
git merge --ff-only origin/develop >/dev/null 2>&1 || {
  say "develop is not a fast-forward of origin/develop; skip"
  exit 0
}

# --- 5. Run one pipeline cycle --------------------------------------------
say "start: agent=$AGENT model=$MODEL timeout=$TIMEOUT"
run_args=(--agent "$AGENT" -m "$MODEL")
if [[ -n "$AUTO_FLAG" ]]; then
  # JX2_AUTO_FLAG may hold one or more flags (e.g. "--auto").
  read -r -a _auto <<< "$AUTO_FLAG"
  run_args+=("${_auto[@]}")
fi
set +e
timeout "$TIMEOUT" opencode run "$PROMPT" "${run_args[@]}" 2>&1 | tee -a "$LOG"
rc=${PIPESTATUS[0]}
set -e

if [[ "$rc" -eq 124 ]]; then
  say "cycle hit the ${TIMEOUT} timeout (rc=124)"
elif [[ "$rc" -ne 0 ]]; then
  say "cycle exited rc=$rc"
else
  say "cycle finished rc=0"
fi

exit "$rc"
