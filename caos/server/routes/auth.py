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
import secrets
import time
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from access_log import client_source, sanitize_field
from config import get_settings, is_deployed
from csrf import CSRF_COOKIE_NAME
from database import (
    Analyst,
    case_insensitive_email_match,
    erase_analyst_data,
    get_db,
)
from identity import (
    COOKIE_NAME,
    CallerIdentity,
    get_identity,
    make_session_token,
    normalize_email_identity,
    read_session_token,
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

# Verify a login against this when no account matches, so a missing email and a
# wrong password cost the same PBKDF2 work — no user enumeration via timing.
_DUMMY_HASH = hash_password("caos-no-such-account")
# Three dummies for the recovery lane — verifying against these when no account
# matches costs the same PBKDF2 work as three real words, so /recover can't leak
# account existence by returning fast.
_DUMMY_RECOVERY_HASHES = [_DUMMY_HASH, _DUMMY_HASH, _DUMMY_HASH]

_RecoveryWord = Annotated[str, Field(min_length=1, max_length=80)]
_RecoveryHint = Annotated[str, Field(max_length=160)]


def _throttle(request: Request) -> None:
    """Per-source + global rate limit shared by every credential endpoint. `or`
    short-circuits so a blocked source doesn't also drain the global budget."""
    ip = client_source(request.headers, request.client.host if request.client else None)
    if (not rate_limit.shared_hit(f"login:{ip}", max_attempts=_LOGIN_MAX_PER_MINUTE, window_seconds=60)
            or not rate_limit.shared_hit("login:*", max_attempts=_LOGIN_GLOBAL_PER_MINUTE, window_seconds=60)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts — wait a minute.")


def _is_valid_email(value: str) -> bool:
    """Bounded structural validation without a backtracking regular expression."""
    if len(value) > 254 or value.count("@") != 1 or any(ch.isspace() for ch in value):
        return False
    local, domain = value.split("@", 1)
    labels = domain.split(".")
    return bool(local) and len(local) <= 64 and len(labels) >= 2 and all(labels)


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
    passcode: Optional[str] = Field(default=None, min_length=12, max_length=128)
    password: Optional[str] = Field(default=None, min_length=12, max_length=128)
    coverage_area: Optional[str] = Field(default=None, max_length=64)
    location: Optional[str] = Field(default=None, max_length=16)
    # Exactly 3 words, declared at the schema (not just the handler's 422) so the
    # required-in-practice contract is visible in OpenAPI (BE7-2).
    recovery_words: list[_RecoveryWord] = Field(min_length=3, max_length=3)
    recovery_hints: list[_RecoveryHint] = Field(default_factory=list, max_length=3)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    passcode: Optional[str] = Field(default=None, min_length=1, max_length=128)
    password: Optional[str] = Field(default=None, min_length=1, max_length=128)


class RecoveryRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    recovery_words: list[_RecoveryWord] = Field(min_length=3, max_length=3)


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
    csrf_token = secrets.token_urlsafe(32)
    token = make_session_token(
        {
            "id": analyst.id, "name": analyst.name, "email": analyst.email or "",
            "role": analyst.role or "analyst",
            # Revocation epoch — must match the row at verify time (identity.py).
            "v": analyst.token_version,
            # Bind the browser-readable double-submit value to this signed
            # session so an attacker cannot choose both cookie and header.
            "csrf": csrf_token,
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
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_token,
        max_age=_COOKIE_MAX_AGE,
        httponly=False,
        samesite="lax",
        secure=settings.environment != "development",
        path="/",
    )


def _profile_response(analyst: Analyst) -> MeResponse:
    return MeResponse(
        id=analyst.id, email=analyst.email or "", full_name=analyst.name,
        role=analyst.role or "analyst", is_active=True, source="profile",
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
async def create_profile(  # noqa: C901 — cohesive login flow (code gate + SSO bind/adopt + credential revoke + cookie); extracting would fragment the auth path
    body: ProfileCreate, request: Request, response: Response,
    db: AsyncSession = Depends(get_db, scope="function"),
):
    settings = get_settings()
    sso_email = request.headers.get("x-forwarded-email")
    sso_user = request.headers.get("x-forwarded-user")

    if is_deployed(settings) and not (sso_email or sso_user):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "No forwarded identity — request did not pass the auth proxy / edge."
        )

    _throttle(request)

    code = settings.analyst_signup_code
    if not code:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Login disabled — access code not configured."
        )

    if not hmac.compare_digest(body.code.encode("utf-8", "ignore"), code.encode("utf-8")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid access code.")

    name = sanitize_field(body.name).strip()
    if not name:
        raise HTTPException(422, "Name is required.")

    if sso_email:
        sso_email = normalize_email_identity(sso_email)
        matching_analysts = list(
            (
                await db.execute(
                    select(Analyst)
                    .where(
                        case_insensitive_email_match(
                            db,
                            Analyst.email,
                            sso_email,
                        )
                    )
                    .order_by(Analyst.id)
                    .limit(2)
                )
            )
            .scalars()
            .all()
        )
        if len(matching_analysts) > 1:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Ambiguous analyst email identity; resolve duplicate profiles.",
            )
        analyst = matching_analysts[0] if matching_analysts else None
        if analyst is None:
            analyst = Analyst(name=name, email=sso_email)
            db.add(analyst)
        else:
            if analyst.email != sso_email:
                analyst.email = sso_email
            if analyst.name != name:
                analyst.name = name
            if analyst.password_hash or analyst.recovery_word_hashes:
                analyst.password_hash = None
                analyst.recovery_word_hashes = []
                analyst.token_version += 1
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "That display name is taken — pick another.")
    else:
        analyst = (await db.execute(select(Analyst).where(func.lower(Analyst.name) == name.lower()))).scalar_one_or_none()
        if analyst is None:
            analyst = Analyst(name=name)
            db.add(analyst)
            try:
                await db.commit()
            except IntegrityError:  # two concurrent creates with the same name
                # Same 409 the SSO branch returns — the bare commit surfaced a
                # 500 on this race (audit 2026-07-10 C4).
                await db.rollback()
                raise HTTPException(status.HTTP_409_CONFLICT, "That display name is taken — pick another.")

    _set_cookie(response, analyst)
    return _profile_response(analyst)


@router.post("/register", response_model=MeResponse, status_code=201)
async def register(
    body: RegisterRequest, request: Request, response: Response,
    db: AsyncSession = Depends(get_db, scope="function"),
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
    # Bytes-mode compare: a non-ASCII code would make compare_digest(str,str) raise
    # TypeError → 500 (hides the probe, spams logs). SEAM4-2, as in create_profile.
    if not hmac.compare_digest(
        body.code.encode("utf-8", "ignore"), settings.analyst_signup_code.encode("utf-8")
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid invite code.")

    name = sanitize_field(body.name).strip()
    email = sanitize_field(body.email).strip().lower()  # lowercase = the account key
    if not name:
        raise HTTPException(422, "Name is required.")
    if not _is_valid_email(email):
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
    db: AsyncSession = Depends(get_db, scope="function"),
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
    db: AsyncSession = Depends(get_db, scope="function"),
):
    _throttle(request)
    email = sanitize_field(body.email).strip().lower()
    analyst = (await db.execute(
        select(Analyst).where(func.lower(Analyst.email) == email)
    )).scalar_one_or_none()
    # Verify against three hashes whether or not the account exists — the row's when
    # present, dummies otherwise — so a missing email costs the same PBKDF2 work as
    # wrong words. No user enumeration via timing; mirrors the /login lane above.
    stored = (analyst.recovery_word_hashes if analyst else None) or _DUMMY_RECOVERY_HASHES
    # Three PBKDF2 verifies — off-thread (see /login) so recovery can't peg the loop.
    ok = await asyncio.to_thread(_recovery_ok, body.recovery_words, stored)
    if not ok or analyst is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Recovery failed — contact admin.")
    _set_cookie(response, analyst)
    return _profile_response(analyst)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db, scope="function")):
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
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")


