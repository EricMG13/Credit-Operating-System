"""Logout revokes existing tokens via the token_version bump: a cookie captured
before logout no longer resolves to a profile afterwards (end-to-end)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_logout_revokes_prior_token(client):
    r = client.post("/api/auth/profile", json={"code": "131113", "name": "Revoke Me"})
    assert r.status_code == 201, r.text
    old = client.cookies.get("caos_analyst")  # the just-minted token
    assert old

    # Pre-logout: the cookie resolves to a profile.
    assert client.get("/api/auth/me").json()["source"] == "profile"

    # Logout bumps the analyst's token_version and clears the client cookie.
    assert client.post("/api/auth/logout").status_code == 204

    # Re-attach the captured (now stale) cookie: token v < row v → ignored.
    client.cookies.set("caos_analyst", old)
    assert client.get("/api/auth/me").json()["source"] != "profile"
