"""scrypt password hashing (passwords.py) — the email+password lane primitive."""

from passwords import hash_password, verify_password


def test_hash_verify_roundtrip():
    h = hash_password("correct horse battery staple")
    assert h.startswith("pbkdf2$")
    assert verify_password("correct horse battery staple", h)


def test_wrong_password_rejected():
    h = hash_password("s3cret-pw")
    assert not verify_password("s3cret-pX", h)


def test_salt_makes_each_hash_unique():
    # Random salt → same password yields different stored hashes; both still verify.
    a, b = hash_password("same-pw-123"), hash_password("same-pw-123")
    assert a != b
    assert verify_password("same-pw-123", a) and verify_password("same-pw-123", b)


def test_empty_or_malformed_hash_never_raises():
    # A None/SSO row or any garbage must fail closed, not throw (login relies on it).
    for bad in (None, "", "garbage", "scrypt$bad", "bcrypt$1$x$y"):
        assert verify_password("whatever", bad) is False
