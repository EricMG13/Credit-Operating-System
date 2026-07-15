"""Registry integrity self-check (review run-2 #B9/#B10): the static module graph
must be free of dangling depends_on ids and dependency cycles. _validate_registry
runs at import; these pin it and prove it actually rejects a malformed graph."""
import pytest

from engine import registry


def test_live_registry_is_valid():
    # The real graph passes (also enforced at import time, so a bad edit fails fast).
    registry._validate_registry()


def test_phase4_modules_are_independently_feature_gated():
    default_ids = {spec.module_id for spec in registry.all_specs()}
    assert "CP-4D" not in default_ids and "CP-2G" not in default_ids

    cp4d_ids = {spec.module_id for spec in registry.all_specs(frozenset({"caos_cp_4d_enabled"}))}
    cp2g_ids = {spec.module_id for spec in registry.all_specs(frozenset({"caos_cp_2g_enabled"}))}
    both_ids = {spec.module_id for spec in registry.all_specs(frozenset({
        "caos_cp_4d_enabled", "caos_cp_2g_enabled",
    }))}
    assert "CP-4D" in cp4d_ids and "CP-2G" not in cp4d_ids
    assert "CP-2G" in cp2g_ids and "CP-4D" not in cp2g_ids
    assert {"CP-4D", "CP-2G"}.issubset(both_ids)
    assert registry.REGISTRY["CP-2G"].run_blocking is False


def test_validate_rejects_dangling_dep(monkeypatch):
    bad = registry.ModuleSpec("CP-X", "X", "L1", "x", depends_on=("CP-NOPE",))
    monkeypatch.setattr(registry, "_SPECS", registry._SPECS + (bad,))
    with pytest.raises(ValueError):
        registry._validate_registry()
