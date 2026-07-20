"""Email + password account lane: register, login, and timing-safe failures."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _register_body(name: str, email: str, password: str = "hunter2hunter") -> dict:
    return {
        "code": "131113",
        "name": name,
        "email": email,
        "password": password,
        "coverage_area": "TMT",
        "location": "NA",
        "recovery_words": ["alpha", "bravo", "charlie"],
        "recovery_hints": ["first", "second", "third"],
    }


def test_register_then_me_is_profile(client):
    r = client.post("/api/auth/register", json=_register_body("Pat Lender", "pat@firm.com"))
    assert r.status_code == 201, r.text
    assert r.json()["source"] == "profile"
    me = client.get("/api/auth/me").json()
    assert me["source"] == "profile" and me["full_name"] == "Pat Lender"


def test_register_bad_invite_code_rejected(client):
    # 401 (not 403) so the access-log brute-force heuristic sees a wrong invite code.
    body = _register_body("No One", "no@firm.com", "longenough12")
    body["code"] = "000000"
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 401, r.text


def test_register_duplicate_email_conflict(client):
    body = _register_body("Dup One", "dup@firm.com", "longenough12")
    assert client.post("/api/auth/register", json=body).status_code == 201
    # Same email, different case → still a conflict (email is the lowercased key).
    body2 = _register_body("Dup Two", "DUP@firm.com", "longenough12")
    assert client.post("/api/auth/register", json=body2).status_code == 409


def test_register_invalid_email_422(client):
    r = client.post("/api/auth/register", json=_register_body("Bad Email", "not-an-email", "longenough12"))
    assert r.status_code == 422, r.text


def test_register_short_password_422(client):
    # Pydantic's creation-only floor rejects 11 characters before any DB work.
    r = client.post("/api/auth/register", json=_register_body("Short PW", "short@firm.com", "12345678901"))
    assert r.status_code == 422, r.text


@pytest.mark.parametrize(
    "path,body",
    [
        (
            "/api/auth/register",
            {**_register_body("Long Recovery", "long-recovery@firm.com"), "recovery_words": ["x" * 81, "bravo", "charlie"]},
        ),
        (
            "/api/auth/register",
            {**_register_body("Long Hint", "long-hint@firm.com"), "recovery_hints": ["x" * 161, "second", "third"]},
        ),
        (
            "/api/auth/recover",
            {"email": "nobody@firm.com", "recovery_words": ["x" * 81, "bravo", "charlie"]},
        ),
    ],
)
def test_recovery_credential_elements_are_bounded(client, path, body):
    assert client.post(path, json=body).status_code == 422


def test_login_roundtrip(client):
    client.post("/api/auth/register", json=_register_body("Lee Loan", "lee@firm.com", "correctpassword"))
    client.post("/api/auth/logout")
    client.cookies.clear()
    # Email match is case-insensitive.
    r = client.post("/api/auth/login", json={"email": "Lee@firm.com", "password": "correctpassword"})
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "profile"
    assert client.get("/api/auth/me").json()["full_name"] == "Lee Loan"


def test_login_wrong_password_401(client):
    client.post("/api/auth/register", json=_register_body("Wrong PW", "wrong@firm.com", "rightpassword"))
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "wrong@firm.com", "password": "nopepassword"})
    assert r.status_code == 401, r.text


def test_login_unknown_email_401(client):
    # No such account → still a generic 401 (no user enumeration).
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "ghost@firm.com", "password": "whatever123"})
    assert r.status_code == 401, r.text


def test_recovery_requires_all_words(client):
    client.post("/api/auth/register", json=_register_body("Recover Me", "recover@firm.com", "correctpassword"))
    client.cookies.clear()
    bad = client.post("/api/auth/recover", json={"email": "recover@firm.com", "recovery_words": ["alpha", "bravo", "wrong"]})
    assert bad.status_code == 401
    ok = client.post("/api/auth/recover", json={"email": "recover@firm.com", "recovery_words": ["alpha", "bravo", "charlie"]})
    assert ok.status_code == 200, ok.text


def test_sso_adoption_revokes_self_registered_password(client):
    # SEAM4-3: with no proxy identity present, register keys on a shape-checked
    # email only — so an invite-code holder can pre-squat a colleague's address
    # under an attacker-chosen password. When the real colleague later signs in
    # through SSO, create_profile adopts the row and MUST revoke the pre-existing
    # password + recovery credential, or the squatter keeps a parallel login as them.
    email = "victim@firm.com"
    # 1. Squatter self-registers the victim's email with a password they control.
    r = client.post("/api/auth/register", json=_register_body("Victim V", email, "squatterpass1"))
    assert r.status_code == 201, r.text
    client.cookies.clear()

    # 2. The real victim signs in via SSO (edge proxy sets the verified email header).
    r = client.post(
        "/api/auth/profile",
        json={"code": "131113", "name": "Victim V"},
        headers={"X-Forwarded-Email": email},
    )
    assert r.status_code == 201, r.text
    client.cookies.clear()

    # 3. Neither the squatter's password nor their recovery words authenticate now.
    login = client.post("/api/auth/login", json={"email": email, "password": "squatterpass1"})
    assert login.status_code == 401, login.text
    recover = client.post(
        "/api/auth/recover",
        json={"email": email, "recovery_words": ["alpha", "bravo", "charlie"]},
    )
    assert recover.status_code == 401, recover.text


def test_recovery_unknown_email_denied(client):
    # No account for this email — the dummy-hash path must still verify (constant
    # work, no enumeration) and deny, not crash or fast-path.
    client.cookies.clear()
    r = client.post("/api/auth/recover", json={"email": "nobody@firm.com", "recovery_words": ["alpha", "bravo", "charlie"]})
    assert r.status_code == 401, r.text
