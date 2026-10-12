"""Things routes depend on: the database session, Redis, and who is signed in."""

import uuid
from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import Cookie, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings, get_settings
from .db import get_session
from .models import LearnerProfile, ParentAccount, SchoolClass
from .sessions import COOKIE, read_session

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


Db = Annotated[AsyncSession, Depends(get_session)]
Cache = Annotated[Redis, Depends(get_redis)]
Config = Annotated[Settings, Depends(get_settings)]


@dataclass
class Principal:
    """Whoever is making the request: an adult account, or a pupil who joined a class."""

    kind: Literal["account", "pupil"]
    account: ParentAccount | None = None
    profile: LearnerProfile | None = None

    @property
    def rate_key(self) -> str:
        if self.account is not None:
            return f"account:{self.account.id}"
        return f"pupil:{self.profile.id if self.profile else 'unknown'}"


async def optional_principal(
    db: Db, redis: Cache, token: Annotated[str | None, Cookie(alias=COOKIE)] = None
) -> Principal | None:
    data = await read_session(redis, token)
    if data is None:
        return None
    if data.kind == "account":
        account = await db.get(ParentAccount, data.subject_id)
        return Principal(kind="account", account=account) if account else None
    profile = await db.get(LearnerProfile, data.subject_id)
    return Principal(kind="pupil", profile=profile) if profile else None


MaybePrincipal = Annotated[Principal | None, Depends(optional_principal)]


async def require_principal(principal: MaybePrincipal) -> Principal:
    if principal is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not_signed_in")
    return principal


SignedIn = Annotated[Principal, Depends(require_principal)]


async def require_account(principal: SignedIn) -> ParentAccount:
    if principal.account is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "adults_only")
    return principal.account


Account = Annotated[ParentAccount, Depends(require_account)]

STAFF_LEVELS = {"support": 1, "admin": 2}


def require_staff(level: Literal["support", "admin"] = "support"):  # type: ignore[no-untyped-def]
    """Only staff at this level or above may pass. Used by every ops console route."""

    async def check(principal: MaybePrincipal) -> ParentAccount:
        if principal is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not_signed_in")
        account = principal.account
        if account is None or account.staff_level not in STAFF_LEVELS:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "staff_only")
        if STAFF_LEVELS[account.staff_level] < STAFF_LEVELS[level]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "admin_only")
        return account

    return check


async def profile_for(db: AsyncSession, principal: Principal, profile_id: uuid.UUID) -> LearnerProfile:
    """The profile, if this person may act as it. Anything else is reported as not found."""
    not_found = HTTPException(status.HTTP_404_NOT_FOUND, "profile_not_found")
    if principal.kind == "pupil":
        if principal.profile is None or principal.profile.id != profile_id:
            raise not_found
        return principal.profile
    profile = await db.get(LearnerProfile, profile_id)
    if profile is None or principal.account is None or profile.parent_id != principal.account.id:
        raise not_found
    return profile


async def profile_readable_by(
    db: AsyncSession, account: ParentAccount, profile_id: uuid.UUID
) -> LearnerProfile:
    """A profile a parent owns, or a pupil in one of a teacher's classes."""
    not_found = HTTPException(status.HTTP_404_NOT_FOUND, "profile_not_found")
    profile = await db.get(LearnerProfile, profile_id)
    if profile is None:
        raise not_found
    if profile.parent_id == account.id:
        return profile
    if profile.class_id is not None:
        owned = await db.scalar(
            select(SchoolClass.id).where(
                SchoolClass.id == profile.class_id, SchoolClass.teacher_id == account.id
            )
        )
        if owned is not None:
            return profile
    raise not_found
