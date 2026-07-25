"""CP-4C marketed-vs-reported bridge (OKF Phase-3).

The lead test here is the one the red-team pass demanded before this could ship:
**RT-2026-07-24-01 — a sponsor deck's marketed figure must never mutate the
reported foundation.** Everything else supports it.

The failure this guards against is quiet and expensive: a deck's "4.2x pro-forma"
silently replacing a reported 6.8x would understate leverage on a credit the desk
is underwriting. So the assertions are about *what the bridge is forbidden to
touch*, not only about what it produces.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


# ── harness ──────────────────────────────────────────────────────────────────


def _cp1(leverage=6.8, net_debt=680.0, basis="reported_gaap_xbrl"):
    from engine.schemas import ModulePayload

    return ModulePayload(
        module_id="CP-1",
        module_name="Reported Financial Foundation",
        owned_object="ReportedFinancials",
        runtime_output={
            "basis": basis,
            "normalized_financials": {
                "net_leverage_adj_ltm": leverage,
                "net_debt_ltm": net_debt,
                "adj_ebitda": {"2025": 100.0},
            },
        },
        claims=[],
        confidence="High",
    )


def _row(facts, *, source="Sponsor Deck", doc_type="sponsor-deck"):
    return SimpleNamespace(key_facts_json=facts, source=source, doc_type=doc_type)


class _FakeSession:
    """Returns the given OkfNote-shaped rows from any select()."""

    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _stmt):
        rows = self._rows

        class _R:
            @staticmethod
            def scalars():
                return SimpleNamespace(all=lambda: rows)

        return _R()


class _BrokenSession:
    async def execute(self, _stmt):
        raise RuntimeError("registry unavailable")


def _marketed_fact(value="4.2x", basis="sponsor-adjusted", page=7):
    return {"label": "Net leverage", "value": value, "kind": "leverage",
            "basis": basis, "page": page, "confidence": "Medium"}


def _run(coro):
    import asyncio

    return asyncio.run(coro)


# ── RT-2026-07-24-01: the contamination test ────────────────────────────────


def test_marketed_figure_never_mutates_reported_cp1():
    """THE red-team test. The bridge may describe the marketed figure; it must not
    write it into the reported foundation."""
    import copy

    from engine.marketed import marketed_vs_reported

    cp1 = _cp1(leverage=6.8, net_debt=680.0)
    before = copy.deepcopy(cp1.runtime_output["normalized_financials"])

    result = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact("4.2x")])]), "issuer-1", cp1
    ))
    assert result is not None
    bridge, claim = result

    # 1. The reported financials are untouched, field for field.
    assert cp1.runtime_output["normalized_financials"] == before
    assert cp1.runtime_output["normalized_financials"]["net_leverage_adj_ltm"] == 6.8

    # 2. The marketed number appears ONLY in the bridge, never in the foundation.
    assert bridge["marketed_leverage"] == 4.2
    assert bridge["reported_leverage"] == 6.8
    assert 4.2 not in cp1.runtime_output["normalized_financials"].values()

    # 3. The bridge is returned for the caller to attach under its own key — the
    #    function itself writes nothing into the payload.
    assert "marketed_vs_reported" not in cp1.runtime_output

    # 4. The claim states plainly which basis is canonical.
    assert "reported figure remains canonical" in claim.claim_text


def test_binding_attaches_the_bridge_additively_only():
    """At the call site, the bridge lands under its own key and the reported
    financials still compare equal."""
    import copy

    from engine.marketed import marketed_vs_reported

    cp1 = _cp1()
    before = copy.deepcopy(cp1.runtime_output["normalized_financials"])

    bridge, claim = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact()])]), "issuer-1", cp1
    ))
    # Mirror exactly what bindings._bind_cp1 does.
    cp1.runtime_output["marketed_vs_reported"] = bridge
    cp1.claims.append(claim)

    assert cp1.runtime_output["normalized_financials"] == before
    assert cp1.runtime_output["marketed_vs_reported"]["marketed_leverage"] == 4.2
    assert [c.claim_id for c in cp1.claims] == ["C-MKT1"]


def test_a_reported_basis_fact_is_not_treated_as_a_marketing_claim():
    """Only sponsor/management bases are marketing. A fact tagged `reported`
    must not drive a 'presentation gap'."""
    from engine.marketed import marketed_vs_reported

    result = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact(basis="reported")])]), "issuer-1", _cp1()
    ))
    assert result is None


def test_management_pro_forma_also_counts_as_marketed():
    from engine.marketed import marketed_vs_reported

    result = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact(basis="management-pro-forma")])]),
        "issuer-1", _cp1(),
    ))
    assert result is not None and result[0]["marketed_leverage"] == 4.2


# ── numeric safety ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("bad", ["", "n/a", "4.2", "x", "leverage", "TBDx"])
def test_unparseable_values_produce_no_bridge(bad):
    from engine.marketed import marketed_vs_reported

    result = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact(value=bad)])]), "issuer-1", _cp1()
    ))
    assert result is None


@pytest.mark.parametrize("implausible", ["0.01x", "250x", "1999x"])
def test_implausible_multiples_are_rejected(implausible):
    """A mis-read page number or year must never become committee-facing leverage."""
    from engine.marketed import marketed_vs_reported

    result = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact(value=implausible)])]), "issuer-1", _cp1()
    ))
    assert result is None


def test_a_non_finite_reported_leverage_produces_no_bridge():
    """CP-1 engine convention: guard before arithmetic. bool(NaN) is True, so a
    bare truthiness check would let it through and poison the subtraction."""
    from engine.marketed import marketed_vs_reported

    for bad in (float("nan"), float("inf"), None, 0):
        assert _run(marketed_vs_reported(
            _FakeSession([_row([_marketed_fact()])]), "issuer-1", _cp1(leverage=bad)
        )) is None


def test_a_registry_read_failure_degrades_to_no_bridge():
    """A bridge is never worth failing a run over."""
    from engine.marketed import marketed_vs_reported

    assert _run(marketed_vs_reported(_BrokenSession(), "issuer-1", _cp1())) is None


def test_no_okf_documents_produces_no_bridge():
    from engine.marketed import marketed_vs_reported

    assert _run(marketed_vs_reported(_FakeSession([]), "issuer-1", _cp1())) is None
    assert _run(marketed_vs_reported(_FakeSession([_row(None)]), "issuer-1", _cp1())) is None
    assert _run(marketed_vs_reported(_FakeSession([_row("not-a-list")]), "issuer-1", _cp1())) is None


def test_the_newest_document_wins():
    """Rows arrive newest-first, so a re-issued deck supersedes an older one."""
    from engine.marketed import marketed_vs_reported

    rows = [
        _row([_marketed_fact("3.9x")], source="Q3 Deck"),
        _row([_marketed_fact("4.2x")], source="Q2 Deck"),
    ]
    bridge, _ = _run(marketed_vs_reported(_FakeSession(rows), "issuer-1", _cp1()))

    assert bridge["marketed_leverage"] == 3.9
    assert bridge["marketed_source"] == "Q3 Deck"


def test_the_gap_is_reported_minus_marketed():
    from engine.marketed import marketed_vs_reported

    bridge, _ = _run(marketed_vs_reported(
        _FakeSession([_row([_marketed_fact("4.2x")])]), "issuer-1", _cp1(leverage=6.8)
    ))
    assert bridge["gap_turns"] == pytest.approx(2.6)


# ── the CP-5 finding ────────────────────────────────────────────────────────


def _cp1_with_bridge(**bridge):
    cp1 = _cp1()
    cp1.runtime_output["marketed_vs_reported"] = bridge
    return cp1


def test_a_material_gap_raises_a_minor_finding():
    from engine.marketed import marketed_gap_finding

    finding = marketed_gap_finding(_cp1_with_bridge(
        marketed_leverage=4.2, reported_leverage=6.8, gap_turns=2.6
    ))

    assert finding is not None
    assert finding.severity == "MINOR"  # a risk to scrutinise, not an export blocker
    assert finding.module_id == "CP-1"
    assert finding.affected_claim_id == "C-MKT1"
    assert "4.2x" in finding.description and "6.8x" in finding.description
    assert "below" in finding.description


def test_an_immaterial_gap_is_silent():
    from engine.marketed import marketed_gap_finding

    assert marketed_gap_finding(_cp1_with_bridge(
        marketed_leverage=6.7, reported_leverage=6.8, gap_turns=0.1
    )) is None


def test_a_marketed_figure_above_reported_reads_as_above():
    """Direction is stated, not assumed — a conservative deck is not a red flag
    dressed as one."""
    from engine.marketed import marketed_gap_finding

    finding = marketed_gap_finding(_cp1_with_bridge(
        marketed_leverage=7.9, reported_leverage=6.8, gap_turns=-1.1
    ))
    assert finding is not None and "above" in finding.description


def test_a_malformed_bridge_never_crashes_the_qa_phase():
    """A replayed payload can carry junk here; the gate degrades instead of
    failing the whole run."""
    from engine.marketed import marketed_gap_finding

    assert marketed_gap_finding(None) is None
    assert marketed_gap_finding(_cp1()) is None  # no bridge key at all
    for junk in ("not disclosed", 42, [], {"gap_turns": float("nan"),
                                           "marketed_leverage": 4.2,
                                           "reported_leverage": 6.8}):
        cp1 = _cp1()
        cp1.runtime_output["marketed_vs_reported"] = junk
        assert marketed_gap_finding(cp1) is None


def test_the_finding_is_registered_with_the_cp5_gate():
    """A finding provider nobody calls is dead code, not a control."""
    from engine.marketed import marketed_gap_finding
    from engine import runner

    source = Path(runner.__file__).read_text(encoding="utf-8")
    assert "marketed_gap_finding" in source
    assert marketed_gap_finding.__name__ == "marketed_gap_finding"
