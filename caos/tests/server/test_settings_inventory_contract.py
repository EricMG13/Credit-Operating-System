"""Exhaustive contract checks for every environment-backed Settings field.

The QA feature inventory discovers configuration options directly from
``config.Settings``.  These parametrized checks keep that inventory executable:
every declared field must construct from its code default, accept a representative
environment override of its declared scalar type, and reject malformed scalar
input.  Numeric fields also document the implementation's current zero-boundary
behaviour (parsing accepts zero; subsystem-specific guards remain separate).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from config import Settings


def _override_case(name: str, annotation: object) -> pytest.ParameterSet:
    env_name = name.upper()
    if annotation is bool:
        raw, expected = "true", True
    elif annotation is int:
        raw, expected = "7", 7
    elif annotation is float:
        raw, expected = "7.5", 7.5
    else:
        raw, expected = f"qa-value-{name}", f"qa-value-{name}"
    return pytest.param(name, env_name, raw, expected, id=env_name)


DEFAULT_CASES = [
    pytest.param(name, name.upper(), field.default, id=name.upper())
    for name, field in Settings.model_fields.items()
]
OVERRIDE_CASES = [
    _override_case(name, field.annotation)
    for name, field in Settings.model_fields.items()
]
INVALID_SCALAR_CASES = [
    pytest.param(name, name.upper(), field.annotation, id=name.upper())
    for name, field in Settings.model_fields.items()
    if field.annotation in {bool, int, float}
]
NUMERIC_ZERO_CASES = [
    pytest.param(name, name.upper(), field.annotation, id=name.upper())
    for name, field in Settings.model_fields.items()
    if field.annotation in {int, float}
]


@pytest.mark.parametrize(("field_name", "env_name", "expected"), DEFAULT_CASES)
def test_every_settings_field_uses_its_code_default(
    monkeypatch: pytest.MonkeyPatch,
    field_name: str,
    env_name: str,
    expected: object,
) -> None:
    monkeypatch.delenv(env_name, raising=False)

    settings = Settings(_env_file=None)

    assert getattr(settings, field_name) == expected


@pytest.mark.parametrize(
    ("field_name", "env_name", "raw", "expected"),
    OVERRIDE_CASES,
)
def test_every_settings_environment_override_parses_declared_type(
    monkeypatch: pytest.MonkeyPatch,
    field_name: str,
    env_name: str,
    raw: str,
    expected: object,
) -> None:
    monkeypatch.setenv(env_name, raw)

    settings = Settings(_env_file=None)

    assert getattr(settings, field_name) == expected


@pytest.mark.parametrize(
    ("field_name", "env_name", "annotation"),
    INVALID_SCALAR_CASES,
)
def test_scalar_setting_rejects_unparseable_environment_input(
    monkeypatch: pytest.MonkeyPatch,
    field_name: str,
    env_name: str,
    annotation: object,
) -> None:
    del field_name, annotation
    monkeypatch.setenv(env_name, "not-a-valid-scalar")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.parametrize(
    ("field_name", "env_name", "annotation"),
    NUMERIC_ZERO_CASES,
)
def test_numeric_setting_accepts_zero_boundary(
    monkeypatch: pytest.MonkeyPatch,
    field_name: str,
    env_name: str,
    annotation: object,
) -> None:
    monkeypatch.setenv(env_name, "0")

    settings = Settings(_env_file=None)

    expected = 0.0 if annotation is float else 0
    assert getattr(settings, field_name) == expected
