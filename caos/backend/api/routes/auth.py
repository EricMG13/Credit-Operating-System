"""Authentication routes — register, login, user profile."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.jwt import create_access_token, get_current_user, resolve_token_user
from core import rate_limit
from db.models import User
from db.session import get_db

router = APIRouter()
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Login rate limiting ──────────────────────────────────────────────────
# Redis-backed sliding-window counter; shared across all worker processes.
_LOGIN_MAX_ATTEMPTS = 5
_LOGIN_WINDOW_SECONDS = 60


async def _check_login_rate_limit(key: str) -> None:
    """Record an attempt for `key`; raise 429 if it exceeds the window budget."""
    allowed = await rate_limit.hit(
        f"login:{key}",
        max_attempts=_LOGIN_MAX_ATTEMPTS,
        window_seconds=_LOGIN_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again shortly.",
            headers={"Retry-After": str(_LOGIN_WINDOW_SECONDS)},
        )


# ─── Request / Response schemas ───────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Endpoints ────────────────────────────────────────────────────────────

_optional_bearer = HTTPBearer(auto_error=False)

# Arbitrary app-wide advisory-lock id for the register bootstrap section.
_REGISTER_LOCK_ID = 0xCA05


async def _bootstrap_or_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Register-gate policy:
    - When zero users exist, anyone may call /register (bootstrap of the
      first admin).
    - Once any user exists, /register requires a valid Bearer token from
      an admin account.

    Returns the calling admin (None on bootstrap) so the handler can decide
    role assignment.

    The zero-user check is serialized with a transaction-scoped advisory
    lock (held until the request's transaction commits, covering the
    INSERT) so two concurrent first-registers can't both become admin.
    """
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": _REGISTER_LOCK_ID})

    count = (await db.execute(select(func.count(User.id)))).scalar_one()
    if count == 0:
        return None  # bootstrap mode

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Registration is closed; an admin must invite new users.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await resolve_token_user(db, credentials.credentials)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    caller: User | None = Depends(_bootstrap_or_admin),
):
    """Create a new user account.

    First user (no caller) is provisioned as admin so the system has a
    bootstrap path. Every subsequent registration requires an admin token
    and creates an analyst.
    """
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=_pwd_context.hash(body.password),
        full_name=body.full_name,
        role="admin" if caller is None else "analyst",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate and return a JWT access token."""
    client_ip = request.client.host if request.client else "unknown"
    await _check_login_rate_limit(f"{client_ip}:{body.email.lower()}")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not _pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return current_user
