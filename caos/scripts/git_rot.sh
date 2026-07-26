#!/usr/bin/env bash
# Branch-rot report: what is actually landable, what needs a rebase, what is dead.
#
# Why this exists: divergence in this repo is invisible. Nothing in `git status`,
# `git branch`, or the GitHub PR list tells you that a PR is 200 commits behind
# main, that a worktree lives in a directory macOS will purge, or that 20 local
# branches were never pushed. So branches accumulated silently until every merge
# was a conflict. This prints the numbers and a verdict per branch, so the
# merge/rebase/close decision is a read rather than an investigation.
#
# Read-only. Prints verdicts; never rebases, pushes, merges, or deletes.
#
#   caos/scripts/git_rot.sh            # everything
#   caos/scripts/git_rot.sh --prs      # open PRs only
#   caos/scripts/git_rot.sh --local    # local branches + worktrees only
#
# ponytail: thresholds are constants below, not flags. Make them flags when
# someone actually wants a different number.
set -uo pipefail

BASE="${ROT_BASE:-origin/main}"
STALE=50   # commits behind BASE at which a branch is "rotted"
OLD=14     # days without a commit at which a local branch is "cold"

# Pure function, no git calls: takes a precomputed behind-count so --selftest can
# pin the WARN/OK threshold without fabricating branches or touching real refs —
# this script is read-only and stays that way even in its own tests. Defined here
# (before the --ci/--selftest dispatch below) so --selftest can call it.
_stale_upstream_verdict() { # <branch> <upstream> <behind-count>
  if [ "$3" -gt 0 ]; then
    echo "  WARN: $1 tracks $2, which is $3 commits behind origin/main."
    echo "        A new-only complexity/duplication gate scoped to @{upstream} will"
    echo "        misattribute up to $3 commits of main's history as yours."
    echo "        If this branch merges into main: git branch --set-upstream-to=origin/main $1"
  else
    echo "  OK: $1 tracks $2, which is current with origin/main."
  fi
}

want_prs=1; want_local=1
case "${1:-}" in
  --prs)   want_local=0 ;;
  --local) want_prs=0 ;;
  --ci)    want_local=0; ci=1 ;;
  --selftest) want_prs=1; want_local=0; selftest=1 ;;
  --help|-h) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac

# --ci: same report, but exit nonzero once the backlog has actually rotted, so a
# scheduled job can say so instead of waiting for someone to remember to look.
# Threshold is staleness, not count: ten fresh PRs are healthy, one PR 50 commits
# behind is the state that produced a 22-PR pile-up nobody could land.
if [ "${ci:-0}" = 1 ]; then
  out=$("$0" --prs) || true
  echo "$out"
  worst=$(echo "$out" | sed -n 's/.*ROT_WORST_BEHIND=\([0-9]*\).*/\1/p' | tail -1)
  pr=$(echo "$out" | sed -n 's/.*ROT_WORST_PR=\([^ ]*\).*/\1/p' | tail -1)
  unknown=$(echo "$out" | sed -n 's/.*ROT_UNKNOWN=\([0-9]*\).*/\1/p' | tail -1)
  # A PR whose branch ref is missing locally cannot be measured, and an unmeasured
  # backlog is not a healthy one. Fail rather than report OK on partial data —
  # every gate fixed in this repo on 2026-07-26 failed by being green for the
  # wrong reason, and this one is not going to join them.
  if [ -z "${worst:-}" ] || [ -z "${unknown:-}" ]; then
    echo ""
    echo "FAIL: could not parse the rot rollup — refusing to report health."
    exit 1
  fi
  if [ "$unknown" -gt 0 ]; then
    echo ""
    echo "FAIL: $unknown open PR(s) have no local branch ref, so their staleness is"
    echo "unknown. Fetch all heads first:"
    echo "  git fetch origin '+refs/heads/*:refs/remotes/origin/*'"
    exit 1
  fi
  if [ "$worst" -ge "$STALE" ]; then
    echo ""
    echo "FAIL: PR #$pr is $worst commits behind $BASE (threshold $STALE)."
    echo "Rebase or close it. A branch this far back conflicts on contact, and its"
    echo "CI failures stop being attributable to its own diff."
    exit 1
  fi
  echo ""
  echo "OK: nothing past the ${STALE}-commit staleness threshold."
  exit 0
