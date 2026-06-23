"""Identity + in-app analyst login.

Network access is governed at the edge (Caddy + oauth2-proxy on the self-hosted
stack; the app publishes no port). On top of that, analysts hold a named profile;
the profile is the app-level identity — its initials show across the UI and its
id is stamped on every run.

Behind SSO the profile is keyed on the verified X-Forwarded-Email, so a caller
can only ever resolve to their own profile (rename allowed, impersonation not).
On a proxy-less / local run the profile is keyed on name alone. /me reflects the
active identity; /profile creates (or re-attaches to) a profile and sets the
signed cookie; /logout clears it.
"""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from access_log import client_source, sanitize_field
from config import get_settings
from database import Analyst, get_db
from identity import COOKIE_NAME, CallerIdentity, get_identity, make_session_token

router = APIRouter()

_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
_LOGIN_MAX_PER_MINUTE = 10  # per source IP — throttle access-code guessing


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    source: str  # "profile" | "proxy" | "local" — frontend gates the login landing on this


class ProfileCreate(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)


@router.get("/me", response_model=MeResponse)
async def me(caller: CallerIdentity = Depends(get_identity)):
    return MeResponse(
        id=caller.id,
        email=caller.email,
        full_name=caller.full_name,
        role=caller.role,
        is_active=caller.is_active,
        source=caller.source,
    )


def _set_cookie(response: Response, analyst: Analyst) -> None:
    settings = get_settings()
    token = make_session_token(
        {"id": analyst.id, "name": analyst.name, "email": analyst.email or ""},
        settings.session_secret,
    )
    response.set_cookie(
        COOKIE_NAME, token,
        max_age=_COOKIE_MAX_AGE, httponly=True, samesite="lax",
        # Secure on any non-local-dev deployment — not only the exact label
        # "production", so an env-string mistype can't silently drop it. S5.
        secure=settings.environment != "development", path="/",
    )


def _profile_response(analyst: Analyst) -> MeResponse:
    return MeResponse(
        id=analyst.id, email=analyst.email or "", full_name=analyst.name,
        role="analyst", is_active=True, source="profile",
    )


@router.post("/profile", response_model=MeResponse, status_code=201)
async def create_profile(
    body: ProfileCreate, request: Request, response: Response,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()

    # Throttle by source IP so the shared access code can't be brute-forced.
    ip = client_source(request.headers, request.client.host if request.client else None)
    if not rate_limit.hit(f"login:{ip}", max_attempts=_LOGIN_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts — wait a minute.")

    # Fail closed if the access code is unset: an empty setting would make
    # compare_digest admit any caller the moment the body min_length guard is
    # ever relaxed. Refuse login outright rather than degrade silently. S2.
    if not settings.analyst_signup_code:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Login disabled — access code not configured."
        )

    # 401 (not 403) on a wrong code so the access-log brute-force heuristic
    # (401-by-source) sees it. Constant-time compare.
    if not hmac.compare_digest(body.code, settings.analyst_signup_code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid access code.")

    # Strip interior control chars before persistence — body.name and the
    # forwarded email become Analyst rows and round-trip through identity/logging.
    # Matches the sanitize done in identity.get_identity. S7.
    name = sanitize_field(body.name).strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Name is required.")

    # The edge proxy sets X-Forwarded-Email from the verified session (trustworthy
    # because the proxy is the sole ingress). When present, key the profile on it:
    # one profile per SSO identity, so a caller can't adopt someone else's name.
    sso_email = request.headers.get("x-forwarded-email")
    if sso_email:
        sso_email = sanitize_field(sso_email)
    if sso_email:
        analyst = (await db.execute(
            select(Analyst).where(Analyst.email == sso_email)
        )).scalar_one_or_none()
        if analyst is None:
            analyst = Analyst(name=name, email=sso_email)
            db.add(analyst)
        elif analyst.name != name:
            analyst.name = name  # rename own profile
        try:
            await db.commit()
        except IntegrityError:  # display name already taken by another email
            await db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "That display name is taken — pick another.")
    else:
        # Proxy-less / local: re-attach by (case-insensitive) name, else create.
        analyst = (await db.execute(
            select(Analyst).where(func.lower(Analyst.name) == name.lower())
        )).scalar_one_or_none()
        if analyst is None:
            analyst = Analyst(name=name)
            db.add(analyst)
            await db.commit()

    _set_cookie(response, analyst)
    return _profile_response(analyst)


@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
