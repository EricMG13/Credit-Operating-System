"""The Query 'shared-theme' walk — a generic corpus co-mention overlay driven by
an analyst-supplied ``theme``, distinct from the energy-anchored 'contagion'
walk. Regression guard for the fix that stopped shared-theme hardcoding energy
(it used to route to ``_contagion`` with a fixed 'energy' theme, so the walk
"Which names share a risk theme?" always returned energy).

The suite shares one process-global DB (see conftest), so the fixture seeds a
uniquely tokenised issuer and tears it down in FK order — a leaked issuer/doc
would repaint other tests' graphs.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from engine import querygraph

# A token no other seed carries → the shared-theme member set is exactly ours.
_TOKEN = "zzqsharedthemetoken"


@pytest_asyncio.fixture
async def theme_issuer(seeded_db):
    """One issuer whose only corpus chunk co-mentions ``_TOKEN``. Yields its id."""
    from database import AsyncSessionLocal, Document, DocumentChunk, Issuer

    async with AsyncSessionLocal() as s:
        iss = Issuer(name="ThemeCo Holdings", industry="TestSector")
        s.add(iss)
        await s.flush()
        doc = Document(issuer_id=iss.id, doc_type="filing",
                       file_name="themeco-10k.txt", storage_key="test/themeco")
        s.add(doc)
        await s.flush()
        s.add(DocumentChunk(
            document_id=doc.id, seq=0,
            text=f"Management flags rising {_TOKEN} exposure across the supply chain."))
        await s.commit()
        iid = iss.id
    yield iid
    async with AsyncSessionLocal() as s:
        from sqlalchemy import delete, select
        doc_ids = (await s.execute(
            select(Document.id).where(Document.issuer_id == iid))).scalars().all()
        if doc_ids:
            await s.execute(delete(DocumentChunk).where(DocumentChunk.document_id.in_(doc_ids)))
            await s.execute(delete(Document).where(Document.id.in_(doc_ids)))
        await s.execute(delete(Issuer).where(Issuer.id == iid))
        await s.commit()


@pytest.mark.asyncio
async def test_shared_theme_is_theme_driven_and_corpus_anchored(theme_issuer):
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "shared-theme", theme=_TOKEN)

    assert g["capability_id"] == "shared-theme"
    assert g["title"].startswith("Shared theme") and _TOKEN in g["title"]

    driver = [n for n in g["nodes"] if n["kind"] == "driver"]
    assert len(driver) == 1 and driver[0]["label"] == _TOKEN

    members = [n for n in g["nodes"] if n["kind"] == "issuer" and n.get("exposed")]
    mine = {n["id"]: n for n in members}.get(theme_issuer)
    assert mine is not None, "the co-mentioning issuer must be an exposed member"
    assert mine["sub"] == "corpus co-mention"
    assert any(e["source"] == "theme" and e["target"] == theme_issuer for e in g["edges"])

    # Honest provenance: BM25 corpus co-mention, not a modeled correlation.
    assert any("co-mention" in c for c in g["caveats"])
    assert not any("energy_cost_pct" in c for c in g["caveats"]), "must not claim the energy fact"


@pytest.mark.asyncio
async def test_shared_theme_blank_theme_prompts_for_one(seeded_db):
    # A whitespace-only theme is truthy upstream but strips to empty at the
    # builder boundary → a "supply a theme" prompt, never a silent energy default.
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "shared-theme", theme="   ")
    assert g["nodes"] == [] and g["edges"] == []
    assert "Supply a risk theme" in g["meta"][0]


@pytest.mark.asyncio
async def test_shared_theme_with_no_corpus_hit_is_empty(seeded_db):
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "shared-theme", theme="nonexistentxyzzytheme")
    assert g["nodes"] == []
    assert "No issuer" in g["meta"][0]


@pytest.mark.asyncio
async def test_contagion_walk_stays_itself_and_ignores_theme(seeded_db):
    """The energy contagion walk is a different builder: it never becomes the
    shared-theme overlay and never adopts a passed theme (only shared-theme reads
    ``theme``). Seed-independent so it holds with or without energy facts."""
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "contagion", theme="tariff exposure")
    assert g["capability_id"] == "contagion"
    assert not g["title"].startswith("Shared theme")
    assert "tariff" not in g["title"].lower()
