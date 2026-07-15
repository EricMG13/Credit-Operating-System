#!/usr/bin/env python
"""Thin operator CLI for restartable lineage-v2 reconciliation."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import AsyncSessionLocal  # noqa: E402
from lineage_reconciliation import reconcile_lineage, verify_exit_code  # noqa: E402


async def _run(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as db:
        result = await reconcile_lineage(
            db, mode=args.mode, limit=args.limit, cursor=args.cursor
        )
    print(json.dumps(result.model_dump(mode="json"), sort_keys=True))
    return verify_exit_code(result) if args.mode == "verify" else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Reconcile transactional lineage v2")
    parser.add_argument("--mode", choices=("dry-run", "apply", "verify"), required=True)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--cursor")
    return asyncio.run(_run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
