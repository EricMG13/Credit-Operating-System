"""_dependency_layers: a cyclic registry must fail loudly, not run modules in
arbitrary order (C3). Patches REGISTRY with tiny dep graphs so it needs no DB."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import engine.runner as runner


def test_acyclic_orders_into_layers(monkeypatch):
    fake = {
        "A": SimpleNamespace(depends_on=[]),
        "B": SimpleNamespace(depends_on=["A"]),
        "C": SimpleNamespace(depends_on=["A"]),
    }
    monkeypatch.setattr(runner, "REGISTRY", fake)
    # input order preserved within a layer; B/C both depend only on A
    assert runner._dependency_layers(["B", "C", "A"]) == [["A"], ["B", "C"]]


def test_cycle_raises(monkeypatch):
    fake = {
        "A": SimpleNamespace(depends_on=["B"]),
        "B": SimpleNamespace(depends_on=["A"]),
    }
    monkeypatch.setattr(runner, "REGISTRY", fake)
    with pytest.raises(RuntimeError, match="cycle"):
        runner._dependency_layers(["A", "B"])
