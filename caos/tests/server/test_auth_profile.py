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


def test_non_ascii_code_is_401_not_500(client):
    # SEAM4-2: a non-ASCII code used to hit compare_digest(str, str) → TypeError →
    # 500, which hid the probe from the 401 brute-force heuristic and spammed logs.
    # Bytes-mode compare rejects it cleanly as a wrong code (both /profile + /register).
    for path in ("/api/auth/profile", "/api/auth/register"):
        body = {"code": "café١٣", "name": "Probe"}
        if path.endswith("register"):  # RegisterRequest carries extra required fields
            body |= {"email": "probe@example.com",
                     "recovery_words": ["alpha", "bravo", "charlie"]}
        r = client.post(path, json=body)
        assert r.status_code == 401, (path, r.status_code, r.text)


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


def test_profile_name_control_chars_stripped(client):
    # Interior CR/LF in the display name must not be persisted/round-tripped raw
    # (S7 storage-boundary sweep — Analyst.name feeds identity + logs).
    r = client.post("/api/auth/profile", json={"code": "131113", "name": "Ev\r\nil Bob"})
    assert r.status_code == 201, r.text
    full = r.json()["full_name"]
    assert "\r" not in full and "\n" not in full and full == "Evil Bob"


def test_run_is_stamped_with_logged_in_analyst(client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    me = client.post("/api/auth/profile", json={"code": "131113", "name": "Eric Gub"}).json()
    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert run.status_code == 201, run.text
    assert run.json()["analyst_id"] == me["id"]  # logged with the run
    wait_for_run(client, run.json()["id"])  # drain (dedup guard)


def test_empty_access_code_fails_closed(client, monkeypatch):
    # An unset access code must refuse login (503), not admit callers. S2.
    from config import get_settings
    monkeypatch.setattr(get_settings(), "analyst_signup_code", "")
    r = client.post("/api/auth/profile", json={"code": "131113", "name": "Nobody"})
    assert r.status_code == 503, r.text


def test_cookie_secure_off_in_dev_on_when_deployed(client, monkeypatch):
    # Secure rides on env != "development", not the exact label "production". S5.
    from config import get_settings
    s = get_settings()

    monkeypatch.setattr(s, "environment", "development")
    dev = client.post("/api/auth/profile", json={"code": "131113", "name": "Dev User"})
    assert "secure" not in (dev.headers.get("set-cookie") or "").lower()

    monkeypatch.setattr(s, "environment", "staging")
    stg = client.post(
        "/api/auth/profile",
        json={"code": "131113", "name": "Stg User"},
        headers={"X-Forwarded-Email": "stg@example.com"}
    )
    assert "secure" in (stg.headers.get("set-cookie") or "").lower()


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


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/auth/profile", {"code": "131113", "name": "Throttle Profile"}),
        (
            "/api/auth/register",
            {
                "code": "131113",
                "name": "Throttle Register",
                "email": "throttle-register@example.com",
                "passcode": "longenough1",
                "recovery_words": ["alpha", "bravo", "charlie"],
            },
        ),
        (
            "/api/auth/login",
            {"email": "throttle-login@example.com", "passcode": "longenough1"},
        ),
        (
            "/api/auth/recover",
            {
                "email": "throttle-recover@example.com",
                "recovery_words": ["alpha", "bravo", "charlie"],
            },
        ),
    ],
)
@pytest.mark.parametrize("blocked_bucket", ["source", "global"])
def test_auth_02_performance_throttle_covers_every_credential_endpoint(
    client, monkeypatch, path, payload, blocked_bucket
):
    """auth-02: every credential lane must share both bounded throttle buckets."""
    from routes import auth

    calls: list[str] = []

    def fake_hit(key: str, *, max_attempts: int, window_seconds: int) -> bool:
        calls.append(key)
        assert max_attempts > 0
        assert window_seconds == 60
        return key != ("login:*" if blocked_bucket == "global" else "login:testclient")

    monkeypatch.setattr(auth.rate_limit, "hit", fake_hit)
    response = client.post(path, json=payload)

    assert response.status_code == 429, (path, blocked_bucket, response.text)
    assert response.json()["detail"] == "Too many attempts — wait a minute."
    if blocked_bucket == "source":
        assert calls == ["login:testclient"]  # short-circuit preserves global budget
    else:
        assert calls == ["login:testclient", "login:*"]


def test_auth_02_boundary_condition_allows_ten_then_blocks_eleventh(client):
    """auth-02: the implemented per-source fixed-window boundary is exactly 10."""
    import rate_limit

    rate_limit.reset()
    headers = {"X-Forwarded-For": "203.0.113.9"}
    payload = {"code": "wrong-code", "name": "Boundary Probe"}

    first_ten = [
        client.post("/api/auth/profile", json=payload, headers=headers).status_code
        for _ in range(10)
    ]
    eleventh = client.post("/api/auth/profile", json=payload, headers=headers)

    assert first_ten == [401] * 10
    assert eleventh.status_code == 429
    assert eleventh.json()["detail"] == "Too many attempts — wait a minute."
