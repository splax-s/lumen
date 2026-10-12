"""Database tables.

Every table that refers to a learner profile does so with ON DELETE CASCADE, so deleting a
profile removes all of its data. A test checks this for every foreign key, so a new table
cannot forget it.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


PROFILE_FK = "learner_profile.id"
ACCOUNT_FK = "parent_account.id"


class School(Base):
    __tablename__ = "school"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200))
    country: Mapped[str] = mapped_column(String(2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ParentAccount(Base):
    """An adult: a parent, a teacher, an adult learner, or a member of staff."""

    __tablename__ = "parent_account"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    country: Mapped[str] = mapped_column(String(2))
    consents: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    role: Mapped[str] = mapped_column(String(16), default="user")  # user | teacher
    staff_level: Mapped[str | None] = mapped_column(String(16), nullable=True)  # support | admin
    plan: Mapped[str] = mapped_column(String(16), default="free")  # free | family | school
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SchoolClass(Base):
    __tablename__ = "class"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(ACCOUNT_FK, ondelete="CASCADE"), index=True
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(80))
    join_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    join_code_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LearnerProfile(Base):
    """A learner. For a child this holds a nickname, an avatar and an age band, and nothing else."""

    __tablename__ = "learner_profile"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(ACCOUNT_FK, ondelete="CASCADE"), nullable=True, index=True
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class.id", ondelete="CASCADE"), nullable=True, index=True
    )
    nickname: Mapped[str] = mapped_column(String(20))
    avatar: Mapped[str] = mapped_column(String(24), default="lumi-1")
    birth_year_band: Mapped[str] = mapped_column(String(16))  # under_13 | 13_15 | 16_plus | adult
    default_depth: Mapped[str] = mapped_column(String(8), default="play")
    chat_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lesson(Base):
    """A copy of each compiled lesson file, synced at deploy."""

    __tablename__ = "lesson"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    number: Mapped[int] = mapped_column(Integer)
    subject: Mapped[str] = mapped_column(String(16))
    object: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    threads: Mapped[list[str]] = mapped_column(JSONB, default=list)
    needs: Mapped[list[str]] = mapped_column(JSONB, default=list)
    concepts: Mapped[list[str]] = mapped_column(JSONB, default=list)
    card: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LessonAttempt(Base):
    __tablename__ = "lesson_attempt"

    # Chosen by the client, so sending the same attempt twice cannot create two rows.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    learner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(PROFILE_FK, ondelete="CASCADE"), index=True
    )
    lesson_id: Mapped[str] = mapped_column(String(64), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    depth: Mapped[str] = mapped_column(String(8))
    steps: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    review_concepts: Mapped[list[str]] = mapped_column(JSONB, default=list)
    wrong_choices: Mapped[list[str]] = mapped_column(JSONB, default=list)


class ConceptMastery(Base):
    __tablename__ = "concept_mastery"

    learner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(PROFILE_FK, ondelete="CASCADE"), primary_key=True
    )
    concept_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Card(Base):
    __tablename__ = "card"

    learner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(PROFILE_FK, ondelete="CASCADE"), primary_key=True
    )
    lesson_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Streak(Base):
    __tablename__ = "streak"

    learner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(PROFILE_FK, ondelete="CASCADE"), primary_key=True
    )
    current: Mapped[int] = mapped_column(Integer, default=0)
    longest: Mapped[int] = mapped_column(Integer, default=0)
    last_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    rest_days_left: Mapped[int] = mapped_column(Integer, default=2)


class TutorMessage(Base):
    """Everything asked of Lumi and everything Lumi said, with the safety result. Kept 90 days."""

    __tablename__ = "tutor_message"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    learner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(PROFILE_FK, ondelete="CASCADE"), index=True
    )
    lesson_id: Mapped[str] = mapped_column(String(64), index=True)
    role: Mapped[str] = mapped_column(String(12))  # learner | lumi
    text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(16), default="learner")  # learner | model | scripted
    safety_result: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(ACCOUNT_FK, ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Assignment(Base):
    __tablename__ = "assignment"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class.id", ondelete="CASCADE"), index=True
    )
    lesson_id: Mapped[str] = mapped_column(String(64))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AnalyticsEvent(Base):
    """First-party usage events. No free text, no third parties."""

    __tablename__ = "analytics_event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    learner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(PROFILE_FK, ondelete="CASCADE"), nullable=True, index=True
    )
    # A random id kept in the browser for learners with no account. Not linked to a person.
    anon_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(32), index=True)
    lesson_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    depth: Mapped[str | None] = mapped_column(String(8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class OpsAuditLog(Base):
    """What staff did in the ops console: who, what, to which record, when."""

    __tablename__ = "ops_audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(ACCOUNT_FK, ondelete="SET NULL"), nullable=True, index=True
    )
    staff_email: Mapped[str] = mapped_column(String(320))
    action: Mapped[str] = mapped_column(String(48), index=True)
    target_type: Mapped[str] = mapped_column(String(32), default="")
    target_id: Mapped[str] = mapped_column(String(64), default="")
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class FeatureFlag(Base):
    __tablename__ = "feature_flag"

    key: Mapped[str] = mapped_column(String(48), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str] = mapped_column(String(200), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobRun(Base):
    """When a maintenance job last ran, shown in the ops console."""

    __tablename__ = "job_run"

    name: Mapped[str] = mapped_column(String(48), primary_key=True)
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
