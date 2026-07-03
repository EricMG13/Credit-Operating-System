"""Characterization harness for the per-(issuer, metric) fact-collapse tie-break.

Three query builders load *every* run's headline facts and collapse to one fact
per (issuer, metric) in Python: ``nlquery.execute`` (via ``_better_fact``) and
``engine.querygraph._profile_values`` / ``_trend`` (via ``_best_fact``). A future
PR wants to push that collapse into a bounded SQL window so the scan stops growing
with run history. That rewrite is a *wrong-number* risk — the tie-break leans on
``created_at`` ordering whose NULLS position differs SQLite(dev)↔Postgres(prod),
and the current Python pick is iteration-order dependent when ``created_at`` is null.

These tests are DB-free on purpose (the nlquery suite runs over a process-global
seeded store with no isolated fact seeding — see caos-test-shared-db-gotcha). They
pin the EXACT current semantics with constructed fact stand-ins so the SQL rewrite
has a reference to diff against, and so the run==fixture divergence between the two
collapses is a conscious choice rather than a surprise. If a test here changes,
the window bound's expected output changes with it.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from types import SimpleNamespace

from nlquery import _better_fact, _derived
from engine.querygraph import _best_fact


T0 = datetime(2026, 1, 1)   # older
T1 = datetime(2026, 6, 1)   # newer


def _f(provenance: str, created_at):
    """A minimal MetricFact stand-in — both collapses read only these two fields."""
    return SimpleNamespace(provenance=provenance, created_at=created_at)


# ── nlquery._better_fact (the execute() collapse) ────────────────────────────
def test_better_fact_prev_none_is_always_better():
    assert _better_fact(None, _f("seed", T0)) is True


def test_derived_tiers_run_and_fixture_above_the_rest():
    assert _derived("run") == 1 and _derived("fixture") == 1
    assert _derived("seed") == 0 and _derived("derived") == 0


def test_better_fact_run_and_fixture_outrank_seed_regardless_of_recency():
    assert _better_fact(_f("seed", T1), _f("run", T0)) is True      # tier beats newer seed
    assert _better_fact(_f("seed", T1), _f("fixture", T0)) is True  # fixture is tier-1 too


def test_better_fact_same_tier_prefers_newer_created_at():
    assert _better_fact(_f("run", T0), _f("run", T1)) is True
    assert _better_fact(_f("run", T1), _f("run", T0)) is False
    # run and fixture share a tier, so created_at — not provenance — decides between them
    assert _better_fact(_f("fixture", T0), _f("run", T1)) is True
    assert _better_fact(_f("run", T1), _f("fixture", T0)) is False


def test_better_fact_lower_tier_never_wins_even_when_newer():
    assert _better_fact(_f("run", T0), _f("seed", T1)) is False


def test_better_fact_null_created_at_keeps_prev_first_seen():
    # LANDMINE: either side null → stays with prev (first row iterated). A SQL window
    # ORDER BY created_at DESC must add a deterministic id tiebreak AND fix NULLS
    # position, or dev(SQLite)/prod(Postgres) pick different facts.
    assert _better_fact(_f("run", None), _f("run", T1)) is False   # new has ts, prev null → keep prev
    assert _better_fact(_f("run", T1), _f("run", None)) is False   # new null → keep prev
    assert _better_fact(_f("run", None), _f("run", None)) is False


# ── engine.querygraph._best_fact (the _profile_values / _trend collapse) ──────
def test_best_fact_run_and_fixture_tier_beats_seed_and_derived():
    # Unified with _better_fact: run AND fixture are the top tier now (was run-only).
    assert _best_fact(_f("seed", T1), _f("run", T0)) is True
    assert _best_fact(_f("seed", T1), _f("fixture", T0)) is True
    assert _best_fact(_f("derived", T1), _f("run", T0)) is True
    # run vs fixture share the tier → created_at decides, not provenance
    assert _best_fact(_f("fixture", T0), _f("run", T1)) is True
    assert _best_fact(_f("run", T1), _f("fixture", T0)) is False


def test_best_fact_same_provenance_prefers_newer_created_at():
    assert _best_fact(_f("run", T0), _f("run", T1)) is True
    assert _best_fact(_f("seed", T0), _f("seed", T1)) is True
    assert _best_fact(_f("run", T1), _f("run", T0)) is False


def test_best_fact_null_created_at_keeps_prev():
    # Unified body returns a real bool, keeping prev on a null created_at — the
    # deterministic id tiebreak lives in the SQL window, not this pure reference.
    assert _best_fact(_f("run", None), _f("run", T1)) is False   # prev null → keep prev
    assert _best_fact(_f("run", T1), _f("run", None)) is False   # new null → keep prev


# ── The two collapses are now unified — pinned identical so they can't drift ──
def test_both_collapses_agree_after_unification():
    """querygraph._best_fact was unified onto nlquery._better_fact's rule (run/fixture
    tier → created_at → keep-prev-on-null). They must give the same answer on every
    input, so a later edit to one can't silently diverge from the other."""
    cases = [
        (None, _f("seed", T0)),
        (_f("seed", T0), _f("fixture", T1)),   # the old divergence — now both say True
        (_f("seed", T1), _f("run", T0)),
        (_f("run", T0), _f("run", T1)),
        (_f("run", T1), _f("fixture", T0)),
        (_f("run", None), _f("run", T1)),
        (_f("derived", T0), _f("seed", T1)),
        (_f("fixture", T1), _f("seed", T0)),
    ]
    for prev, fact in cases:
        assert bool(_best_fact(prev, fact)) == bool(_better_fact(prev, fact)), (prev, fact)
    # the formerly-divergent case now agrees on True (fixture beats seed)
    assert _best_fact(_f("seed", T0), _f("fixture", T1)) is True


