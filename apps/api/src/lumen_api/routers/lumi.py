"""Ask Lumi. Free questions are rate-limited, age-gated and safety-checked."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, StringConstraints

from ..deps import Cache, Config, Db, SignedIn, profile_for
from ..lumi import service
from ..lumi.provider import TutorProvider
from ..ratelimit import rate_limit
from ..schemas import Depth, LessonId, Strict
from ..services.content import Content, get_content
from .learning import plan_for, require_playable

router = APIRouter(prefix="/lumi", tags=["lumi"])
Lessons = Annotated[Content, Depends(get_content)]
Provider = Annotated[TutorProvider | None, Depends(service.get_provider)]
EventName = Annotated[str, StringConstraints(pattern=r"^[a-z_]{1,24}(:[\w.\-]{1,24})?$")]


class AskIn(Strict):
    profile_id: uuid.UUID
    lesson_id: LessonId
    step: int = Field(ge=0, le=20)
    depth: Depth
    hint_level: int = Field(default=0, ge=0, le=4)
    events: list[EventName] = Field(default=[], max_length=20)
    # Exactly one of these. A suggestion is the index of one of the lesson's ready-made questions.
    question: str | None = Field(default=None, min_length=1, max_length=300)
    suggestion: int | None = Field(default=None, ge=0, le=20)


class DiagnoseIn(Strict):
    profile_id: uuid.UUID
    lesson_id: LessonId
    choice: Annotated[str, StringConstraints(min_length=1, max_length=32)]
    depth: Depth


def _lesson(content: Content, lesson_id: str) -> dict[str, Any]:
    lesson = content.lessons.get(lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "lesson_not_found")
    return lesson


def _out(reply: service.TutorReply) -> dict[str, Any]:
    return {"text": reply.text, "source": reply.source, "mood": reply.mood, "lesson": reply.lesson}


@router.get("/suggestions")
async def suggestions(lesson_id: LessonId, depth: Depth, content: Lessons) -> dict[str, list[str]]:
    """Ready-made questions for a lesson. Every learner can use these, with no typing."""
    return {"questions": service.suggestions(_lesson(content, lesson_id), depth)}


@router.post("/ask")
async def ask(
    body: AskIn,
    principal: SignedIn,
    db: Db,
    redis: Cache,
    settings: Config,
    content: Lessons,
    provider: Provider,
) -> dict[str, Any]:
    profile = await profile_for(db, principal, body.profile_id)
    require_playable(body.lesson_id, plan_for(principal, profile), content)
    lesson = _lesson(content, body.lesson_id)
    if (body.question is None) == (body.suggestion is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "question_or_suggestion")

    if body.suggestion is not None:
        ready = service.suggestions(lesson, body.depth)
        if body.suggestion >= len(ready):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "suggestion_not_found")
        question = ready[body.suggestion]
    else:
        # Under-13s have no free-text chat unless a parent has unlocked it. Enforced here, on the
        # server, whatever the app shows.
        if profile.birth_year_band == "under_13" and not profile.chat_unlocked:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "chat_locked")
        assert body.question is not None
        question = body.question

    await rate_limit(redis, f"ask:{profile.id}", settings.ask_limit, settings.ask_window)
    reply = await service.ask(
        db,
        provider,
        profile.id,
        lesson,
        step=body.step,
        depth=body.depth,
        events=body.events,
        hint_level=body.hint_level,
        question=question,
    )
    return _out(reply)


@router.post("/diagnose")
async def diagnose(body: DiagnoseIn, principal: SignedIn, db: Db, content: Lessons) -> dict[str, Any]:
    """A wrong answer in, the likely misunderstanding and a lesson that helps out."""
    profile = await profile_for(db, principal, body.profile_id)
    require_playable(body.lesson_id, plan_for(principal, profile), content)
    reply = await service.diagnose(
        db, profile.id, _lesson(content, body.lesson_id), choice=body.choice, depth=body.depth
    )
    return _out(reply)
