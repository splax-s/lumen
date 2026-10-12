"""A learner's progress as the town needs it: what is done, their cards and their streak."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Assignment, Card, LearnerProfile, LessonAttempt, Streak
from .content import Content
from .town import object_states


async def finished_lessons(db: AsyncSession, profile_id: uuid.UUID) -> list[tuple[str, Any]]:
    """Finished lesson ids with the time each was last finished, oldest first."""
    rows = await db.execute(
        select(LessonAttempt.lesson_id, LessonAttempt.finished_at)
        .where(LessonAttempt.learner_id == profile_id, LessonAttempt.finished_at.is_not(None))
        .order_by(LessonAttempt.finished_at)
    )
    latest: dict[str, Any] = {}
    for lesson_id, finished_at in rows:
        latest.pop(lesson_id, None)
        latest[lesson_id] = finished_at
    return list(latest.items())


async def town_view(db: AsyncSession, profile: LearnerProfile, content: Content) -> dict[str, Any]:
    done = await finished_lessons(db, profile.id)
    done_ids = [lesson_id for lesson_id, _ in done]
    cards = await db.scalars(select(Card).where(Card.learner_id == profile.id).order_by(Card.earned_at))
    streak = await db.get(Streak, profile.id)
    assigned: list[str] = []
    if profile.class_id is not None:
        rows = await db.scalars(select(Assignment.lesson_id).where(Assignment.class_id == profile.class_id))
        assigned = [lesson_id for lesson_id in rows if lesson_id not in done_ids]
    return {
        "profile_id": str(profile.id),
        "done": [{"lesson_id": lesson_id, "at": at.isoformat()} for lesson_id, at in done],
        "objects": object_states(content.objects, done_ids),
        "threads": content.catalog.get("threads", []),
        "cards": [{"lesson_id": card.lesson_id, "at": card.earned_at.isoformat()} for card in cards],
        "streak": {
            "current": streak.current if streak else 0,
            "longest": streak.longest if streak else 0,
            "last_day": streak.last_day.isoformat() if streak and streak.last_day else None,
            "rest_days_left": streak.rest_days_left if streak else 2,
        },
        "assigned": assigned,
    }
