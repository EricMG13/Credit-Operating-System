"""Demo seed — the three demo issuers, inserted once on an empty database.

Also backfills demo-row fields (e.g. FIGI) added after a database was first
seeded, so existing local/dev databases pick them up on restart.
"""

from __future__ import annotations

from sqlalchemy import func, select

from database import AsyncSessionLocal, Issuer

DEMO_ISSUERS = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Acme Holdings Corp.",
        "ticker": "ACM",
        "industry": "Technology",
        "country": "USA",
        "figi": "BBG00CXKLMN4",
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Meridian Telecom Holdings",
        "ticker": "MRDN",
        "industry": "Telecom",
        "country": "UK",
        "figi": "BBG00MRDNTL7",
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Aurora Chemicals SA",
        "ticker": "AURC",
        "industry": "Specialty Chemicals",
        "country": "France",
        "figi": "BBG00RCHMCL2",
    },
]


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as session:
        count = (await session.execute(select(func.count()).select_from(Issuer))).scalar()
        if not count:
            for row in DEMO_ISSUERS:
                session.add(Issuer(**row))
        else:
            # Backfill newer demo fields on already-seeded databases.
            for row in DEMO_ISSUERS:
                issuer = await session.get(Issuer, row["id"])
                if issuer is not None and not issuer.figi:
                    issuer.figi = row["figi"]
        await session.commit()
