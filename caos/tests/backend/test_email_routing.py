"""
Tests for the email intelligence routing layer (P3, REF_CP-EMAIL v2.0).

Stdlib-only (email_routing.py has no pydantic dep). Runnable directly:
    python3 tests/backend/test_email_routing.py
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import date
from pathlib import Path

_PY = Path(__file__).resolve().parents[2] / "backend" / "governance" / "email_routing.py"
_spec = importlib.util.spec_from_file_location("cp_email_routing", _PY)
_m = importlib.util.module_from_spec(_spec)
sys.modules["cp_email_routing"] = _m
_spec.loader.exec_module(_m)  # type: ignore[union-attr]

EmailCategory = _m.EmailCategory
EmailUse = _m.EmailUse
allowed_uses = _m.allowed_uses
can_be_evidence = _m.can_be_evidence
route_event = _m.route_event
is_stale = _m.is_stale
classify_email = _m.classify_email
ROUTING_SIGNALS = _m.ROUTING_SIGNALS
CATEGORY_META = _m.CATEGORY_META


def test_eight_categories_each_have_meta():
    assert len(EmailCategory) == 8
    assert set(CATEGORY_META) == set(EmailCategory)


def test_routing_signals_point_at_known_modules():
    valid = {f"CP-{x}" for x in ("0","X","1","1A","1B","1C","2","2B","2C","2D","2E","2F",
                                  "3","3B","3C","3D","4","4C","5","5B","6A","6E","SR","MON")}
    for ev, (primary, secondary) in ROUTING_SIGNALS.items():
        assert primary in valid, (ev, primary)
        for s in secondary:
            assert s in valid, (ev, s)


def test_rating_downgrade_routes_to_cp_mon():
    r = route_event("rating_downgrade")
    assert r["primary_module"] == "CP-MON"
    assert "CP-3" in r["secondary_modules"]  # RV is CP-3 under v2 (not CP-5)


def test_qa_modules_never_take_email_as_evidence():
    for m in ("CP-4", "CP-4C", "CP-5", "CP-5B", "CP-2E"):
        for cat in EmailCategory:
            assert not can_be_evidence(m, cat), (m, cat)


def test_rating_action_is_evidence_for_cp3():
    assert can_be_evidence("CP-3", EmailCategory.RATING_ACTION)


def test_event_invite_is_never_evidence_anywhere():
    for m in ("CP-1", "CP-3", "CP-6A", "CP-SR"):
        assert not can_be_evidence(m, EmailCategory.EVENT_INVITE)


def test_cpx_gets_routing_signal_use():
    assert EmailUse.ROUTING_SIGNAL in allowed_uses("CP-X", EmailCategory.RATING_ACTION)


def test_staleness_rules():
    old = date(2026, 1, 1)
    now = date(2026, 6, 1)
    assert is_stale(EmailCategory.TRADING_DESK, old, now)            # 5d window -> stale
    assert is_stale(EmailCategory.SELL_SIDE_RESEARCH, old, now)      # 90d window -> stale
    assert not is_stale(EmailCategory.RATING_ACTION, old, now)       # permanent -> never stale


def test_classifier_basic():
    assert classify_email("Moody's downgrades Acme to B3, outlook negative") == EmailCategory.RATING_ACTION
    assert classify_email("Acme launches new $500m senior notes") == EmailCategory.SELL_SIDE_NEWS
    assert classify_email("Acme 2030 axe — offer 98.5, levels") == EmailCategory.TRADING_DESK


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn(); print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            failed += 1; print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    raise SystemExit(1 if failed else 0)
