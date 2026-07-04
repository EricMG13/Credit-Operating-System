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

import asyncio
import hmac
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from access_log import client_source, sanitize_field
from config import get_settings
from database import Analyst, erase_analyst_data, get_db
from identity import (
    COOKIE_NAME, CallerIdentity, get_identity, make_session_token, read_session_token,
)
from passwords import hash_password, verify_password

router = APIRouter()

_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
_LOGIN_MAX_PER_MINUTE = 10  # per source IP — throttle access-code / password guessing
# Absolute ceiling across ALL sources. The first X-Forwarded-For hop is
# caller-supplied, so off-proxy an attacker can rotate it to a fresh per-source
# bucket every request and never trip the per-IP cap; this global bucket is the
# un-spoofable backstop on brute-force against the shared code / passwords.
_LOGIN_GLOBAL_PER_MINUTE = 30

# Loose shape check, not RFC-5322 — email is a login key, not verified. Swap to
# pydantic EmailStr if you ever add the email-validator dependency.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Verify a login against this when no account matches, so a missing email and a
# wrong password cost the same PBKDF2 work — no user enumeration via timing.
_DUMMY_HASH = hash_password("caos-no-such-account")
# Three dummies for the recovery lane — verifying against these when no account
# matches costs the same PBKDF2 work as three real words, so /recover can't leak
# account existence by returning fast.
_DUMMY_RECOVERY_HASHES = [_DUMMY_HASH, _DUMMY_HASH, _DUMMY_HASH]


