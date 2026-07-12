"""Tests for engine/sentinel.py — the deterministic fingerprint-diff trigger.

Pure-function tests: new/changed/dropped tickets, idempotency on an unchanged
book, the scoped-subset restriction, and the changed_issuers helper.
"""

from engine.sentinel import Ticket, changed_issuers, detect_tickets


def test_new_coverage_ticket():
    out = detect_tickets({"i1": "a"}, {})
    assert out == [Ticket("i1", "new-coverage",
                          "issuer entered coverage (no prior fingerprint)")]


def test_changed_ticket():
    out = detect_tickets({"i1": "b"}, {"i1": "a"})
    assert out == [Ticket("i1", "changed",
                          "fingerprint moved (re-ingest / new run / link / finding)")]


def test_dropped_coverage_ticket():
    out = detect_tickets({}, {"i1": "a"})
    assert out == [Ticket("i1", "dropped-coverage",
                          "issuer left coverage (present in prior, absent now)")]


def test_unchanged_book_is_idempotent_no_tickets():
    """An unchanged book produces no work and no downstream spend — the
    change-driven, never schedule-driven contract."""
    assert detect_tickets({"i1": "a", "i2": "b"}, {"i1": "a", "i2": "b"}) == []


def test_empty_snapshots_no_tickets():
    assert detect_tickets({}, {}) == []


def test_mixed_diff_sorted_by_issuer_id():
    out = detect_tickets(
        {"i3": "x", "i1": "b"},            # i3 new, i1 changed
        {"i1": "a", "i2": "y"})            # i2 dropped
    kinds = {t.issuer_id: t.kind for t in out}
    assert kinds == {"i1": "changed", "i2": "dropped-coverage", "i3": "new-coverage"}
    # Sorted by issuer id for deterministic downstream ordering.
    assert [t.issuer_id for t in out] == ["i1", "i2", "i3"]


def test_scoped_subset_restricts_diff():
    """A scoped re-run only tickets the requested issuer_ids, even when others
    also changed — the Anomaly Detector only re-scans the scoped set."""
    out = detect_tickets(
        {"i1": "b", "i2": "c", "i3": "d"},
        {"i1": "a", "i2": "c", "i3": "e"},
        issuer_ids=["i1"])
    assert [t.issuer_id for t in out] == ["i1"]
    assert out[0].kind == "changed"


def test_scoped_subset_with_new_and_dropped():
    out = detect_tickets({"i1": "a", "i2": "b"}, {"i2": "x", "i3": "y"},
                         issuer_ids=["i1", "i3"])
    kinds = {t.issuer_id: t.kind for t in out}
    assert kinds == {"i1": "new-coverage", "i3": "dropped-coverage"}


def test_changed_issuers_excludes_dropped():
    """dropped-coverage is informational only — no re-scan (the issuer has no
    current data to scan). Only new-coverage + changed drive Anomaly Detector work."""
    tickets = detect_tickets({"i1": "b", "i4": "a"}, {"i1": "a", "i2": "x", "i3": "y"})
    # i1 changed, i2 + i3 dropped, i4 new.
    assert changed_issuers(tickets) == ["i1", "i4"]


def test_forward_then_backward_diff_round_trips():
    """Symmetry: a forward diff then a backward diff returns the same issuers
    with flipped kinds — sanity check on the diff policy."""
    fwd = detect_tickets({"i1": "b"}, {"i1": "a"})
    bwd = detect_tickets({"i1": "a"}, {"i1": "b"})
    assert fwd[0].issuer_id == bwd[0].issuer_id == "i1"
    assert fwd[0].kind == "changed" and bwd[0].kind == "changed"