fi

# Verdict logic is the only real logic here, so it gets one check. --selftest
# feeds fixture PRs through the same code path and asserts the verdicts, with no
# network and no repo state involved. ROT_FIXTURE is what makes that possible:
# when set, PR JSON is read from the file instead of `gh`.
if [ "${selftest:-0}" = 1 ]; then
  fx=$(mktemp); trap 'rm -f "$fx"' EXIT
  cat >"$fx" <<'JSON'
[{"number":1,"headRefName":"x-conflicting","mergeable":"CONFLICTING","mergeStateStatus":"DIRTY",
  "statusCheckRollup":[{"name":"CI","conclusion":"SUCCESS"}]},
 {"number":2,"headRefName":"x-redci","mergeable":"MERGEABLE","mergeStateStatus":"UNSTABLE",
  "statusCheckRollup":[{"name":"Server — pytest","conclusion":"FAILURE"}]},
 {"number":3,"headRefName":"x-clean","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN",
  "statusCheckRollup":[{"name":"CI","conclusion":"SUCCESS"}]},
 {"number":4,"headRefName":"x-running","mergeable":"UNKNOWN","mergeStateStatus":"UNKNOWN",
  "statusCheckRollup":[{"name":"CI","conclusion":null,"state":"PENDING"}]},
 {"number":5,"headRefName":"x-mergeable-but-pending","mergeable":"MERGEABLE",
  "mergeStateStatus":"UNSTABLE",
  "statusCheckRollup":[{"name":"CI","conclusion":null,"status":"IN_PROGRESS"}]}]
JSON
  out=$(ROT_FIXTURE="$fx" "$0" --prs 2>&1) || true
  fail=0
  check() {
    if echo "$out" | grep -qE "$2"; then echo "  ok   $1"
    else echo "  FAIL $1 (want /$2/)"; fail=1; fi
  }
  echo "git_rot selftest:"
  check "conflicts -> REBASE"   '#1 .*REBASE \(conflicts\)'
  check "red CI -> FIX CI"      '#2 .*FIX CI: Server'
  check "green -> MERGE NOW"    '#3 .*\*\* MERGE NOW \*\*'
  check "pending -> wait"       '#4 .*wait \([0-9]+ check'
  # Regression: MERGEABLE + still-running checks must never read MERGE NOW.
  check "mergeable+pending"     '#5 .*wait \([0-9]+ check'
  # Landable rows must sort above the ones needing work — that ordering is the
  # whole point of the report, so assert line positions, not just presence.
  row_at() { echo "$out" | grep -nE "^#$1 " | cut -d: -f1; }
  if [ "$(row_at 3)" -lt "$(row_at 2)" ] && [ "$(row_at 2)" -lt "$(row_at 1)" ]; then
    echo "  ok   merge-first ordering"
  else
    echo "  FAIL merge-first ordering (#3=$(row_at 3) #2=$(row_at 2) #1=$(row_at 1))"
    fail=1
  fi
  # --ci gate: the three outcomes that matter. The unknown-ref case is the one
  # worth pinning — a guard that reports OK on data it could not measure is worse
  # than no guard, because it converts silence into a health claim.
  ci_case() { # <label> <fixture-json> <want-exit>
    printf '%s' "$2" > "$fx.ci"
    ROT_FIXTURE="$fx.ci" "$0" --ci >/dev/null 2>&1; got=$?
    if [ "$got" = "$3" ]; then echo "  ok   $1"
    else echo "  FAIL $1 (exit $got, want $3)"; fail=1; fi
  }
  ci_case "ci: healthy -> 0" \
    '[{"number":9,"headRefName":"main","mergeable":"MERGEABLE","statusCheckRollup":[]}]' 0
  ci_case "ci: unknown ref -> 1" \
    '[{"number":9,"headRefName":"no-such-ref-xyz","mergeable":"MERGEABLE","statusCheckRollup":[]}]' 1
  rm -f "$fx.ci"
  # Stale-upstream verdict: pure function, fed fabricated numbers — no branch
  # created, no ref touched.
  su_check() { # <label> <behind> <want-substring>
    got=$(_stale_upstream_verdict feature-x origin/old-base "$2")
    if echo "$got" | grep -q "$3"; then echo "  ok   $1"
    else echo "  FAIL $1 (got: $got)"; fail=1; fi
  }
  su_check "stale-upstream: 0 behind -> OK"    0  "OK: feature-x tracks"
  su_check "stale-upstream: 40 behind -> WARN" 40 "WARN: feature-x tracks origin/old-base, which is 40 commits behind"
  if [ "$fail" = 0 ]; then echo "PASS"; else echo "FAIL"; echo "$out"; fi
  exit "$fail"
