"""Password hashing for the email+password login lane (routes/auth.py).

PBKDF2-HMAC-SHA256 (hashlib, stdlib) — no third-party dependency and, unlike
hashlib.scrypt, always present regardless of the build's OpenSSL (some macOS /
LibreSSL builds ship no scrypt). Stored as ``pbkdf2$<iterations>$<salt_b64>$
<hash_b64>`` so the work factor travels with the hash and can be raised later
without invalidating existing rows (verify reads the iteration count from the
string). SSO / shared-code profiles carry no password and never reach here.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

# ponytail: 600k iterations = OWASP 2023 floor for PBKDF2-HMAC-SHA256. Raise it
# (and re-hash on next login) for a higher work factor; stored iterations mean old
# rows still verify. Swap to scrypt/argon2 only if you take on that dependency.
_ITERATIONS, _DKLEN, _SALT_BYTES = 600_000, 32, 16


def hash_password(password: str) -> str:
    salt = os.urandom(_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS, _DKLEN)
    return f"pbkdf2${_ITERATIONS}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-time check of ``password`` against a stored hash. False on any
    malformed/empty hash (so a None/SSO row simply fails, never raises)."""
    if not stored:
        return False
    try:
        scheme, iters_s, salt_b64, hash_b64 = stored.split("$")
        if scheme != "pbkdf2":
            return False
        iters, salt, expected = int(iters_s), _unb64(salt_b64), _unb64(hash_b64)
    except (ValueError, TypeError):
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters, len(expected))
    return hmac.compare_digest(dk, expected)


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(s: str) -> bytes:
    return base64.b64decode(s)
