"""Registry integrity self-check (review run-2 #B9/#B10): the static module graph
must be free of dangling depends_on ids and dependency cycles. _validate_registry
runs at import; these pin it and prove it actually rejects a malformed graph."""
import pytest

from engine import registry


def test_live_registry_is_valid():
    # The real graph passes (also enforced at import time, so a bad edit fails fast).
    registry._validate_registry()


def test_validate_rejects_dangling_dep(monkeypatch):
    bad = registry.ModuleSpec("CP-X", "X", "L1", "x", depends_on=("CP-NOPE",))
    monkeypatch.setattr(registry, "_SPECS", registry._SPECS + (bad,))
    with pytest.raises(ValueError):
        registry._validate_registry()
