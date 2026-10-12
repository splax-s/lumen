"""Lumi's answers: scripted first, the model only when needed, and never unchecked.

Every question and every reply is stored in tutor_message with its safety result, including
model replies that were blocked and replaced.
"""

import re
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .. import clock
from ..config import get_settings
from ..models import TutorMessage
from .anthropic_provider import AnthropicProvider
from .openai_provider import OpenAICompatibleProvider
from .prompt import SYSTEM, build_context, forbidden_phrases
from .provider import ProviderError, TutorProvider
from .safety import check_reply, screen_question


@dataclass(frozen=True)
class TutorReply:
    text: str
    source: str  # "model" or "scripted"
    safety_result: str
    mood: str = "happy"
    lesson: str | None = None  # a lesson that helps, for a diagnosis


SCRIPTED: dict[str, dict[str, str]] = {
    "fallback": {
        "play": "Good question! I'm not sure about that one. Try it in the simulation and see what happens.",
        "explain": "Good question. I'm not sure about that one. Try changing one thing in the simulation and watch what happens.",
        "deep": "Good question. I can't answer that reliably. Test it in the simulation by changing one variable at a time.",
    },
    "off_topic": {
        "play": "I only know about science! Want to try something in the simulation?",
        "explain": "I only know about science. Is there something in this lesson you would like to try?",
        "deep": "That is outside what I can help with. I can talk about the science in this lesson.",
    },
    "personal_data": {
        "play": "Let's keep things like that private. I'm happy to talk about the science, though!",
        "explain": "Please keep personal details private. I'm happy to help with the science.",
        "deep": "Please don't share personal details here. I can help with the science.",
    },
    "needs_adult": {
        "play": "That sounds important, and I'm only a science guide. Please talk to a grown-up you trust, like a parent or a teacher.",
        "explain": "That sounds important, and I'm only a science guide. Please talk to an adult you trust, like a parent or a teacher.",
        "deep": "That sounds important, and I'm only a science guide. Please talk to an adult you trust.",
    },
    "hold_answer": {
        "play": "I don't want to spoil it yet! Look at the simulation again and make your best guess.",
        "explain": "I'll hold the answer back for now. Look at the simulation again and commit to a guess.",
        "deep": "Not yet. Make a prediction first, then we can check it against the simulation.",
    },
    "diagnose": {
        "play": "Not quite. Look again at what happened in the simulation, then have another go.",
        "explain": "Not quite. Go back to what you saw in the simulation and think about what it tells you.",
        "deep": "Not quite. Check your reasoning against what the simulation showed.",
    },
}


def scripted(kind: str, depth: str) -> str:
    lines = SCRIPTED[kind]
    return lines.get(depth) or lines["explain"]


def _depth_text(value: Any, depth: str) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return str(value.get(depth) or value.get("explain") or value.get("play") or "")
    return ""


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def suggestions(lesson: dict[str, Any], depth: str) -> list[str]:
    """The questions a learner can ask with one tap. These never need the model."""
    return [_depth_text(q.get("ask"), depth) for q in lesson.get("questions", [])]


def scripted_answer(lesson: dict[str, Any], depth: str, question: str) -> str | None:
    wanted = _normalise(question)
    for entry in lesson.get("questions", []):
        ask = entry.get("ask")
        forms = [ask] if isinstance(ask, str) else list((ask or {}).values())
        if any(_normalise(str(form)) == wanted for form in forms):
            return _depth_text(entry.get("answer"), depth)
    return None


@lru_cache
def default_provider() -> TutorProvider | None:
    settings = get_settings()
    kind = settings.effective_provider
    if kind == "anthropic":
        return AnthropicProvider(
            settings.anthropic_api_key,
            settings.lumi_model,
            settings.lumi_effort,
            settings.lumi_timeout_seconds,
        )
    if kind == "openai_compatible":
        return OpenAICompatibleProvider(
            settings.openai_base_url,
            settings.openai_api_key,
            settings.lumi_model,
            settings.lumi_timeout_seconds,
        )
    return None


def get_provider() -> TutorProvider | None:
    return default_provider()