fi

git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repo"; exit 1; }
git fetch --quiet origin 2>/dev/null || echo "warn: fetch failed, numbers may be stale" >&2
git rev-parse --verify --quiet "$BASE" >/dev/null || { echo "no such base: $BASE"; exit 1; }

# Local main lagging its remote is how branches get cut from a stale base.
if git rev-parse --verify --quiet main >/dev/null; then
  behind_main=$(git rev-list --count main.."$BASE" 2>/dev/null || echo 0)
  [ "$behind_main" -gt 0 ] &&
    printf '\e[33m!! local main is %s commits behind %s — branches cut from it start rotted\e[0m\n\n' "$behind_main" "$BASE"
fi

if [ "$want_prs" = 1 ] && { [ -n "${ROT_FIXTURE:-}" ] || command -v gh >/dev/null 2>&1; }; then
  echo "== open PRs =================================================="
  printf '%-6s %-7s %-13s %-7s %-34s %s\n' PR BEHIND MERGE CHECKS BRANCH VERDICT
  { if [ -n "${ROT_FIXTURE:-}" ]; then cat "$ROT_FIXTURE"
    else gh pr list --state open --limit 100 \
      --json number,headRefName,mergeable,mergeStateStatus,statusCheckRollup 2>/dev/null; fi; } |
  python3 -c '
import json,subprocess,sys
stale,base=int(sys.argv[1]),sys.argv[2]
prs=json.load(sys.stdin)
def behind(b):
    r=subprocess.run(["git","rev-list","--count",f"origin/{b}..{base}"],
                     capture_output=True,text=True)
    return int(r.stdout.strip()) if r.returncode==0 and r.stdout.strip() else -1
rows=[]
for p in prs:
    checks=p.get("statusCheckRollup") or []
    def state(c): return c.get("conclusion") or c.get("status") or c.get("state")
    bad=[c for c in checks if state(c) in
         ("FAILURE","ERROR","TIMED_OUT","CANCELLED","STARTUP_FAILURE")]
    # A still-running check is not a passing one. Without this, a MERGEABLE PR
    # whose checks are all pending has no "bad" checks and falls through to
    # MERGE NOW — telling you to merge before CI has said anything.
    pending=[c for c in checks if state(c) in
             ("PENDING","QUEUED","IN_PROGRESS","WAITING","REQUESTED","EXPECTED",None)]
    n=behind(p["headRefName"]); merge=p["mergeable"]
    if   merge=="CONFLICTING":  v="REBASE (conflicts)"
    elif n>=stale:              v=f"REBASE or CLOSE ({n} behind)"
    elif bad:                   v="FIX CI: "+", ".join((c.get("name") or "?") for c in bad)[:44]
    elif pending:               v=f"wait ({len(pending)} check(s) running)"
    elif merge=="MERGEABLE":    v="** MERGE NOW **"
    else:                       v="wait (checks running)"
    rows.append((0 if v.startswith("**") else 1 if v.startswith("FIX") else 2,
                 -n, p, n, merge, len(checks)-len(bad), len(checks), v))