# ── Equivalence: the SQL window in nlquery.execute == the _better_fact fold ────
async def _run_equivalence():
    from sqlalchemy import case, func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from database import Base, Issuer, MetricFact
    from nlquery import _DERIVED_PROVENANCE

    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as c:
        await c.run_sync(Base.metadata.create_all)
    Sess = async_sessionmaker(eng, expire_on_commit=False)

    def mf(iid, mk, val, prov, ts):
        return MetricFact(issuer_id=iid, metric_key=mk, value=val, headline=True,
                          provenance=prov, period="LTM", created_at=ts)

    async with Sess() as s:
        s.add_all([Issuer(id="i1", name="Acme"), Issuer(id="i2", name="Beta")])
        s.add_all([
            mf("i1", "net_leverage", 5.0, "seed", T0),   # older seed
            mf("i1", "net_leverage", 6.0, "run", T1),    # newer run → wins (tier + recency)
            mf("i1", "revenue", 100.0, "run", T0),
            mf("i1", "revenue", 110.0, "run", T1),        # newest run → wins
            mf("i2", "net_leverage", 3.0, "seed", T1),    # newer seed …
            mf("i2", "net_leverage", 4.0, "fixture", T0),  # … but fixture tier wins
        ])
        await s.commit()
        needed = ["net_leverage", "revenue"]

        # (a) Python fold over the FULL scan — the pre-bound reference behavior.
        allrows = (await s.execute(
            select(MetricFact, Issuer).join(Issuer, MetricFact.issuer_id == Issuer.id)
            .where(MetricFact.headline.is_(True), MetricFact.metric_key.in_(needed))
        )).all()
        py = {}
        for fact, iss in allrows:
            k = (iss.id, fact.metric_key)
            if _better_fact(py.get(k), fact):
                py[k] = fact
        py_vals = {k: v.value for k, v in py.items()}

        # (b) The bounded window from nlquery.execute.
        tier = case((MetricFact.provenance.in_(_DERIVED_PROVENANCE), 1), else_=0)
        w = (select(MetricFact.id.label("fid"),
                    func.row_number().over(
                        partition_by=(MetricFact.issuer_id, MetricFact.metric_key),
                        order_by=(tier.desc(), MetricFact.created_at.desc().nullslast(),
                                  MetricFact.id.desc())).label("rn"))
             .where(MetricFact.headline.is_(True),
                    MetricFact.metric_key.in_(needed))).subquery()
        winrows = (await s.execute(
            select(MetricFact, Issuer).join(Issuer, MetricFact.issuer_id == Issuer.id)
            .where(MetricFact.id.in_(select(w.c.fid).where(w.c.rn == 1)))
        )).all()
        win_vals = {(iss.id, f.metric_key): f.value for f, iss in winrows}

    await eng.dispose()
    return py_vals, win_vals


def test_execute_window_bound_matches_the_python_fold():
    """The bounded SQL window in nlquery.execute selects the same fact per
    (issuer, metric) as the _better_fact fold over the full scan — proven on an
    isolated in-memory DB (the nlquery suite's shared store can't seed controlled
    multi-run facts). asyncio.run wrapper avoids a pytest-asyncio mode dependency."""
    py_vals, win_vals = asyncio.run(_run_equivalence())
    assert win_vals == py_vals, (win_vals, py_vals)
    assert win_vals == {("i1", "net_leverage"): 6.0, ("i1", "revenue"): 110.0,
                        ("i2", "net_leverage"): 4.0}, win_vals
