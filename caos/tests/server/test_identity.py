"""Edge-proxy identity trust (W1) — forged X-Forwarded-* headers must not be
trusted when the app is reachable directly. When EDGE_PROXY_SECRET is set, a
deployed-context request must carry a matching X-Edge-Authorization."""

from __future__ import annotations

import time

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers


def _req(headers: dict, cookies: dict | None = None):
    """Minimal stand-in for a Starlette Request — get_identity reads .headers.get()
    and .cookies.get(); Headers is case-insensitive like the real thing."""

    class _R:
        pass

    r = _R()
    r.headers = Headers(headers)
    r.cookies = cookies or {}
    return r


class _FakeDB:
    """Stand-in for the AsyncSession get_identity now depends on. Returns the one
    analyst it was seeded with (for the cookie/revocation branch); None otherwise."""

    def __init__(self, analyst=None):
        self._analyst = analyst

    async def get(self, _model, pk):
        a = self._analyst
        return a if (a is not None and a.id == pk) else None


def test_read_session_token_rejects_non_ascii_signature():
    # review run-2 #B6: a tampered signature segment with a non-ASCII char must reject
    # cleanly (None), not raise TypeError on str comparison → 500.
    from identity import make_session_token, read_session_token
    tok = make_session_token({"id": "a", "name": "A", "exp": 9_999_999_999}, "secret")
    raw, _good = tok.rsplit(".", 1)
    assert read_session_token(raw + ".café", "secret") is None
    assert read_session_token(tok, "secret") is not None  # the valid token still verifies


def _prod_settings(monkeypatch, **overrides):
    import identity
    from config import Settings

    s = Settings(environment="production", **overrides)
    monkeypatch.setattr(identity, "get_settings", lambda: s)
    return identity


@pytest.mark.asyncio
async def test_local_dev_no_enforcement(monkeypatch):
    """Outside a deployed context, header-less requests get the dev identity."""
    import identity
    from config import Settings

    monkeypatch.setattr(identity, "get_settings", lambda: Settings(environment="development"))
    # No cookie → the db dependency is never touched.
    assert (await identity.get_identity(_req({}), db=_FakeDB())).id == "local-dev"


@pytest.mark.parametrize(
    "env,expected",
    [
        ("development", False),  # the ONLY value that disables the guards
        ("production", True),
        ("prod", True),          # mistype must still fail closed (P-4)
        ("Production", True),    # case variant
        ("staging", True),
        ("", True),              # unset/empty → deployed, not open
    ],
)
def test_is_deployed_fails_closed(monkeypatch, env, expected):
    """config.is_deployed treats ANY environment != 'development' as deployed, so a
    typo/unset can't silently drop the edge/session/signup-code guards. Matches the
    cookie `secure` asymmetry in routes/auth.py."""
    import config

    monkeypatch.delenv("DATABRICKS_APP_PORT", raising=False)
    assert config.is_deployed(config.Settings(environment=env)) is expected


@pytest.mark.asyncio
async def test_mistyped_prod_env_still_fails_closed(monkeypatch):
    """A header-less request under environment='prod' (a typo for 'production') is
    still rejected — previously this fell through to the permissive dev identity
    because the gate keyed on the exact string 'production'. (P-4)"""
    import identity
    from config import Settings

    monkeypatch.delenv("DATABRICKS_APP_PORT", raising=False)
    monkeypatch.setattr(identity, "get_settings", lambda: Settings(environment="prod"))
    with pytest.raises(HTTPException) as e:
        await identity.get_identity(_req({}), db=_FakeDB())
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_edge_secret_required_when_configured(monkeypatch):
    identity = _prod_settings(monkeypatch, edge_proxy_secret="s3cr3t")

    # Valid edge credential + forwarded identity → resolves.
    ident = await identity.get_identity(
        _req({"x-forwarded-email": "a@x.com", "x-edge-authorization": "s3cr3t"}), db=_FakeDB()
    )
    assert ident.email == "a@x.com"

    # Forged identity WITHOUT the edge secret → 401, even though the X-Forwarded
    # headers are present (the whole point: a direct hit can't impersonate).
    with pytest.raises(HTTPException) as missing:
        await identity.get_identity(_req({"x-forwarded-email": "ceo@firm.com"}), db=_FakeDB())
    assert missing.value.status_code == 401

    # Wrong edge secret → 401.
    with pytest.raises(HTTPException) as wrong:
        await identity.get_identity(
            _req({"x-forwarded-email": "ceo@firm.com", "x-edge-authorization": "nope"}), db=_FakeDB()
        )
    assert wrong.value.status_code == 401

    # Non-ASCII edge header → 401, not a TypeError/500 (latin-1 header bytes).
    with pytest.raises(HTTPException) as nonascii:
        await identity.get_identity(
            _req({"x-forwarded-email": "ceo@firm.com", "x-edge-authorization": "sécret"}), db=_FakeDB()
        )
    assert nonascii.value.status_code == 401


