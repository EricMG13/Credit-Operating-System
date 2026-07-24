"""Shared base64url + HMAC-SHA256 sign/verify for short-lived app tokens
(pagination cursors, session cookies) — one seam instead of a hand-rolled
pair per call site."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json


def sign_json(payload: dict, *, secret: str) -> str:
    """Encode `payload` as compact JSON, base64url it, and append an
    HMAC-SHA256 hex signature: `<b64>.<hex-hmac>`."""
    raw = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), default=str).encode()
    ).decode().rstrip("=")
    signature = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{signature}"


def verify_json(token: str, *, secret: str) -> dict:
    """Verify the signature and return the decoded payload dict. Raises
    ValueError on any tampering, malformed input, or bad signature."""
    raw, sep, signature = token.rpartition(".")
    if not sep or not raw or not signature:
        raise ValueError("malformed token")
    expected = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    # Compare as bytes: `signature` is attacker-controlled input, and a non-ASCII
    # char would make compare_digest raise TypeError on str (→ 500, not a clean
    # reject).
    if not hmac.compare_digest(signature.encode("utf-8", "ignore"), expected.encode("ascii")):
        raise ValueError("signature mismatch")
    return json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
