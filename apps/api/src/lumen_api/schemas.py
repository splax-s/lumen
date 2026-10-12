"""Request and response shapes."""

import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

Depth = Literal["play", "explain", "deep"]
AgeBand = Literal["under_13", "13_15", "16_plus", "adult"]
Plan = Literal["free", "family", "school"]

LessonId = Annotated[str, StringConstraints(pattern=r"^[a-z]+\.[a-z0-9-]+$", max_length=64)]
Nickname = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
AVATARS = [f"lumi-{n}" for n in range(1, 9)]

# Letters (any language), digits, spaces, hyphens and apostrophes. No @ or dots, so not an email.
_NICKNAME = re.compile(r"^[^\W_]+(?:[ '\-][^\W_]+)*$", re.UNICODE)


_LONG_NUMBER = re.compile(r"\d{5,}")


def check_nickname(value: str) -> str:
    """A nickname is a first name or a made-up name. Not an email, a phone number or markup."""
    if not _NICKNAME.match(value) or _LONG_NUMBER.search(value):
        raise ValueError("Use letters, numbers and spaces only")
    return value


class Strict(BaseModel):
    """Rejects fields it does not know, so nothing extra can be stored by accident."""

    model_config = ConfigDict(extra="forbid")


class Consent(Strict):
    terms: Literal[True]
    privacy: Literal[True]
    is_adult: Literal[True]


class SignupIn(Strict):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    country: str = Field(pattern=r"^[A-Z]{2}$")
    consent: Consent
    role: Literal["user", "teacher"] = "user"


class LoginIn(Strict):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class AccountOut(BaseModel):
    id: uuid.UUID
    email: str
    country: str
    role: str
    plan: str
    staff_level: str | None


class ProfileIn(Strict):
    nickname: Nickname
    avatar: str = "lumi-1"
    birth_year_band: AgeBand
    default_depth: Depth = "play"

    @field_validator("nickname")
    @classmethod
    def nickname_is_a_name(cls, value: str) -> str:
        return check_nickname(value)

    @field_validator("avatar")
    @classmethod
    def avatar_is_known(cls, value: str) -> str:
        if value not in AVATARS:
            raise ValueError("Unknown avatar")
        return value


class ProfilePatch(Strict):
    nickname: Nickname | None = None
    avatar: str | None = None
    default_depth: Depth | None = None
    chat_unlocked: bool | None = None

    @field_validator("nickname")
    @classmethod
    def nickname_is_a_name(cls, value: str | None) -> str | None:
        return check_nickname(value) if value is not None else None

    @field_validator("avatar")
    @classmethod
    def avatar_is_known(cls, value: str | None) -> str | None:
        if value is not None and value not in AVATARS:
            raise ValueError("Unknown avatar")
        return value


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nickname: str
    avatar: str
    birth_year_band: str
    default_depth: str
    chat_unlocked: bool


class MeOut(BaseModel):
    kind: Literal["account", "pupil"]
    account: AccountOut | None
    profiles: list[ProfileOut]


class StepRecord(Strict):
    type: str = Field(max_length=16)
    wrong: int = Field(ge=0, le=1000)
    hintLevel: int = Field(ge=0, le=4)
    ms: int = Field(ge=0, le=86_400_000)


class AttemptStart(Strict):
    id: uuid.UUID
    profile_id: uuid.UUID
    lesson_id: LessonId
    depth: Depth
    started_at: datetime


class AttemptPatch(Strict):
    steps: list[StepRecord] = Field(max_length=12)
    hints_used: int = Field(ge=0, le=100)


class AttemptComplete(Strict):
    profile_id: uuid.UUID
    lesson_id: LessonId
    depth: Depth
    started_at: datetime
    finished_at: datetime
    steps: list[StepRecord] = Field(max_length=12)
    hints_used: int = Field(ge=0, le=100)
    review_concepts: list[Annotated[str, StringConstraints(max_length=64)]] = Field(default=[], max_length=20)
    wrong_choices: list[Annotated[str, StringConstraints(max_length=32)]] = Field(default=[], max_length=10)