def _throttle(request: Request) -> None:
    """Per-source + global rate limit shared by every credential endpoint. `or`
    short-circuits so a blocked source doesn't also drain the global budget."""
    ip = client_source(request.headers, request.client.host if request.client else None)
    if (not rate_limit.hit(f"login:{ip}", max_attempts=_LOGIN_MAX_PER_MINUTE, window_seconds=60)
            or not rate_limit.hit("login:*", max_attempts=_LOGIN_GLOBAL_PER_MINUTE, window_seconds=60)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts — wait a minute.")


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


class RegisterRequest(BaseModel):
    code: str = Field(min_length=1, max_length=64)  # shared invite code (ANALYST_SIGNUP_CODE)
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    passcode: Optional[str] = Field(default=None, min_length=8, max_length=128)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    coverage_area: Optional[str] = Field(default=None, max_length=64)
    location: Optional[str] = Field(default=None, max_length=16)
    # Exactly 3 words, declared at the schema (not just the handler's 422) so the
    # required-in-practice contract is visible in OpenAPI (BE7-2).
    recovery_words: list[str] = Field(min_length=3, max_length=3)
    recovery_hints: list[str] = Field(default_factory=list, max_length=3)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    passcode: Optional[str] = Field(default=None, min_length=1, max_length=128)
    password: Optional[str] = Field(default=None, min_length=1, max_length=128)


class RecoveryRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    recovery_words: list[str] = Field(min_length=3, max_length=3)


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
    # Stamp a hard expiry into the signed payload (enforced in read_session_token),
    # not just the browser max-age — so a copied cookie value can't outlive it.
    now = int(time.time())
    token = make_session_token(
        {
            "id": analyst.id, "name": analyst.name, "email": analyst.email or "",
            # Revocation epoch — must match the row at verify time (identity.py).
            "v": analyst.token_version,
            "iat": now, "exp": now + _COOKIE_MAX_AGE,
        },
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


def _passcode(body: RegisterRequest | LoginRequest) -> str:
    code = body.passcode or body.password or ""
    if not code:
        raise HTTPException(422, "Passcode is required.")
    return code


def _recovery_hashes(words: list[str]) -> list[str]:
    cleaned = [sanitize_field(w).strip().lower() for w in words]
    if len(cleaned) != 3 or any(not w for w in cleaned):
        raise HTTPException(422, "Three recovery words are required.")
    return [hash_password(w) for w in cleaned]


def _recovery_ok(words: list[str], hashes: list[str]) -> bool:
    cleaned = [sanitize_field(w).strip().lower() for w in words]
    if len(cleaned) != 3 or len(hashes or []) != 3:
        return False
    # Non-short-circuiting: verify all three regardless of an earlier mismatch, so
    # response time can't leak how many leading words were correct (all() would stop
    # at the first wrong word).
    return sum(verify_password(w, h) for w, h in zip(cleaned, hashes)) == 3


@router.post("/profile", response_model=MeResponse, status_code=201)
async def create_profile(
    body: ProfileCreate, request: Request, response: Response,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()

    _throttle(request)

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
        raise HTTPException(422, "Name is required.")

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


@router.post("/register", response_model=MeResponse, status_code=201)
async def register(
    body: RegisterRequest, request: Request, response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Email + password self-registration, gated by the shared invite code. Creates
    an Analyst with a PBKDF2 password hash and mints the profile cookie. Independent
    of edge SSO — this is the lane for callers who don't sign in through the proxy."""
    settings = get_settings()
    _throttle(request)

    if not settings.analyst_signup_code:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Sign-up disabled — invite code not configured."
        )
    # 401 (not 403) on a wrong code so the access-log brute-force heuristic sees it.
    if not hmac.compare_digest(body.code, settings.analyst_signup_code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid invite code.")

    name = sanitize_field(body.name).strip()
    email = sanitize_field(body.email).strip().lower()  # lowercase = the account key
    if not name:
        raise HTTPException(422, "Name is required.")
    if not _EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    # SECURITY.md §1: behind the edge proxy every caller carries a verified
    # X-Forwarded-Email. Self-registration must resolve only to the caller's own SSO
    # identity — a body email naming a different account is impersonation: it seeds a
    # row the named colleague silently adopts on their first SSO login (create_profile
    # re-attaches by email). Reject the mismatch; absent proxy (dev) this is a no-op.
    sso_email = request.headers.get("x-forwarded-email")
    if sso_email and sanitize_field(sso_email).strip().lower() != email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email must match your signed-in identity.")

    # Friendly pre-check: the unique email index is the real guard, but it's
    # case-sensitive, so match the same lowercased form we store.
    existing = (await db.execute(
        select(Analyst).where(func.lower(Analyst.email) == email)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with that email already exists — sign in instead."
        )

    # Four PBKDF2 hashes (password + 3 recovery words) — off-thread so registration
    # doesn't block the event loop for ~2M iterations. _recovery_hashes validates
    # word count and raises HTTPException(422), which propagates cleanly through
    # to_thread.
    password_hash = await asyncio.to_thread(hash_password, _passcode(body))
    recovery_word_hashes = await asyncio.to_thread(_recovery_hashes, body.recovery_words)
    analyst = Analyst(
        name=name,
        email=email,
        password_hash=password_hash,
        coverage_area=sanitize_field(body.coverage_area or "").strip() or None,
        location=sanitize_field(body.location or "").strip() or None,
        recovery_word_hashes=recovery_word_hashes,
        recovery_hints=[sanitize_field(h).strip()[:160] for h in body.recovery_hints[:3]],
    )
    db.add(analyst)
    try:
        await db.commit()
    except IntegrityError:  # display name taken, or a racing email registration
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That name or email is already taken — pick another."
        )

    _set_cookie(response, analyst)
    return _profile_response(analyst)


@router.post("/login", response_model=MeResponse)
async def login(
    body: LoginRequest, request: Request, response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Email + password sign-in for a registered account. Mints the profile cookie
    on success; 401 otherwise."""
    _throttle(request)
    email = sanitize_field(body.email).strip().lower()
    analyst = (await db.execute(
        select(Analyst).where(func.lower(Analyst.email) == email)
    )).scalar_one_or_none()

    # Always run a verify (dummy hash when no row, or an SSO-only row with no
    # password) so a missing email and a wrong password take the same time — no
    # user enumeration via timing. Compute `ok` unconditionally before branching.
    stored = analyst.password_hash if analyst else None
    # PBKDF2 (600k iters) is CPU-bound; off-thread it so a login can't stall the
    # single event loop for every other request (and so a burst of login attempts
    # can't be used to peg it). Same posture as the upload-parse off-threading.
    ok = await asyncio.to_thread(verify_password, _passcode(body), stored or _DUMMY_HASH)
    if not ok or analyst is None:
        # 401 (not 403) feeds the access-log brute-force heuristic. Generic message.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    _set_cookie(response, analyst)
    return _profile_response(analyst)


@router.post("/recover", response_model=MeResponse)
async def recover_login(
    body: RecoveryRequest, request: Request, response: Response,
    db: AsyncSession = Depends(get_db),
):
    _throttle(request)
    email = sanitize_field(body.email).strip().lower()
    analyst = (await db.execute(
        select(Analyst).where(func.lower(Analyst.email) == email)
    )).scalar_one_or_none()
    # Verify against three hashes whether or not the account exists — the row's when
    # present, dummies otherwise — so a missing email costs the same scrypt work as
    # wrong words. No user enumeration via timing; mirrors the /login lane above.
    stored = (analyst.recovery_word_hashes if analyst else None) or _DUMMY_RECOVERY_HASHES
    # Three PBKDF2 verifies — off-thread (see /login) so recovery can't peg the loop.
    ok = await asyncio.to_thread(_recovery_ok, body.recovery_words, stored)
    if not ok or analyst is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Recovery failed — contact admin.")
    _set_cookie(response, analyst)
    return _profile_response(analyst)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Revoke + clear. Bumping the analyst's token_version invalidates every existing
    # token for them — this device and any other — on its next request (the version
    # is signed into the cookie and re-checked in identity.get_identity). Read the
    # cookie directly rather than via get_identity, so logout still works (and still
    # revokes) even for an otherwise-rejected request, and never errors on a stale
    # or absent cookie.
    settings = get_settings()
    token = request.cookies.get(COOKIE_NAME)
    if token:
        data = read_session_token(token, settings.session_secret)
        if data and data.get("id"):
            analyst = await db.get(Analyst, sanitize_field(data["id"]))
            if analyst is not None:
                analyst.token_version += 1
                await db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")


@router.delete("/profile", status_code=200)
async def delete_profile(
    response: Response,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
):
    """Self-service GDPR erasure (right to be forgotten).

    The signed-in analyst deletes their own profile (name + email PII) and their
    private Deep Research jobs, and anonymizes their attribution on shared runs
    and uploaded documents (the desk's analysis is firm work product — kept, just
    de-linked). Clears the session cookie. Only ever erases the *caller's own*
    data, so it needs no admin role. Offboarding a *departed* analyst (who can no
    longer sign in) requires an operator path / RBAC that does not exist yet.
    """
    summary = await erase_analyst_data(db, analyst_id=caller.id, email=caller.email or None)
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"erased": summary}