def _log(
    db: AsyncSession, learner_id: uuid.UUID, lesson_id: str, role: str, text: str, source: str, result: str
) -> None:
    db.add(
        TutorMessage(
            learner_id=learner_id,
            lesson_id=lesson_id,
            role=role,
            text=text,
            source=source,
            safety_result=result,
            # Set here, not by the database, so messages written in one request keep their order.
            created_at=clock.now(),
        )
    )


async def ask(
    db: AsyncSession,
    provider: TutorProvider | None,
    learner_id: uuid.UUID,
    lesson: dict[str, Any],
    *,
    step: int,
    depth: str,
    events: list[str],
    hint_level: int,
    question: str,
) -> TutorReply:
    lesson_id = str(lesson.get("id", ""))
    screened = screen_question(question)
    _log(db, learner_id, lesson_id, "learner", screened.text, "learner", screened.result)

    def reply(kind: str, result: str, mood: str = "thinking") -> TutorReply:
        text = scripted(kind, depth)
        _log(db, learner_id, lesson_id, "lumi", text, "scripted", result)
        return TutorReply(text=text, source="scripted", safety_result=result, mood=mood)

    if not screened.ok:
        reason = screened.result.removeprefix("blocked:")
        kind = reason if reason in ("personal_data", "needs_adult", "off_topic") else "fallback"
        return reply(kind, f"scripted:question_{reason}", mood="happy")

    answer = scripted_answer(lesson, depth, screened.text)
    if answer:
        _log(db, learner_id, lesson_id, "lumi", answer, "scripted", "ok")
        return TutorReply(text=answer, source="scripted", safety_result="ok", mood="happy")

    if provider is None:
        return reply("fallback", "scripted:no_provider")

    forbidden = forbidden_phrases(lesson, step, hint_level)
    context = build_context(lesson, step, depth, events, hint_level)
    try:
        draft = await provider.complete(SYSTEM, context, [{"role": "user", "content": screened.text}])
    except ProviderError as error:
        return reply("fallback", f"error:provider_{error.kind}")
    except Exception:  # a provider must never take the lesson down with it
        return reply("fallback", "error:provider")

    result = check_reply(draft, depth, forbidden)
    if result == "ok":
        try:
            verdict = await provider.judge(draft, [fact["text"] for fact in lesson.get("facts", [])], depth)
            if not verdict.passed:
                result = f"blocked:{verdict.failure}"
        except ProviderError as error:
            result = f"blocked:judge_{error.kind}"
        except Exception:
            result = "blocked:judge_error"

    if result != "ok":
        # Keep the blocked draft for staff review, then show a scripted line instead.
        _log(db, learner_id, lesson_id, "lumi", draft, "model", result)
        reason = result.removeprefix("blocked:")
        kind = {
            "answer_before_hints": "hold_answer",
            "off_topic": "off_topic",
            "personal_data": "personal_data",
        }.get(reason, "fallback")
        return reply(kind, f"scripted:replaced_{reason}")

    _log(db, learner_id, lesson_id, "lumi", draft, "model", "ok")
    return TutorReply(text=draft, source="model", safety_result="ok", mood="happy")


async def diagnose(
    db: AsyncSession, learner_id: uuid.UUID, lesson: dict[str, Any], *, choice: str, depth: str
) -> TutorReply:
    """Why a learner may have picked this choice, and a lesson that helps. Scripted in the lesson file."""
    lesson_id = str(lesson.get("id", ""))
    _log(db, learner_id, lesson_id, "learner", f"[picked: {choice[:32]}]", "learner", "ok")
    entry = next((m for m in lesson.get("misconceptions", []) if m.get("choice") == choice), None)
    text = _depth_text(entry.get("text"), depth) if entry else scripted("diagnose", depth)
    linked = entry.get("lesson") if entry else None
    result = "ok" if entry else "scripted:no_diagnosis"
    _log(db, learner_id, lesson_id, "lumi", text, "scripted", result)
    return TutorReply(text=text, source="scripted", safety_result=result, mood="thinking", lesson=linked)
