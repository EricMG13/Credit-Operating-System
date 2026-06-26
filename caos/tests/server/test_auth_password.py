"""Email + password account lane: register, login, and timing-safe failures."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_register_then_me_is_profile(client):
    r = client.post("/api/auth/register", json={
        "code": "131113", "name": "Pat Lender", "email": "pat@firm.com", "password": "hunter2hunter",
    })
    assert r.status_code == 201, r.text
    assert r.json()["source"] == "profile"
    me = client.get("/api/auth/me").json()
    assert me["source"] == "profile" and me["full_name"] == "Pat Lender"


def test_register_bad_invite_code_rejected(client):
    # 401 (not 403) so the access-log brute-force heuristic sees a wrong invite code.
    r = client.post("/api/auth/register", json={
        "code": "000000", "name": "No One", "email": "no@firm.com", "password": "longenough1",
    })
    assert r.status_code == 401, r.text


def test_register_duplicate_email_conflict(client):
    body = {"code": "131113", "name": "Dup One", "email": "dup@firm.com", "password": "longenough1"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    # Same email, different case → still a conflict (email is the lowercased key).
    body2 = {"code": "131113", "name": "Dup Two", "email": "DUP@firm.com", "password": "longenough1"}
    assert client.post("/api/auth/register", json=body2).status_code == 409


def test_register_invalid_email_422(client):
    r = client.post("/api/auth/register", json={
        "code": "131113", "name": "Bad Email", "email": "not-an-email", "password": "longenough1",
    })
    assert r.status_code == 422, r.text


def test_register_short_password_422(client):
    # pydantic min_length=8 rejects before any DB work.
    r = client.post("/api/auth/register", json={
        "code": "131113", "name": "Short PW", "email": "short@firm.com", "password": "short",
    })
    assert r.status_code == 422, r.text


def test_login_roundtrip(client):
    client.post("/api/auth/register", json={
        "code": "131113", "name": "Lee Loan", "email": "lee@firm.com", "password": "correctpassword",
    })
    client.post("/api/auth/logout")
    client.cookies.clear()
    # Email match is case-insensitive.
    r = client.post("/api/auth/login", json={"email": "Lee@firm.com", "password": "correctpassword"})
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "profile"
    assert client.get("/api/auth/me").json()["full_name"] == "Lee Loan"


def test_login_wrong_password_401(client):
    client.post("/api/auth/register", json={
        "code": "131113", "name": "Wrong PW", "email": "wrong@firm.com", "password": "rightpassword",
    })
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "wrong@firm.com", "password": "nopepassword"})
    assert r.status_code == 401, r.text


def test_login_unknown_email_401(client):
    # No such account → still a generic 401 (no user enumeration).
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "ghost@firm.com", "password": "whatever123"})
    assert r.status_code == 401, r.text
