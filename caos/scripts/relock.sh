#!/usr/bin/env bash
# Regenerate caos/server/requirements.lock from requirements-lock.in.
#
# Why this exists: dependabot bumps requirements.txt but cannot regenerate a
# pip-compile lock, so the "Lock — requirements.lock in sync" gate fails on every
# pip dependabot PR by construction. That gate is correct — the prod image installs
# from the lock, so an unpropagated bump would ship a stale package. The missing
# piece was a one-command relock. Run this on a red pip PR, commit the lock, done.
#
#   caos/scripts/relock.sh          # regenerate
#   caos/scripts/relock.sh --check  # verify in sync, leave the file alone
#
# CRITICAL: the output must be written IN PLACE. pip-compile treats an existing
# output file as its constraint set, so writing to a fresh path drops every pin and
# floats the whole transitive graph to latest (observed: annotated-types 0.7->0.8,
# anthropic 0.116->0.120, certifi, cffi, ... on a no-op run). Writing in place is
# byte-identical when nothing changed, which is what makes --check meaningful.
set -euo pipefail

cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

IN=caos/server/requirements-lock.in
OUT=caos/server/requirements.lock
# The invocation is load-bearing: pip-compile bakes this exact command (including
# the relative paths) into the file header, so changing cwd or flags produces a
# spurious diff. Always invoke from the repo root with these arguments.
ARGS=(--generate-hashes --output-file="$OUT" --strip-extras "$IN")

# pip-compile from whichever project venv has it. Also check the MAIN worktree:
# linked worktrees have no .venv of their own, and a dependabot relock is usually
# done from a worktree, so a cwd-relative search alone finds nothing there.
MAIN=$(dirname "$(git rev-parse --git-common-dir)")
PC=""
for v in caos/server/.venv311 caos/server/.venv \
         "$MAIN/caos/server/.venv311" "$MAIN/caos/server/.venv"; do
  [ -x "$v/bin/pip-compile" ] && { PC="$v/bin/pip-compile"; break; }
done
if [ -z "$PC" ]; then
  if command -v pip-compile >/dev/null; then
    PC=pip-compile
  else
    echo "pip-compile not found. Install pip-tools into caos/server/.venv311:" >&2
    echo "  caos/server/.venv311/bin/pip install pip-tools" >&2
    exit 1
  fi
fi

if [ "${1:-}" = "--check" ]; then
  before=$(mktemp); trap 'rm -f "$before"' EXIT
  cp "$OUT" "$before"
  "$PC" --quiet "${ARGS[@]}"
  if cmp -s "$before" "$OUT"; then
    echo "lock in sync"
  else
    # Restore so --check never mutates the tree, then report.
    cp "$before" "$OUT"
    echo "lock OUT OF SYNC — run: caos/scripts/relock.sh" >&2
    exit 1
  fi
else
  "$PC" "${ARGS[@]}"
  if git diff --quiet -- "$OUT"; then
    echo "lock already in sync (no change)"
  else
    echo "lock regenerated:"
    git --no-pager diff --stat -- "$OUT"
    echo "commit it:  git add $OUT && git commit -m 'chore(deps): regenerate requirements.lock'"
  fi
fi
