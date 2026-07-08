"""The composition test for the module-dispatch seam (engine.bindings, spec P1·C1).

Routing-only and DB-free: a stub synthesizer, a sentinel session that is never
hit, hand-made upstream ModulePayloads, and monkeypatched adapters that record
their arguments. Asserts that ``resolve_binding`` routes each module to the right
adapter with the right upstream slice, and that the load-bearing guard branches
fire — the null-issuer fall-through (CP-0 / CP-1C), the CP-2 live-vs-fixture
branch, the shared CP-6A/CP-6E debate binder, CP-1B's sync (un-awaited) return,
and an unmapped id falling through to the default. This is the wiring test
``test_runner_layers.py`` cannot be; the adapter *bodies* keep their existing
tests (test_analytics.py, test_nan_guards.py, test_overlays.py, …).
"""
from __future__ import annotations

import pytest

from engine import bindings, cp1_sources
from engine.schemas import ModulePayload

# ── DB-free test doubles ──────────────────────────────────────────────────────
SESSION = object()   # sentinel: the routing test never touches the session
ISSUER = object()    # a non-None issuer sentinel
RETRIEVE = object()  # the retrieve callable, passed through and recorded
_UNSET = object()


def _payload(module_id: str, tag: str) -> ModulePayload:
    return ModulePayload(
        module_id=module_id, module_name=f"{module_id}-{tag}",
        owned_object="x", runtime_output={"tag": tag},
    )


# Upstream carries every slice the binders subscript/.get, each a distinct object
# so an equality assertion also proves the *right* slice was handed over.
UPSTREAM = {
    "CP-1": _payload("CP-1", "up"),
    "CP-1C": _payload("CP-1C", "up"),
    "CP-3": _payload("CP-3", "up"),
    "CP-2B": _payload("CP-2B", "up"),
}


