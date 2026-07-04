"""Two cross-issuer 'register' Query walks wired onto already-persisted data with
no migration: sponsor-graph (over ``Issuer.sponsor``, mig 0018) and
covenant-register (over the latest CP-4C ``module_output`` per issuer).

Regression guard that (a) sponsor-graph is no longer the dead ``CP-2D`` stub and
(b) covenant-register clusters cov-lite vs maintenance and flags thin headroom.
The suite shares one process-global DB (see conftest); every fixture tears its
rows down in FK order so a leaked row can't repaint another test's graph.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from engine import querygraph


@pytest_asyncio.fixture
async def sponsor_issuers(seeded_db):
    """Three sponsor-owned issuers — two sharing one sponsor, one solo. Yields ids."""
    from database import AsyncSessionLocal, Issuer

    ids: list = []
    async with AsyncSessionLocal() as s:
        for name, sponsor in (
            ("ZZSponCo Alpha", "ZZ Capital Partners"),
            ("ZZSponCo Beta", "ZZ Capital Partners"),
            ("ZZSponCo Gamma", "ZZ Other Equity"),
        ):
            iss = Issuer(name=name, sponsor=sponsor)
            s.add(iss)
            await s.flush()
            ids.append(iss.id)
        await s.commit()
    yield ids
    async with AsyncSessionLocal() as s:
        from sqlalchemy import delete
        await s.execute(delete(Issuer).where(Issuer.id.in_(ids)))
        await s.commit()


@pytest.mark.asyncio
async def test_sponsor_graph_links_issuers_to_their_sponsor(sponsor_issuers):
    from database import AsyncSessionLocal

    a, b, c = sponsor_issuers
    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "sponsor-graph")

    assert g["capability_id"] == "sponsor-graph"
    assert g["nodes"], "sponsor graph must not be the empty CP-2D stub anymore"

    hubs = {n["id"]: n for n in g["nodes"] if n["kind"] == "sector"}
    assert "sp:ZZ Capital Partners" in hubs and "sp:ZZ Other Equity" in hubs
    # Both A and B hang off the shared sponsor hub; C off its own.
    shared = {e["target"] for e in g["edges"] if e["source"] == "sp:ZZ Capital Partners"}
    assert {a, b} <= shared
    assert any(e["source"] == "sp:ZZ Other Equity" and e["target"] == c for e in g["edges"])
    # 2 names (not >2) → no concentration flag.
    assert hubs["sp:ZZ Capital Partners"].get("flag") is None


@pytest.mark.asyncio
async def test_sponsor_availability_true_when_sponsor_owned(sponsor_issuers):
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        avail = await querygraph.availability(s)
        caps = await querygraph.capabilities(s)

    assert avail["sponsor_names"] is True
    sp = next(c for grp in caps["groups"] for c in grp["capabilities"] if c["id"] == "sponsor-graph")
    assert sp["enabled"] is True and sp["reason"] is None


@pytest_asyncio.fixture
async def covenant_runs(seeded_db):
    """One maintenance-covenant issuer (thin 0.5x headroom) + one cov-lite issuer,
    each with a completed CP-4C module output. Yields {"maint": id, "lite": id}."""
    from database import AsyncSessionLocal, Issuer, ModuleOutput, Run

    issuer_ids: list = []
    run_ids: list = []
    async with AsyncSessionLocal() as s:
        maint = Issuer(name="ZZCovCo Maint")
        s.add(maint)
        await s.flush()
        rm = Run(issuer_id=maint.id, status="complete")
        s.add(rm)
        await s.flush()
        s.add(ModuleOutput(
            run_id=rm.id, module_id="CP-4C", module_name="CovenantCapacityCalculator",
            runtime_output={"leverage_covenant_x": 6.0, "current_net_leverage": 5.5,
                            "covenant_basis": "first_lien"},
        ))

        lite = Issuer(name="ZZCovCo Lite")
        s.add(lite)
        await s.flush()
        rl = Run(issuer_id=lite.id, status="complete")
        s.add(rl)
        await s.flush()
        s.add(ModuleOutput(
            run_id=rl.id, module_id="CP-4C", module_name="CovenantCapacityCalculator",
            runtime_output={"calculations": [], "note": "cov-lite — no maintenance covenant"},
        ))
        await s.commit()
        issuer_ids = [maint.id, lite.id]
        run_ids = [rm.id, rl.id]
        out = {"maint": maint.id, "lite": lite.id}
    yield out
    async with AsyncSessionLocal() as s:
        from sqlalchemy import delete
        await s.execute(delete(ModuleOutput).where(ModuleOutput.run_id.in_(run_ids)))
        await s.execute(delete(Run).where(Run.id.in_(run_ids)))
        await s.execute(delete(Issuer).where(Issuer.id.in_(issuer_ids)))
        await s.commit()


@pytest.mark.asyncio
async def test_covenant_register_clusters_and_flags_thin_headroom(covenant_runs):
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        g = await querygraph.build_graph(s, "covenant-register")

    assert g["capability_id"] == "covenant-register"
    by_id = {n["id"]: n for n in g["nodes"]}
    maint = by_id[covenant_runs["maint"]]
    lite = by_id[covenant_runs["lite"]]

    assert maint["group"] == "Maintenance covenant"
    assert maint.get("flag") is True, "6.0x cov vs 5.5x leverage = 0.5x headroom (<1.0x) → thin"
    assert "6" in maint["sub"] and "headroom" in maint["sub"]

    assert lite["group"] == "Cov-lite" and lite["sub"] == "cov-lite"
    # Cov-lite carries no false thin-headroom flag.
    assert lite.get("flag") is None
    # Each issuer edges to its cluster hub.
    assert any(e["target"] == covenant_runs["maint"] for e in g["edges"])


@pytest.mark.asyncio
async def test_covenant_availability_true_when_cp4c_exists(covenant_runs):
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        avail = await querygraph.availability(s)
        caps = await querygraph.capabilities(s)

    assert avail["covenant"] is True
    cov = next(c for grp in caps["groups"] for c in grp["capabilities"] if c["id"] == "covenant-register")
    assert cov["enabled"] is True and cov["reason"] is None
