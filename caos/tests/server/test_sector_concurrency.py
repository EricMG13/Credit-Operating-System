"""Concurrency contracts for versioned CP-SR creation and ratification."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, select


@pytest.mark.asyncio
async def test_sector_review_context_filter_is_applied_before_history_limit(seeded_db):
    from database import AnalysisContextRecord, AsyncSessionLocal, SectorReviewRun
    from identity import CallerIdentity
    from routes.sector import _build_review_payload, list_sector_reviews

    caller = CallerIdentity(
        id="sector-history-limit-analyst",
        email="sector-history-limit@example.test",
        full_name="Sector History Limit",
    )
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        target_context = AnalysisContextRecord(
            analyst_id=caller.id,
            name="Target sector history",
            sector_id="industrials",
        )
        distractor_context = AnalysisContextRecord(
            analyst_id=caller.id,
            name="Distractor sector history",
            sector_id="software",
        )
        session.add_all([target_context, distractor_context])
        await session.flush()

        target_review = _build_review_payload(
            review_id="history-target-review",
            context_id=target_context.id,
            sector_id="industrials",
            timeframe="weekly",
            version=1,
            now=now - timedelta(days=200),
            signals=[],
        )
        rows = [SectorReviewRun(
            id=target_review.id,
            sector="industrials",
            version=1,
            timeframe="weekly",
            as_of=now - timedelta(days=200),
            posture=target_review.posture,
            confidence={"overall": target_review.authority.confidence},
            payload=target_review.model_dump(mode="json"),
            input_signal_ids=[],
            analyst_id=caller.id,
            refresh_trigger="scheduled",
            status="partial",
            provenance="reference",
            created_at=now - timedelta(days=200),
        )]
        for version in range(1, 102):
            created_at = now - timedelta(minutes=version)
            review = _build_review_payload(
                review_id=f"history-distractor-{version}",
                context_id=distractor_context.id,
                sector_id="software",
                timeframe="weekly",
                version=version,
                now=created_at,
                signals=[],
            )
            rows.append(SectorReviewRun(
                id=review.id,
                sector="software",
                version=version,
                timeframe="weekly",
                as_of=created_at,
                posture=review.posture,
                confidence={"overall": review.authority.confidence},
                payload=review.model_dump(mode="json"),
                input_signal_ids=[],
                analyst_id=caller.id,
                refresh_trigger="scheduled",
                status="partial",
                provenance="reference",
                created_at=created_at,
            ))
        session.add_all(rows)
        await session.commit()

        reviews = await list_sector_reviews(
            context_id=target_context.id,
            db=session,
            caller=caller,
        )
        assert [review.id for review in reviews] == [target_review.id]

        await session.execute(delete(SectorReviewRun).where(
            SectorReviewRun.analyst_id == caller.id
        ))
        await session.execute(delete(AnalysisContextRecord).where(
            AnalysisContextRecord.analyst_id == caller.id
        ))
        await session.commit()


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
