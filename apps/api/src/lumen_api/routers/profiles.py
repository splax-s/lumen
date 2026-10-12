"""Learner profiles: create, change, export and delete."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from ..deps import Account, Cache, Db, Principal, profile_for
from ..models import LearnerProfile
from ..schemas import ProfileIn, ProfileOut, ProfilePatch
from ..services.entitlements import MAX_PROFILES
from ..services.export import export_profile
from ..sessions import end_all_sessions

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
async def list_profiles(account: Account, db: Db) -> list[LearnerProfile]:
    rows = await db.scalars(
        select(LearnerProfile)
        .where(LearnerProfile.parent_id == account.id)
        .order_by(LearnerProfile.created_at)
    )
    return list(rows)


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(body: ProfileIn, account: Account, db: Db) -> LearnerProfile:
    count = await db.scalar(select(func.count()).where(LearnerProfile.parent_id == account.id))
    if (count or 0) >= MAX_PROFILES:
        raise HTTPException(status.HTTP_409_CONFLICT, "too_many_profiles")
    profile = LearnerProfile(
        parent_id=account.id,
        nickname=body.nickname,
        avatar=body.avatar,
        birth_year_band=body.birth_year_band,
        default_depth=body.default_depth,
        # Under-13s get no free-text chat until a parent unlocks it.
        chat_unlocked=body.birth_year_band != "under_13",
    )
    db.add(profile)
    await db.flush()
    return profile


@router.patch("/{profile_id}", response_model=ProfileOut)
async def update_profile(
    profile_id: uuid.UUID, body: ProfilePatch, account: Account, db: Db
) -> LearnerProfile:
    profile = await profile_for(db, Principal(kind="account", account=account), profile_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, field, value)
    await db.flush()
    return profile


@router.get("/{profile_id}/export")
async def export(profile_id: uuid.UUID, account: Account, db: Db) -> dict[str, Any]:
    """Everything stored about this profile, as JSON (the right to a copy of your data)."""
    profile = await profile_for(db, Principal(kind="account", account=account), profile_id)
    return await export_profile(db, profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(profile_id: uuid.UUID, account: Account, db: Db, redis: Cache) -> None:
    """Deletes the profile and, through cascading deletes, every row that refers to it."""
    profile = await profile_for(db, Principal(kind="account", account=account), profile_id)
    await db.delete(profile)
    await end_all_sessions(redis, profile_id)
