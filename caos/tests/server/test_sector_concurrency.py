"""Concurrency contracts for versioned CP-SR creation and ratification."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import delete, select


@pytest.mark.asyncio
async def test_sector_versions_and_disjoint_ratifications_are_serialized(seeded_db):
    from database import (
        AnalysisContextRecord,
        AsyncSessionLocal,
        SectorReviewRatification,
        SectorReviewRun,
    )
    from identity import CallerIdentity
    from routes.sector import (
        SectionRatification,
        SectorRatificationRequest,
        SectorReviewCreate,
        create_sector_review,
        ratify_sector_review,
    )

    caller = CallerIdentity(
        id="sector-concurrency-analyst",
        email="sector-concurrency@example.test",
        full_name="Sector Concurrency",
    )
    async with AsyncSessionLocal() as session:
        context = AnalysisContextRecord(
            analyst_id=caller.id,
            name="Sector concurrency",
            sector_id="industrials",
        )
        session.add(context)
        await session.commit()
        context_id = context.id

    async def create_review():
        async with AsyncSessionLocal() as session:
            return await create_sector_review(
                SectorReviewCreate(context_id=context_id),
                db=session,
                caller=caller,
            )

    first, second = await asyncio.gather(create_review(), create_review())
    assert sorted((first.version, second.version)) == [1, 2]

    async with AsyncSessionLocal() as session:
        backdated = await create_sector_review(
            SectorReviewCreate(context_id=context_id, as_of="2019-01-01T00:00:00Z"),
            db=session,
            caller=caller,
        )
    assert backdated.version == 3

    review = second if second.version == 2 else first
    section_ids = [section.id for section in review.sections[:2]]

    async def ratify(section_id: str):
        async with AsyncSessionLocal() as session:
            return await ratify_sector_review(
                review.id,
                SectorRatificationRequest(sections=[SectionRatification(
                    section_id=section_id,
                    decision="ratified",
                )]),
                db=session,
                caller=caller,
            )

    await asyncio.gather(*(ratify(section_id) for section_id in section_ids))

    review_ids = [first.id, second.id, backdated.id]
    async with AsyncSessionLocal() as session:
        row = await session.get(SectorReviewRun, review.id)
        normalized = (await session.execute(select(SectorReviewRatification).where(
            SectorReviewRatification.review_run_id == review.id,
            SectorReviewRatification.analyst_id == caller.id,
        ))).scalars().all()
        assert row.payload["ratifications"] == {
            section_id: "ratified" for section_id in section_ids
        }
        assert {item.section_id for item in normalized} == set(section_ids)

        await session.execute(delete(SectorReviewRatification).where(
            SectorReviewRatification.review_run_id.in_(review_ids)
        ))
        await session.execute(delete(SectorReviewRun).where(SectorReviewRun.id.in_(review_ids)))
        await session.execute(delete(AnalysisContextRecord).where(
            AnalysisContextRecord.id == context_id
        ))
        await session.commit()