rows.sort(key=lambda r:(r[0],r[1]))
worst=0; worst_pr=None; unknown=0
for _,_,p,n,merge,ok,tot,v in rows:
    num="#"+str(p["number"]); bh=str(n) if n>=0 else "?"
    ch="%d/%d"%(ok,tot); br=p["headRefName"][:34]
    print("%-6s %-7s %-13s %-7s %-34s %s"%(num,bh,merge,ch,br,v))
    if n<0: unknown+=1          # ref missing locally — NOT evidence of health
    elif n>worst: worst,worst_pr=n,p["number"]
print("\n%d open. Merge the ** rows first — every day they wait, they rot further."%len(prs))
# Machine-readable tail for --ci. Printed always: harmless in the human report,
# and keeping one code path means the CI check can never disagree with what a
# person reading the same command sees.
print("ROT_WORST_BEHIND=%d ROT_WORST_PR=%s ROT_OPEN=%d ROT_UNKNOWN=%d"
      %(worst,worst_pr,len(prs),unknown))
' "$STALE" "$BASE"
  echo
fi

if [ "$want_local" = 1 ]; then
  echo "== local branches with no remote (unpushed) =================="
  n=0
  while read -r br; do
    [ -z "$br" ] && continue
    uniq=$(git rev-list --count "$BASE".."$br" 2>/dev/null || echo 0)
    days=$(( ( $(date +%s) - $(git log -1 --format=%ct "$br" 2>/dev/null || date +%s) ) / 86400 ))
    if [ "$uniq" -eq 0 ]; then v="DELETE (no unique commits)"
    elif [ "$days" -gt "$OLD" ]; then v="review then DELETE (cold ${days}d, ${uniq} commits would be lost)"
    else v="push or delete (${uniq} commits, ${days}d)"; fi
    printf '  %-52s %s\n' "$br" "$v"
    n=$((n+1))
  done < <(git for-each-ref --format='%(refname:short) %(upstream)' refs/heads |
           awk '$2==""{print $1}')
  [ "$n" = 0 ] && echo "  none"
  echo

  # A branch checked out via `checkout -B <name> origin/<other-branch>` (the
  # normal shape of a rebase-into-a-new-local-name) auto-tracks that OLD ref as
  # upstream. Tools that scope a diff via merge-base(HEAD, @{upstream}) — fallow
  # audit's new-only gate is the one that bit this repo — then diff against
  # whatever main looked like when that old branch was cut, misattributing every
  # intervening main commit as "introduced by this branch". It also blocks the
  # push that would fix the ref: push is gated by the same stale computation.
  # Caught in production: a 40-commit-stale upstream inflated one PR's diff from
  # 32 files to 105 and flagged pre-existing complexity in a file the branch
  # never touched. Only checks the CURRENT branch — this is what you're about to
  # commit against, not a survey of every local branch.
  echo "== current branch's upstream vs origin/main ===================="
  cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -n "$cur" ] && [ "$cur" != "HEAD" ]; then
    up=$(git rev-parse --abbrev-ref "$cur@{upstream}" 2>/dev/null || true)
    if [ -n "$up" ]; then
      stale_up=$(git rev-list --count "$up..origin/main" 2>/dev/null || echo 0)
      _stale_upstream_verdict "$cur" "$up" "$stale_up"
    else
      echo "  OK: $cur has no upstream configured."
    fi
  fi
  echo

  echo "== worktrees ================================================="
  git worktree list --porcelain | awk '/^worktree /{print substr($0,10)}' |
  while read -r w; do
    [ "$w" = "$(git rev-parse --show-toplevel 2>/dev/null)" ] && continue
    d=$(git -C "$w" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    note=""
    # /tmp and /private/tmp are purged by macOS; a worktree there loses
    # uncommitted work silently and leaves a broken admin entry behind.
    case "$w" in /tmp/*|/private/tmp/*) note=" VOLATILE (/tmp is purged)";; esac
    [ "${d:-0}" -gt 0 ] && note="$note ${d} uncommitted"
    printf '  %-58s%s\n' "${w/#$HOME/~}" "${note:- clean}"
  done
  echo
  echo "prune broken entries: git worktree prune"
fi
