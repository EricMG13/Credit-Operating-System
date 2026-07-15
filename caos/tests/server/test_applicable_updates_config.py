"""Feature gates for the Applicable Updates program."""

from __future__ import annotations

import pytest

from config import Settings


FLAG_FIELDS = (
    "caos_lineage_v2_enabled",
    "caos_market_xlsx_v2_enabled",
    "caos_model_engine_v2_enabled",
    "caos_cp_4d_enabled",
    "caos_cp_2g_enabled",
)


def test_applicable_update_flags_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    for field in FLAG_FIELDS:
        monkeypatch.delenv(field.upper(), raising=False)

    settings = Settings(_env_file=None)

    assert {field: getattr(settings, field) for field in FLAG_FIELDS} == {
        field: False for field in FLAG_FIELDS
    }


@pytest.mark.parametrize("field", FLAG_FIELDS)
def test_applicable_update_flags_follow_environment(
    monkeypatch: pytest.MonkeyPatch, field: str
) -> None:
    monkeypatch.setenv(field.upper(), "true")

    assert getattr(Settings(_env_file=None), field) is True
