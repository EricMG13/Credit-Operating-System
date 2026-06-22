"""In-app analyst login: code-gated profile creation, cookie identity, run stamp."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_me_before_login_is_not_a_profile(client):
    # Local dev with no cookie → the resolved identity is the dev fallback, not a
    # profile, so the frontend would show the login landing.
    me = client.get("/api/auth/me").json()
    assert me["source"] != "profile"


def test_wrong_code_rejected(client):
    # 401 (not 403) so the access-log brute-force heuristic (401-by-source) sees it.
    r = client.post("/api/auth/profile", json={"code": "000000", "name": "Nope"})
    assert r.status_code == 401, r.text
    assert "code" in r.json()["detail"].lower()


def test_create_profile_sets_identity_and_initials_source(client):
    r = client.post("/api/auth/profile", json={"code": "131113", "name": "Eric Gub"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["source"] == "profile"
    assert body["full_name"] == "Eric Gub"
    # Cookie now drives /me on this client (TestClient persists Set-Cookie).
    me = client.get("/api/auth/me").json()
    assert me["source"] == "profile"
    assert me["full_name"] == "Eric Gub"
    assert me["id"] == body["id"]


def test_run_is_stamped_with_logged_in_analyst(client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    me = client.post("/api/auth/profile", json={"code": "131113", "name": "Eric Gub"}).json()
    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert run.status_code == 201, run.text
    assert run.json()["analyst_id"] == me["id"]  # logged with the run
    wait_for_run(client, run.json()["id"])  # drain (dedup guard)


def test_reattach_to_existing_profile_keeps_one_id(client):
    # Same name (case-insensitive) re-attaches to the same profile rather than
    # minting a new one — so re-logins don't burn the cap.
    a = client.post("/api/auth/profile", json={"code": "131113", "name": "Dana Vance"}).json()
    b = client.post("/api/auth/profile", json={"code": "131113", "name": "dana vance"}).json()
    assert a["id"] == b["id"]


def test_sso_email_binds_profile_and_blocks_impersonation(client):
    # Behind the proxy the profile is keyed on the verified X-Forwarded-Email:
    # same email re-attaches (rename allowed), and a different email can't adopt
    # another analyst's display name.
    h = {"X-Forwarded-Email": "alice@corp.com"}
    a = client.post("/api/auth/profile", json={"code": "131113", "name": "Alice A"}, headers=h).json()
    a2 = client.post("/api/auth/profile", json={"code": "131113", "name": "Alice Anderson"}, headers=h).json()
    assert a2["id"] == a["id"]  # same SSO email → one stable profile
    assert a2["full_name"] == "Alice Anderson"  # renamed own profile
    assert a2["email"] == "alice@corp.com"

    mallory = {"X-Forwarded-Email": "mallory@corp.com"}
    r = client.post("/api/auth/profile", json={"code": "131113", "name": "Alice Anderson"}, headers=mallory)
    assert r.status_code == 409, r.text  # can't impersonate Alice's display name


def test_logout_clears_identity(client):
    client.post("/api/auth/profile", json={"code": "131113", "name": "Eric Gub"})
    assert client.get("/api/auth/me").json()["source"] == "profile"
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.clear()  # mirror the browser dropping the cleared cookie
    assert client.get("/api/auth/me").json()["source"] != "profile"
