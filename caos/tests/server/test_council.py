"""CP-5C committee review — offline unit tests.

Exercises the council's pure logic (parse / attribute / merge) and the no-op
FixtureReviewer path, then proves a council finding flows into the deterministic
CP-5 gate. No network and no model key required: the whole file is green offline.

Run from ``caos/server`` (where the app's top-level imports resolve):
    .venv/bin/python -m pytest tests/test_council.py -q
"""

from __future__ import annotations

import asyncio

from engine.council import (
    SEATS,
    FixtureReviewer,
    _attribute,
    _merge,
    _parse,
    _parse_ballot,
    _tally_votes,
    get_reviewer,
)
from engine.gate import Finding, qa_status_from
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

SEAT = SEATS[0]  # NumericalConsistency, lane 2


def _payload(module_id: str, claim_id: str = "C1") -> ModulePayload:
    return ModulePayload(
        module_id=module_id,
        module_name=module_id,
        owned_object="x",
        runtime_output={"leverage": 4.2},
        claims=[ClaimSpec(
            claim_id=claim_id, claim_text="Net leverage 4.2x",
            evidence=[EvidenceSpec("E1", "table_value", "Directly Sourced", "10-K p.42")],
        )],
    )


def _finding(severity: str, *, module_id="CP-1", claim="C1", lane=2, fid="F") -> Finding:
    return Finding(finding_id=fid, severity=severity, lane=lane,
                   description="d", module_id=module_id, affected_claim_id=claim)


# ── FixtureReviewer / selection ──────────────────────────────────────────────

def test_fixture_reviewer_emits_no_findings():
    findings = asyncio.run(FixtureReviewer().review([_payload("CP-1")]))
    assert findings == []


def test_get_reviewer_defaults_to_fixture_offline():
    # council_enabled defaults False and no key is set in the test env.
    assert isinstance(get_reviewer(), FixtureReviewer)


# ── _parse: defensive JSON handling ──────────────────────────────────────────

def test_parse_reads_findings_and_uppercases_severity():
    text = '[{"severity":"critical","module_id":"CP-1","affected_claim_id":"C1","description":"recompute"}]'
    out = _parse(SEAT, text)
    assert len(out) == 1
    assert out[0].severity == "CRITICAL"
    assert out[0].lane == 2
    assert out[0].finding_id == "CP-5C-2-0"
    assert out[0].module_id == "CP-1"


def test_parse_clamps_unknown_severity_to_minor():
    out = _parse(SEAT, '[{"severity":"SHOWSTOPPER","description":"x"}]')
    assert out[0].severity == "MINOR"


def test_parse_returns_empty_on_garbage():
    assert _parse(SEAT, "the work looks fine, no JSON here") == []
    assert _parse(SEAT, '[ not valid json ]') == []
    assert _parse(SEAT, '{"severity":"CRITICAL"}') == []  # object, not the array we require


# ── _attribute: pin findings to real modules so the gate can act ─────────────

def test_attribute_assigns_sole_module_when_id_missing():
    out = _attribute([_finding("MATERIAL", module_id=None)], [_payload("CP-1")])
    assert len(out) == 1 and out[0].module_id == "CP-1"


def test_attribute_drops_unknown_id_when_ambiguous():
    produced = [_payload("CP-0"), _payload("CP-1")]
    out = _attribute([_finding("CRITICAL", module_id="CP-9")], produced)
    assert out == []  # cannot attribute -> cannot gate -> dropped


def test_attribute_keeps_known_id():
    produced = [_payload("CP-0"), _payload("CP-1")]
    out = _attribute([_finding("MINOR", module_id="CP-1")], produced)
    assert len(out) == 1 and out[0].module_id == "CP-1"


# ── _merge: chairman-as-dedup, worst severity wins ───────────────────────────

def test_merge_collapses_same_claim_keeping_worst():
    out = _merge([
        _finding("MINOR", fid="a"),
        _finding("MATERIAL", fid="b"),  # same module/claim/lane
    ])
    assert len(out) == 1 and out[0].severity == "MATERIAL"


def test_merge_keeps_distinct_lanes_separate():
    out = _merge([
        _finding("MINOR", lane=2, fid="a"),
        _finding("MINOR", lane=3, fid="b"),
    ])
    assert len(out) == 2


# ── Stage-2 peer round: ballot parsing + deterministic tally ─────────────────

def test_parse_ballot_keeps_only_object_values():
    out = _parse_ballot('{"A": {"keep": true, "severity": "MATERIAL"}, "B": "nope"}')
    assert "A" in out and out["A"]["keep"] is True
    assert "B" not in out  # non-object value dropped


def test_parse_ballot_empty_on_garbage():
    assert _parse_ballot("no json") == {}


def test_tally_drops_finding_on_majority_reject():
    f = [_finding("MATERIAL", fid="x")]  # label "A"
    ballots = [
        {"A": {"keep": False}},
        {"A": {"keep": False}},
        {"A": {"keep": True, "severity": "MATERIAL"}},
    ]
    assert _tally_votes(f, ballots) == []  # 2 reject > 1 keep


def test_tally_keeps_on_tie():
    f = [_finding("MATERIAL", fid="x")]
    ballots = [{"A": {"keep": False}}, {"A": {"keep": True, "severity": "MATERIAL"}}]
    out = _tally_votes(f, ballots)
    assert len(out) == 1 and out[0].severity == "MATERIAL"  # tie -> keep


def test_tally_escalates_but_never_de_escalates_severity():
    # peers escalate MINOR -> CRITICAL
    up = _tally_votes([_finding("MINOR", fid="x")], [{"A": {"keep": True, "severity": "CRITICAL"}}])
    assert up[0].severity == "CRITICAL"
    # peers try to soften CRITICAL -> MINOR; the gate is not softened
    down = _tally_votes([_finding("CRITICAL", fid="x")], [{"A": {"keep": True, "severity": "MINOR"}}])
    assert down[0].severity == "CRITICAL"


def test_tally_keeps_unvoted_findings_unchanged():
    f = [_finding("MATERIAL", fid="x")]
    assert _tally_votes(f, [{}, {}]) == f  # nobody voted -> unchanged


# ── Integration: a council finding drives the deterministic gate ─────────────

def test_council_critical_blocks_via_gate():
    lineage = Finding("QA-001", "MATERIAL", "weak lineage", lane=6, module_id="CP-1")
    council = _finding("CRITICAL", module_id="CP-1", lane=2, fid="CP-5C-2-0")
    # The runner pools both finding sources before calling the gate per module.
    module_findings = [f for f in (lineage, council) if f.module_id == "CP-1"]
    assert qa_status_from(module_findings) == "Blocked"
