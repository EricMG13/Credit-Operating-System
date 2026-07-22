"""Explicit operator CLI for completed-run alert recovery.

Run from ``caos/server`` with::

    python -m reconcile_alert_rules --limit 100 [--cursor OPAQUE_CURSOR]

Each invocation processes one bounded page from authoritative ``Run`` history,
prints the page counts and optional next cursor as JSON, then exits. Pass a
non-null returned cursor to the next invocation. When a clean terminal page
prints ``next_cursor=null``, retain the input cursor for recurring operation;
this intentionally replays the terminal page. Replaying a cursor is idempotent.
The command has no timer or startup integration and refuses to run while the
alert rules feature flag is off.

When a page reports failures (exit 1), rerun with the same input cursor. Advance
to the returned cursor only after the page completes with zero failures.

Exit codes are 0 for a clean page, 1 when any run/observation failed, and 2 for
disabled or invalid operator input.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from typing import Sequence

from alert_triggers import (
    AlertRulesReconciliationDisabled,
    reconcile_completed_runs,
)
from config import get_settings


async def _run(*, limit: int, cursor: str | None) -> int:
    result = await reconcile_completed_runs(limit=limit, cursor=cursor)
    print(json.dumps(asdict(result), sort_keys=True))
    return 1 if result.failures else 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Replay one bounded page of completed runs through idempotent alert rules"
        ),
        epilog=(
            "Pass next_cursor back via --cursor after a clean page; on failures, "
            "retry the same input cursor. If next_cursor=null, retain the input "
            "cursor and replay the terminal page."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="maximum completed runs in this page (1-500; default: 100)",
    )
    parser.add_argument(
        "--cursor",
        help=(
            "opaque versioned input cursor; retain it when a clean terminal page "
            "returns next_cursor=null"
        ),
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if not get_settings().caos_alert_rules_v1_enabled:
        print("alert rules are disabled; reconciliation was not run", file=sys.stderr)
        return 2
    try:
        return asyncio.run(_run(limit=args.limit, cursor=args.cursor))
    except (AlertRulesReconciliationDisabled, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