@router.delete("/profile", status_code=200)
async def delete_profile(
    request: Request,
    response: Response,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Self-service GDPR erasure (right to be forgotten).

    The signed-in analyst deletes their own profile (name + email PII) and their
    private Deep Research jobs, and anonymizes their attribution on shared runs
    and uploaded documents (the desk's analysis is firm work product — kept, just
    de-linked). Clears the session cookie. Only ever erases the *caller's own*
    data, so it needs no admin role. Offboarding a *departed* analyst (who can no
    longer sign in) requires an operator path / RBAC that does not exist yet.
    """
    identity_aliases = {caller.id}
    forwarded_email = request.headers.get("x-forwarded-email")
    forwarded_principal = request.headers.get("x-forwarded-user") or forwarded_email
    # A valid profile cookie wins identity resolution, so caller.id is normally
    # the profile UUID even when the request also traversed the edge proxy. Add
    # the active historical proxy principal only when the verified edge email
    # names this same profile; a mismatched header must never broaden erasure.
    if (
        forwarded_email
        and forwarded_principal
        and caller.email
        and normalize_email_identity(forwarded_email)
        == normalize_email_identity(caller.email)
    ):
        identity_aliases.add(sanitize_field(forwarded_principal))

    summary = await erase_analyst_data(
        db,
        analyst_id=caller.profile_id or caller.id,
        email=caller.email or None,
        identity_aliases=tuple(identity_aliases),
    )
    response.delete_cookie(COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")
    return {"erased": summary}
