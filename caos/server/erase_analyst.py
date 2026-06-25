"""Operator CLI: GDPR-erase a departed analyst by email.

A departed analyst can no longer sign in, so they can't use the self-service
DELETE /api/auth/profile. This runs the same erasure operator-initiated:

    python -m erase_analyst <email>            # inside the app container
    docker compose exec app python -m erase_analyst <email>

Run inside the container, where shell access is already a privileged context, so
the CLI needs no auth/RBAC of its own. It deletes the analyst's private Deep
Research jobs and profile (name + email PII) and anonymizes their attribution on
shared runs/documents (firm work product is kept, just de-linked) — see
database.erase_analyst_data. Prints the row counts touched.
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from database import Analyst, AsyncSessionLocal, erase_analyst_data


async def erase_by_email(email: str) -> dict[str, int]:
    async with AsyncSessionLocal() as session:
        analyst = (
            await session.execute(select(Analyst).where(Analyst.email == email))
        ).scalar_one_or_none()
        # Runs/research are stamped with the analyst id (a uuid for profile users);
        # fall back to the email itself for proxy-stamped rows if no profile exists.
        analyst_id = analyst.id if analyst else email
        return await erase_analyst_data(session, analyst_id=analyst_id, email=email)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1 or not argv[0].strip():
        print("usage: python -m erase_analyst <email>", file=sys.stderr)
        return 2
    summary = asyncio.run(erase_by_email(argv[0].strip()))
    print(f"erased {argv[0].strip()}: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
