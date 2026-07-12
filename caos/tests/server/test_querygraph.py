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


@pytest_asyncio.fixture
async def tied_concentration(seeded_db):
    """Two covered issuers in two distinct, uniquely-tokenised industries, each
    with one headline fact → a strict tie for the top cluster. Torn down in FK
    order (facts before issuers) so the shared process-global DB is left clean."""
    from database import AsyncSessionLocal, Issuer, MetricFact

    ids: list = []
    async with AsyncSessionLocal() as s:
        for ind in ("ZZTieAlphaSector", "ZZTieBetaSector"):
            iss = Issuer(name=f"TieCo {ind}", industry=ind)
            s.add(iss)
            await s.flush()
            s.add(MetricFact(issuer_id=iss.id, metric_key="net_leverage",
                             period="LTM", value=5.0, headline=True))
            ids.append(iss.id)
        await s.commit()
    yield ids
    async with AsyncSessionLocal() as s:
        from sqlalchemy import delete
        await s.execute(delete(MetricFact).where(MetricFact.issuer_id.in_(ids)))
        await s.execute(delete(Issuer).where(Issuer.id.in_(ids)))
        await s.commit()


@pytest.mark.asyncio
async def test_concentration_never_crowns_a_false_largest(tied_concentration):
    """The concentration meta must not name one cluster "largest" on a tie (the
    demo seed is one-name sectors all at equal %). Seed-robust: it validates the
    superlative against the graph's own distribution, not a hardcoded %, so it
    holds if the shared process-global DB carries extra covered issuers."""
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "concentration-map")

    sizes: dict = {}
    for n in g["nodes"]:
        if n["kind"] == "issuer":
            sizes[n.get("group")] = sizes.get(n.get("group"), 0) + 1
    if not sizes:
        pytest.skip("no covered issuers to cluster")

    conc = g["meta"][2]  # the concentration summary line
    top = max(sizes.values())
    n_top = sum(1 for v in sizes.values() if v == top)
    if n_top == len(sizes):
        assert "evenly split" in conc and "(largest)" not in conc
    elif n_top == 1:
        assert conc.endswith("(largest)")
    else:
        assert "tied at" in conc and "(largest)" not in conc


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


# ── gate-lane rollup: _GATE_NODE_CAP ─────────────────────────────────────────
@pytest_asyncio.fixture
async def gate_cap_findings(seeded_db):
    """350 QAFinding rows on one run — more than ``_GATE_NODE_CAP`` (300) — spread
    across all three severities so the gate-lane rollup's cap AND its
    most-severe/newest ordering (``querygraph._gate_lane``) are both exercised,
    not just eyeballed at the source. Uniquely tokenised finding_ids so the seeded
    rows are identifiable even in a shared process-global DB. Yields
    {"by_severity": {sev: [QAFinding.id, ...]}} keyed by the *primary key* (what
    the gate-lane node id and the production ORDER BY are actually built on, not
    the business-facing finding_id label); torn down in FK order (findings before
    the run before the issuer)."""
    from database import AsyncSessionLocal, Issuer, QAFinding, Run

    counts = {"CRITICAL": 40, "MATERIAL": 90, "MINOR": 220}  # 350 total, > cap
    by_severity: dict = {"CRITICAL": [], "MATERIAL": [], "MINOR": []}
    async with AsyncSessionLocal() as s:
        iss = Issuer(name="ZZGateCapCo", industry="TestSector")
        s.add(iss)
        await s.flush()
        run = Run(issuer_id=iss.id, status="complete")
        s.add(run)
        await s.flush()
        rows_by_sev: dict = {"CRITICAL": [], "MATERIAL": [], "MINOR": []}
        for sev, n in counts.items():
            for i in range(n):
                fid = f"ZZCAP-{sev[:3]}-{i:04d}"
                f = QAFinding(run_id=run.id, module_id="CP-5", finding_id=fid,
                              severity=sev, lane=(i % 8) + 1,
                              description=f"synthetic {sev} finding {i} for gate-cap regression")
                s.add(f)
                rows_by_sev[sev].append(f)
        await s.flush()  # populate every row's .id (Python-side uuid4 default) in one pass
        for sev, rows in rows_by_sev.items():
            by_severity[sev] = [f.id for f in rows]
        await s.commit()
        iss_id, run_id = iss.id, run.id
    yield {"issuer_id": iss_id, "run_id": run_id, "by_severity": by_severity}
    async with AsyncSessionLocal() as s:
        from sqlalchemy import delete
        await s.execute(delete(QAFinding).where(QAFinding.run_id == run_id))
        await s.execute(delete(Run).where(Run.id == run_id))
        await s.execute(delete(Issuer).where(Issuer.id == iss_id))
        await s.commit()


@pytest.mark.asyncio
async def test_gate_lane_caps_nodes_at_gate_node_cap_and_keeps_most_severe_newest(gate_cap_findings):
    """``_GATE_NODE_CAP`` (querygraph.py, currently 300) must actually bound the
    gate-lane rollup graph, and the rows kept must be exactly the query's own
    most-severe/newest slice (``ORDER BY sev_rank, QAFinding.id.desc() LIMIT
    _GATE_NODE_CAP``) — not an arbitrary 300 findings. Regression guard: before
    this test nothing asserted the LIMIT held or that the excluded rows were the
    low-priority ones, so a change that widened/dropped the cap or broke the
    severity-then-id ordering would have shipped silently.
    """
    from sqlalchemy import case, func, select

    from database import AsyncSessionLocal, QAFinding

    cap = querygraph._GATE_NODE_CAP
    assert cap == 300  # pins the constant so a silent cap change is caught here too

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "gate-lane")

        # Independently recompute the expected top-`cap` slice with the *exact*
        # ordering the production query uses, straight against the DB — an honest
        # oracle (robust to whatever else lives in the shared QAFinding table)
        # rather than a hardcoded id list.
        sev_rank = case(
            (QAFinding.severity == "CRITICAL", 0),
            (QAFinding.severity == "MATERIAL", 1),
            (QAFinding.severity == "MINOR", 2),
            else_=3,
        )
        total_in_db = (await s.execute(select(func.count()).select_from(QAFinding))).scalar()
        expected_ids = set((await s.execute(
            select(QAFinding.id).order_by(sev_rank, QAFinding.id.desc()).limit(cap)
        )).scalars().all())

    assert total_in_db > cap, "fixture must seed enough rows to actually trigger the cap"

    finding_nodes = [n for n in g["nodes"] if n["id"].startswith("f:")]
    # 1) The cap holds exactly — not merely "<= cap", not silently uncapped.
    assert len(finding_nodes) == cap == 300

    returned_ids = {n["id"][2:] for n in finding_nodes}  # strip the "f:" prefix
    assert returned_ids == expected_ids, (
        "gate-lane must render exactly the query's most-severe/newest slice, "
        "not an arbitrary set of 300 rows"
    )

    # 2) Make the ordering claim legible without re-deriving the oracle: every
    # CRITICAL finding we seeded must have made the cut (sev_rank 0 always beats
    # MATERIAL/MINOR), while some of our MINOR findings — the lowest-priority
    # severity seeded — must have been the ones pushed out by the cap.
    by_sev = gate_cap_findings["by_severity"]
    assert set(by_sev["CRITICAL"]) <= returned_ids, "CRITICAL findings must never be capped out"
    excluded_minor = set(by_sev["MINOR"]) - returned_ids
    assert excluded_minor, "the cap must actually exclude some low-severity findings"

    # 3) meta must be honest that the graph is a truncated slice, not the full ledger.
    assert any(f"({cap} shown)" in m for m in g["meta"])
