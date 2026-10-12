"""Who may play what. Free covers the first lesson of every course; paid plans cover everything."""

from typing import Any

from ..config import get_settings
from ..models import ParentAccount

PAID_PLANS = {"family", "school"}
# Shown on the pricing page as [N]; the real number is an open decision.
MAX_PROFILES = 5


def effective_plan(account: ParentAccount | None, in_class: bool = False) -> str:
    override = get_settings().dev_plan_override
    if override:
        return override
    if in_class:
        return "school"
    return account.plan if account is not None else "free"


def free_lesson_ids(objects: list[dict[str, Any]]) -> set[str]:
    """The lowest-numbered lesson in each subject."""
    first: dict[str, dict[str, Any]] = {}
    for obj in objects:
        if not obj.get("lesson"):
            continue
        current = first.get(obj["subject"])
        if current is None or obj["number"] < current["number"]:
            first[obj["subject"]] = obj
    return {obj["lesson"] for obj in first.values()}


def can_play(lesson_id: str, plan: str, objects: list[dict[str, Any]]) -> bool:
    return plan in PAID_PLANS or lesson_id in free_lesson_ids(objects)