class StubSynth:
    """A Synthesizer double: ``name`` drives the CP-2 branch; ``synthesize``
    records the module it was asked for (the default/live path)."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.calls: list[str] = []

    async def synthesize(self, module_id, *, issuer_name, upstream, retrieve):
        self.calls.append(module_id)
        return _payload(module_id, "synth")


def _async_recorder(rec: dict, key: str, returns=_UNSET):
    async def _rec(*args, **kwargs):
        rec[key] = (args, kwargs)
        return _payload(key, "rec") if returns is _UNSET else returns
    return _rec


def _sync_recorder(rec: dict, key: str):
    def _rec(*args, **kwargs):
        rec[key] = (args, kwargs)
        return _payload(key, "rec")
    return _rec


# Every async adapter the binders call, mapped to the key it records under.
_ASYNC_ADAPTERS = {
    "synthesize_source_readiness": "readiness",
    "synthesize_cost_structure": "coststructure",
    "synthesize_fact_pack": "factpack",
    "synthesize_peer_benchmark": "peers",
    "synthesize_covenants": "covenants",
    "synthesize_downside": "downside",
    "synthesize_catalysts": "catalysts",
    "synthesize_sponsor_review": "sponsor",
    "synthesize_liquidity": "liquidity",
    "synthesize_macro": "macro",
    "synthesize_relative_value": "relval",
    "synthesize_recovery_preference": "capstructure",
    "synthesize_portfolio_fit": "portfoliofit",
    "synthesize_refinancing": "refinancing",
    "synthesize_legal_review": "legal",
    "synthesize_debate": "debate",
}


@pytest.fixture
def recorded(monkeypatch):
    """Patch every adapter (plus cp1_sources.synthesize_cp1_reported and
    reconcile_adjusted_ebitda) with an argument recorder; return the recording dict."""
    rec: dict = {}
    for attr, key in _ASYNC_ADAPTERS.items():
        monkeypatch.setattr(bindings, attr, _async_recorder(rec, key))
    # CP-1B's synthesize_earnings_delta is sync — the binder returns it un-awaited.
    monkeypatch.setattr(bindings, "synthesize_earnings_delta", _sync_recorder(rec, "earnings"))
    # reconcile returns None so _bind_cp1 skips the mutation; we assert only that it fired.
    monkeypatch.setattr(bindings, "reconcile_adjusted_ebitda", _async_recorder(rec, "reconcile", returns=None))
    monkeypatch.setattr(cp1_sources, "synthesize_cp1_reported", _async_recorder(rec, "cp1_sources"))
    return rec


def _ctx(module_id, synth, *, issuer=ISSUER, upstream=None, portfolio_id="PF-1"):
    return bindings.RunContext(
        module_id=module_id, session=SESSION, issuer=issuer, issuer_name="Acme",
        synthesizer=synth, upstream=UPSTREAM if upstream is None else upstream,
        retrieve=RETRIEVE, portfolio_id=portfolio_id,
    )


def _args(rec, key):
    return rec[key][0]


# ── table shape ───────────────────────────────────────────────────────────────

def test_binders_table_shape():
    assert set(bindings.BINDERS) == {
        "CP-0", "CP-1", "CP-2", "CP-1A", "CP-1B", "CP-1C", "CP-4C", "CP-2B",
        "CP-2C", "CP-2D", "CP-2E", "CP-2F", "CP-3", "CP-3B", "CP-3C", "CP-3D",
        "CP-4", "CP-6A", "CP-6E",
    }
    # 19 keys, 18 distinct binders — CP-6A and CP-6E share _bind_debate.
    assert bindings.BINDERS["CP-6A"] is bindings.BINDERS["CP-6E"]
    assert len({id(b) for b in bindings.BINDERS.values()}) == 18


# ── default / fall-through ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unmapped_id_falls_through_to_default(recorded):
    synth = StubSynth("fixture")
    out = await bindings.resolve_binding(_ctx("CP-9Z", synth))
    assert synth.calls == ["CP-9Z"]
    assert out.module_name == "CP-9Z-synth"


# ── CP-0 ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cp0_routes_to_readiness(recorded):
    synth = StubSynth("fixture")
    out = await bindings.resolve_binding(_ctx("CP-0", synth))
    assert _args(recorded, "readiness") == (SESSION, ISSUER)
    assert synth.calls == []
    assert out.module_name == "readiness-rec"


@pytest.mark.asyncio
async def test_cp0_null_issuer_falls_through(recorded):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx("CP-0", synth, issuer=None))
    assert "readiness" not in recorded
    assert synth.calls == ["CP-0"]


# ── CP-1 (source precedence + reconcile) ──────────────────────────────────────

@pytest.mark.asyncio
async def test_cp1_routes_through_cp1_sources_then_reconcile(recorded):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx("CP-1", synth))
    assert _args(recorded, "cp1_sources") == (SESSION, ISSUER, "Acme", synth, UPSTREAM, RETRIEVE)
    # The recorder's payload carries no reported basis → adjusted path → reconcile fires.
    assert "reconcile" in recorded
    assert _args(recorded, "reconcile")[1] is RETRIEVE


# ── CP-2 live vs fixture ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cp2_live_branch_uses_synthesizer(recorded):
    synth = StubSynth("live")
    await bindings.resolve_binding(_ctx("CP-2", synth))
    assert synth.calls == ["CP-2"]
    assert "coststructure" not in recorded


@pytest.mark.asyncio
async def test_cp2_fixture_branch_uses_cost_structure(recorded):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx("CP-2", synth))
    assert _args(recorded, "coststructure") == ("Acme", RETRIEVE)
    assert synth.calls == []


# ── CP-1B sync return ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cp1b_sync_binder_returns_unawaited(recorded):
    synth = StubSynth("fixture")
    out = await bindings.resolve_binding(_ctx("CP-1B", synth))
    assert _args(recorded, "earnings") == (UPSTREAM["CP-1"],)
    assert out.module_name == "earnings-rec"  # the sync result flowed through


# ── CP-1C (issuer-gated) ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cp1c_routes_to_peers(recorded):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx("CP-1C", synth))
    assert _args(recorded, "peers") == (SESSION, ISSUER, UPSTREAM["CP-1"])
    assert synth.calls == []


@pytest.mark.asyncio
async def test_cp1c_null_issuer_falls_through(recorded):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx("CP-1C", synth, issuer=None))
    assert "peers" not in recorded
    assert synth.calls == ["CP-1C"]


# ── CP-3C (5-arg portfolio fit) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cp3c_routes_with_full_arg_shape(recorded):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx("CP-3C", synth, portfolio_id="PF-9"))
    assert _args(recorded, "portfoliofit") == (
        UPSTREAM["CP-3"], UPSTREAM["CP-1"], SESSION, ISSUER, "PF-9",
    )


# ── debate (shared binder, reads module_id) ───────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("module_id", ["CP-6A", "CP-6E"])
async def test_debate_shared_binder(recorded, module_id):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx(module_id, synth))
    assert _args(recorded, "debate") == (module_id, UPSTREAM)
    assert synth.calls == []


# ── the remaining single-purpose binders + their exact upstream slice ─────────

@pytest.mark.asyncio
@pytest.mark.parametrize("module_id, key, expected", [
    ("CP-1A", "factpack", (RETRIEVE,)),
    ("CP-4C", "covenants", (UPSTREAM["CP-1"], RETRIEVE)),
    ("CP-2B", "downside", (UPSTREAM["CP-1"],)),
    ("CP-2C", "catalysts", (UPSTREAM,)),
    ("CP-2D", "sponsor", (RETRIEVE,)),
    ("CP-2E", "liquidity", (RETRIEVE, UPSTREAM["CP-1"])),
    ("CP-2F", "macro", (UPSTREAM["CP-1"], RETRIEVE)),
    ("CP-3", "relval", (UPSTREAM["CP-1C"],)),
    ("CP-3B", "capstructure", (RETRIEVE, UPSTREAM["CP-1"])),
    ("CP-3D", "refinancing", (UPSTREAM["CP-1"], UPSTREAM["CP-2B"])),
    ("CP-4", "legal", (RETRIEVE,)),
])
async def test_single_purpose_binder_routing(recorded, module_id, key, expected):
    synth = StubSynth("fixture")
    await bindings.resolve_binding(_ctx(module_id, synth))
    assert _args(recorded, key) == expected
    assert synth.calls == []  # a mapped module must not fall through to the default
