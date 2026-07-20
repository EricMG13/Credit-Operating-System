"""Strict persisted-JSON boundary tests."""

from __future__ import annotations

import math

import pytest
from fastapi import HTTPException

from json_safety import require_bounded_json


def test_exact_utf8_limit_passes_and_next_byte_fails():
    # Compact JSON for this value is exactly eight UTF-8 bytes: {"x":"é"}.
    require_bounded_json({"x": "é"}, max_bytes=10, label="State")
    with pytest.raises(HTTPException) as exc_info:
        require_bounded_json({"x": "éé"}, max_bytes=10, label="State")
    assert exc_info.value.status_code == 413


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_non_finite_numbers_are_rejected(value):
    with pytest.raises(HTTPException) as exc_info:
        require_bounded_json({"value": value}, max_bytes=100, label="State")
    assert exc_info.value.status_code == 422


def test_non_json_value_is_rejected_without_coercion():
    with pytest.raises(HTTPException) as exc_info:
        require_bounded_json({"value": {1, 2}}, max_bytes=100, label="State")
    assert exc_info.value.status_code == 422


def test_invalid_limit_is_programmer_error():
    with pytest.raises(ValueError, match="must be positive"):
        require_bounded_json({}, max_bytes=0, label="State")