@pytest.mark.asyncio
async def test_cookie_does_not_bypass_edge_secret(monkeypatch):
    """A profile cookie must NOT skip the edge-origin check: a deployed request
    with a valid cookie but no X-Edge-Authorization is still 401 (the check runs
    before cookie resolution)."""
    from database import Analyst

    identity = _prod_settings(monkeypatch, edge_proxy_secret="s3cr3t")
    token = identity.make_session_token(
        {"id": "x", "name": "X", "email": "", "exp": int(time.time()) + 60}, "dev-insecure-session-secret"
    )
    # Token carries no "v" → defaults to 0; seed a matching row (version 0).
    db = _FakeDB(Analyst(id="x", name="X", token_version=0))

    with pytest.raises(HTTPException) as e:
        await identity.get_identity(_req({}, cookies={identity.COOKIE_NAME: token}), db=db)
    assert e.value.status_code == 401

    # With the edge credential, the same cookie resolves to the profile.
    ident = await identity.get_identity(
        _req({"x-edge-authorization": "s3cr3t"}, cookies={identity.COOKIE_NAME: token}), db=db
    )
    assert ident.source == "profile" and ident.full_name == "X"


@pytest.mark.asyncio
async def test_revoked_token_version_rejected(monkeypatch):
    """If the analyst row's token_version is ahead of the token's (a logout bumped
    it), or the row is gone, the cookie is ignored and the caller is not a profile."""
    import identity
    from config import Settings
    from database import Analyst

    monkeypatch.setattr(identity, "get_settings", lambda: Settings(environment="development"))
    token = identity.make_session_token(
        {"id": "x", "name": "X", "email": "", "v": 0, "exp": int(time.time()) + 60}, "dev-insecure-session-secret"
    )

    # Row bumped to v1 → token v0 no longer matches → cookie ignored → dev fallback.
    bumped = _FakeDB(Analyst(id="x", name="X", token_version=1))
    ident = await identity.get_identity(_req({}, cookies={identity.COOKIE_NAME: token}), db=bumped)
    assert ident.source != "profile"

    # Missing row (e.g. GDPR-erased) → also ignored.
    gone = await identity.get_identity(_req({}, cookies={identity.COOKIE_NAME: token}), db=_FakeDB())
    assert gone.source != "profile"


@pytest.mark.asyncio
async def test_unset_secret_keeps_prior_fail_closed(monkeypatch):
    """With no secret, prod still rejects header-less requests (unchanged) but
    does not require X-Edge-Authorization (enforcement opt-in, no breakage)."""
    identity = _prod_settings(monkeypatch, edge_proxy_secret="")

    with pytest.raises(HTTPException) as e:
        await identity.get_identity(_req({}), db=_FakeDB())
    assert e.value.status_code == 401

    # Forwarded identity alone still works when enforcement is off.
    assert (await identity.get_identity(
        _req({"x-forwarded-email": "a@x.com"}), db=_FakeDB()
    )).email == "a@x.com"


def test_expired_token_rejected():
    """A token past its `exp` is rejected despite a valid signature (the browser
    max-age is only a hint); a fresh token and a legacy no-exp token are accepted."""
    import time

    import identity

    secret = "dev-insecure-session-secret"
    base = {"id": "x", "name": "X", "email": ""}

    expired = identity.make_session_token({**base, "exp": int(time.time()) - 1}, secret)
    assert identity.read_session_token(expired, secret) is None

    fresh = identity.make_session_token({**base, "exp": int(time.time()) + 60}, secret)
    assert identity.read_session_token(fresh, secret)["id"] == "x"

    legacy = identity.make_session_token(base, secret)  # no exp claim → now rejected (#32)
    assert identity.read_session_token(legacy, secret) is None


@pytest.mark.asyncio
async def test_profile_cookie_ignored_when_sso_principal_differs(monkeypatch):
    """#22: a valid profile cookie for Alice must NOT win when THIS request's SSO
    principal (X-Forwarded-Email) is Bob — the 30-day app cookie outlives the
    7-day proxy session, so a shared browser could otherwise act as a stale user.
    Resolve to Bob (proxy), not Alice; same-user still resolves to the cookie."""
    from types import SimpleNamespace

    ident = _prod_settings(monkeypatch, edge_proxy_secret="s3cr3t", session_secret="sek")
    alice = SimpleNamespace(id="alice-id", name="Alice", email="alice@firm.com", token_version=0, team_id=None)
    token = ident.make_session_token(
        {"id": "alice-id", "name": "Alice", "email": "alice@firm.com", "v": 0, "exp": int(time.time()) + 60}, "sek")
    db = _FakeDB(alice)

    cross = await ident.get_identity(
        _req({"x-forwarded-email": "bob@firm.com", "x-edge-authorization": "s3cr3t"},
             cookies={ident.COOKIE_NAME: token}), db=db)
    assert cross.source == "proxy"
    assert cross.email == "bob@firm.com"

    same = await ident.get_identity(
        _req({"x-forwarded-email": "alice@firm.com", "x-edge-authorization": "s3cr3t"},
             cookies={ident.COOKIE_NAME: token}), db=db)
    assert same.source == "profile"
    assert same.id == "alice-id"
