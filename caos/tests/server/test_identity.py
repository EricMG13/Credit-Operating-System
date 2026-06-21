"""Edge-proxy identity trust (W1) — forged X-Forwarded-* headers must not be
trusted when the app is reachable directly. When EDGE_PROXY_SECRET is set, a
deployed-context request must carry a matching X-Edge-Authorization."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers


def _req(headers: dict):
    """Minimal stand-in for a Starlette Request — get_identity only reads
    .headers.get(...), and Headers is case-insensitive like the real thing."""

    class _R:
        pass

    r = _R()
    r.headers = Headers(headers)
    return r


def _prod_settings(monkeypatch, **overrides):
    import identity
    from config import Settings

    s = Settings(environment="production", **overrides)
    monkeypatch.setattr(identity, "get_settings", lambda: s)
    return identity


def test_local_dev_no_enforcement(monkeypatch):
    """Outside a deployed context, header-less requests get the dev identity."""
    import identity
    from config import Settings

    monkeypatch.setattr(identity, "get_settings", lambda: Settings(environment="development"))
    assert identity.get_identity(_req({})).id == "local-dev"


def test_edge_secret_required_when_configured(monkeypatch):
    identity = _prod_settings(monkeypatch, edge_proxy_secret="s3cr3t")

    # Valid edge credential + forwarded identity → resolves.
    ident = identity.get_identity(
        _req({"x-forwarded-email": "a@x.com", "x-edge-authorization": "s3cr3t"})
    )
    assert ident.email == "a@x.com"

    # Forged identity WITHOUT the edge secret → 401, even though the X-Forwarded
    # headers are present (the whole point: a direct hit can't impersonate).
    with pytest.raises(HTTPException) as missing:
        identity.get_identity(_req({"x-forwarded-email": "ceo@firm.com"}))
    assert missing.value.status_code == 401

    # Wrong edge secret → 401.
    with pytest.raises(HTTPException) as wrong:
        identity.get_identity(
            _req({"x-forwarded-email": "ceo@firm.com", "x-edge-authorization": "nope"})
        )
    assert wrong.value.status_code == 401

    # Non-ASCII edge header → 401, not a TypeError/500 (latin-1 header bytes).
    with pytest.raises(HTTPException) as nonascii:
        identity.get_identity(
            _req({"x-forwarded-email": "ceo@firm.com", "x-edge-authorization": "sécret"})
        )
    assert nonascii.value.status_code == 401


def test_unset_secret_keeps_prior_fail_closed(monkeypatch):
    """With no secret, prod still rejects header-less requests (unchanged) but
    does not require X-Edge-Authorization (enforcement opt-in, no breakage)."""
    identity = _prod_settings(monkeypatch, edge_proxy_secret="")

    with pytest.raises(HTTPException) as e:
        identity.get_identity(_req({}))
    assert e.value.status_code == 401

    # Forwarded identity alone still works when enforcement is off.
    assert identity.get_identity(_req({"x-forwarded-email": "a@x.com"})).email == "a@x.com"
