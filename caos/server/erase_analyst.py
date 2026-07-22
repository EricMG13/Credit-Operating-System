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

from database import (
    Analyst,
    AsyncSessionLocal,
    case_insensitive_email_match,
    erase_analyst_data,
)
from identity import normalize_email_identity


class AmbiguousAnalystEmailError(RuntimeError):
    """A case-insensitive operator lookup resolved to more than one profile."""


async def erase_by_email(email: str) -> dict[str, int]:
    lookup_email = normalize_email_identity(email)
    async with AsyncSessionLocal() as session:
        matching_analysts = list(
            (
                await session.execute(
                    select(Analyst)
                    .where(
                        case_insensitive_email_match(
                            session,
                            Analyst.email,
                            lookup_email,
                        )
                    )
                    .order_by(Analyst.id)
                    .limit(2)
                )
            )
            .scalars()
            .all()
        )
        if len(matching_analysts) > 1:
            raise AmbiguousAnalystEmailError(
                "Ambiguous analyst email identity; resolve duplicate profiles before erasure."
            )
        analyst = matching_analysts[0] if matching_analysts else None
        # Runs/research are stamped with the analyst id (a uuid for profile users);
        # fall back to the email itself for proxy-stamped rows if no profile exists.
        analyst_id = analyst.id if analyst else lookup_email
        canonical_email = analyst.email if analyst else lookup_email
        return await erase_analyst_data(
            session,
            analyst_id=analyst_id,
            email=canonical_email,
        )


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
