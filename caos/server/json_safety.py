"""Strict byte ceilings for JSON persisted at flexible schema boundaries."""

from __future__ import annotations

import json

from fastapi import HTTPException, status


def require_bounded_json(value: object, *, max_bytes: int, label: str) -> None:
    """Reject invalid/non-finite JSON and valid JSON beyond ``max_bytes``.

    The size is measured as compact UTF-8, matching the payload stored by the
    database much more closely than Python character count or container length.
    Nothing is truncated: callers either persist the complete value or fail.
    """
    if max_bytes < 1:
        raise ValueError("max_bytes must be positive")
    try:
        serialized = json.dumps(
            value,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ).encode("utf-8")
    except (TypeError, ValueError, OverflowError) as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"{label} must contain finite JSON values.",
        ) from exc
    if len(serialized) > max_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"{label} is too large.",
        )
