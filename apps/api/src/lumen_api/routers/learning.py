"""The town, lessons and attempts."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.dialects.postgresql import insert

from ..deps import Db, MaybePrincipal, Principal, SignedIn, profile_for
from ..models import Card, LearnerProfile, LessonAttempt, Streak
from ..schemas import AttemptComplete, AttemptPatch, AttemptStart
from ..services.content import Content, get_content
from ..services.entitlements import can_play, effective_plan
from ..services.mastery import record_concepts
from ..services.progress import town_view
from ..services.streak import StreakState, next_streak

router = APIRouter(tags=["learning"])
Lessons = Annotated[Content, Depends(get_content)]


def plan_for(principal: Principal | None, profile: LearnerProfile | None = None) -> str:
    in_class = profile is not None and profile.class_id is not None
    return effective_plan(principal.account if principal else None, in_class=in_class)


def require_playable(lesson_id: str, plan: str, content: Content) -> None:
    if lesson_id not in content.lesson_ids():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "lesson_not_found")
    if not can_play(lesson_id, plan, content.objects):
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "plan_required")


@router.get("/town")
async def town(profile_id: uuid.UUID, principal: SignedIn, db: Db, content: Lessons) -> dict[str, Any]:
    """Object states, threads, cards and streak for one learner."""
    profile = await profile_for(db, principal, profile_id)
    view = await town_view(db, profile, content)
    plan = plan_for(principal, profile)
    view["plan"] = plan
    view["playable"] = [lesson for lesson in content.lesson_ids() if can_play(lesson, plan, content.objects)]
    return view


@router.get("/lessons/{lesson_id}")
async def lesson(lesson_id: str, principal: MaybePrincipal, content: Lessons) -> dict[str, Any]:
    """The compiled lesson, if this person's plan includes it. The first lesson of each course is free."""
    profile = principal.profile if principal else None
    require_playable(lesson_id, plan_for(principal, profile), content)
    data = content.lessons.get(lesson_id)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "lesson_not_built")
    return data


@router.post("/attempts", status_code=status.HTTP_201_CREATED)
async def start_attempt(body: AttemptStart, principal: SignedIn, db: Db, content: Lessons) -> dict[str, str]:
    profile = await profile_for(db, principal, body.profile_id)
    require_playable(body.lesson_id, plan_for(principal, profile), content)
    await db.execute(
        insert(LessonAttempt)
        .values(
            id=body.id,
            learner_id=profile.id,
            lesson_id=body.lesson_id,
            depth=body.depth,
            started_at=body.started_at,
            steps=[],
            hints_used=0,
            review_concepts=[],
            wrong_choices=[],
        )
        .on_conflict_do_nothing(index_elements=["id"])
    )
    attempt = await db.get(LessonAttempt, body.id)
    if attempt is None or attempt.learner_id != profile.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "attempt_id_in_use")
    return {"id": str(body.id)}


async def _own_attempt(db: Db, principal: Principal, attempt_id: uuid.UUID) -> LessonAttempt:
    attempt = await db.get(LessonAttempt, attempt_id)
    if attempt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "attempt_not_found")
    try:
        await profile_for(db, principal, attempt.learner_id)
    except HTTPException as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "attempt_not_found") from error
    return attempt


@router.patch("/attempts/{attempt_id}")
async def update_attempt(
    attempt_id: uuid.UUID, body: AttemptPatch, principal: SignedIn, db: Db
) -> dict[str, str]:
    """Step progress while a lesson is being played."""
    attempt = await _own_attempt(db, principal, attempt_id)
    if attempt.finished_at is None:
        attempt.steps = [step.model_dump() for step in body.steps]
        attempt.hints_used = body.hints_used
    return {"id": str(attempt_id)}


@router.post("/attempts/{attempt_id}/complete")
async def complete_attempt(
    attempt_id: uuid.UUID, body: AttemptComplete, principal: SignedIn, db: Db, content: Lessons
) -> dict[str, Any]:
    """Finishes an attempt: earns the card, moves the streak and updates concept mastery.

    Safe to send more than once. The browser retries until it gets an answer, so the second and
    later calls change nothing and return the same result.
    """
    profile = await profile_for(db, principal, body.profile_id)
    require_playable(body.lesson_id, plan_for(principal, profile), content)

    attempt = await db.get(LessonAttempt, attempt_id)
    if attempt is not None and attempt.learner_id != profile.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "attempt_id_in_use")
    if attempt is None:
        attempt = LessonAttempt(
            id=attempt_id,
            learner_id=profile.id,
            lesson_id=body.lesson_id,
            depth=body.depth,
            started_at=body.started_at,
        )
        db.add(attempt)

    first_time = attempt.finished_at is None
    if first_time:
        attempt.finished_at = body.finished_at
        attempt.depth = body.depth
        attempt.steps = [step.model_dump() for step in body.steps]
        attempt.hints_used = body.hints_used
        attempt.review_concepts = body.review_concepts
        attempt.wrong_choices = body.wrong_choices
        await db.flush()

        await db.execute(
            insert(Card)
            .values(learner_id=profile.id, lesson_id=body.lesson_id, earned_at=body.finished_at)
            .on_conflict_do_nothing(index_elements=["learner_id", "lesson_id"])
        )

        streak = await db.get(Streak, profile.id)
        if streak is None:
            streak = Streak(learner_id=profile.id, current=0, longest=0, last_day=None, rest_days_left=2)
            db.add(streak)
        moved = next_streak(
            StreakState(streak.current, streak.longest, streak.last_day, streak.rest_days_left),
            body.finished_at.date(),
        )
        streak.current, streak.longest = moved.current, moved.longest
        streak.last_day, streak.rest_days_left = moved.last_day, moved.rest_days_left

        concepts = (content.object_for(body.lesson_id) or {}).get("concepts") or []
        known = [c for c in body.review_concepts if c in concepts]
        await record_concepts(db, profile.id, concepts, known, body.finished_at)
        await db.flush()

    view = await town_view(db, profile, content)
    view["first_time"] = first_time
    return view
