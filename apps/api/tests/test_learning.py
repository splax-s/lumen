import json
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lumen_api.models import Card, ConceptMastery, Lesson, LessonAttempt, ParentAccount
from lumen_api.services.content import get_content
from lumen_api.services.entitlements import can_play, free_lesson_ids
from lumen_api.services.lesson_sync import sync_lessons
from lumen_api.services.mastery import next_score, review_delay
from lumen_api.services.streak import StreakState, next_streak
from lumen_api.services.town import object_states

from .conftest import add_profile, sign_up

FIXTURES = Path(__file__).parents[3] / "packages" / "lessons" / "fixtures" / "town-states.json"
START = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)


def attempt_body(
    profile_id: str, lesson_id: str = "chem.ice-floats", when: datetime = START, **extra: Any
) -> dict[str, Any]:
    return {
        "profile_id": profile_id,
        "lesson_id": lesson_id,
        "depth": "play",
        "started_at": (when - timedelta(minutes=5)).isoformat(),
        "finished_at": when.isoformat(),
        "steps": [{"type": "hook", "wrong": 0, "hintLevel": 0, "ms": 4000}],
        "hints_used": 0,
        **extra,
    }


async def complete(
    client: AsyncClient, profile_id: str, lesson_id: str = "chem.ice-floats", **kw: Any
) -> Any:
    attempt_id = kw.pop("attempt_id", str(uuid.uuid4()))
    return await client.post(
        f"/attempts/{attempt_id}/complete", json=attempt_body(profile_id, lesson_id, **kw)
    )


async def set_plan(db: AsyncSession, plan: str) -> None:
    account = await db.scalar(select(ParentAccount))
    assert account is not None
    account.plan = plan
    await db.commit()


# --- Town states: the same fixtures the web app is tested against ---------------------------


@pytest.mark.parametrize(
    "case", json.loads(FIXTURES.read_text()), ids=lambda c: ",".join(c["done"][-2:]) or "nothing"
)
def test_town_states_match_the_web_app(case: dict[str, Any]) -> None:
    assert object_states(get_content().objects, case["done"]) == case["states"]


# --- Entitlements --------------------------------------------------------------------------


def test_free_covers_the_first_lesson_of_each_course() -> None:
    objects = get_content().objects
    assert free_lesson_ids(objects) == {
        "chem.ice-floats",
        "phys.swing",
        "math.scale",
        "bio.onion",
        "music.guitar",
    }
    assert can_play("chem.ice-floats", "free", objects)
    assert not can_play("chem.kettle-boil", "free", objects)
    assert can_play("chem.kettle-boil", "family", objects)
    assert can_play("chem.kettle-boil", "school", objects)


async def test_anyone_can_fetch_a_free_lesson_but_paid_lessons_need_a_plan(
    client: AsyncClient, anonymous: AsyncClient, db: AsyncSession
) -> None:
    free = await anonymous.get("/lessons/chem.ice-floats")
    assert free.status_code == 200
    assert free.json()["card"] == "Ice floats because freezing water spreads out."
    assert (await anonymous.get("/lessons/chem.kettle-boil")).status_code == 402
    assert (await anonymous.get("/lessons/chem.no-such-lesson")).status_code == 404
    await sign_up(client)
    assert (await client.get("/lessons/chem.kettle-boil")).status_code == 402
    await set_plan(db, "family")
    assert (await client.get("/lessons/chem.kettle-boil")).status_code in (
        200,
        404,
    )  # 404 until its file is written


async def test_a_free_account_cannot_record_a_paid_lesson(client: AsyncClient) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    response = await complete(client, ada["id"], "chem.kettle-boil")
    assert response.status_code == 402
    assert response.json()["detail"] == "plan_required"


# --- Attempts ------------------------------------------------------------------------------


async def test_finishing_a_lesson_paints_the_object_earns_a_card_and_starts_a_streak(
    client: AsyncClient,
) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    before = (await client.get("/town", params={"profile_id": ada["id"]})).json()
    assert before["objects"]["glass"] == "next"
    assert before["objects"]["kettle"] == "locked"
    assert before["cards"] == []
    assert before["plan"] == "free"
    assert "chem.ice-floats" in before["playable"] and "chem.kettle-boil" not in before["playable"]

    response = await complete(client, ada["id"])
    assert response.status_code == 200
    view = response.json()
    assert view["first_time"] is True
    assert view["objects"]["glass"] == "done"
    assert view["objects"]["kettle"] == "next"
    assert [c["lesson_id"] for c in view["cards"]] == ["chem.ice-floats"]
    assert view["streak"]["current"] == 1
    assert (await client.get("/town", params={"profile_id": ada["id"]})).json()["objects"] == view["objects"]


async def test_completing_the_same_attempt_twice_changes_nothing(
    client: AsyncClient, db: AsyncSession
) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    attempt_id = str(uuid.uuid4())
    first = await complete(client, ada["id"], attempt_id=attempt_id)
    second = await complete(client, ada["id"], attempt_id=attempt_id)
    assert first.status_code == second.status_code == 200
    assert second.json()["first_time"] is False
    assert second.json()["streak"] == first.json()["streak"]
    assert await db.scalar(select(func.count()).select_from(LessonAttempt)) == 1
    assert await db.scalar(select(func.count()).select_from(Card)) == 1
    mastery = await db.scalar(select(ConceptMastery).where(ConceptMastery.concept_id == "density"))
    assert mastery is not None and mastery.successes == 1


async def test_replaying_a_lesson_adds_an_attempt_but_not_a_second_card(
    client: AsyncClient, db: AsyncSession
) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    await complete(client, ada["id"])
    await complete(client, ada["id"], when=START + timedelta(hours=1))
    assert await db.scalar(select(func.count()).select_from(LessonAttempt)) == 2
    assert await db.scalar(select(func.count()).select_from(Card)) == 1


async def test_an_attempt_can_be_started_and_updated_before_it_is_finished(
    client: AsyncClient, db: AsyncSession
) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    attempt_id = str(uuid.uuid4())
    start = {
        "id": attempt_id,
        "profile_id": ada["id"],
        "lesson_id": "chem.ice-floats",
        "depth": "deep",
        "started_at": START.isoformat(),
    }
    assert (await client.post("/attempts", json=start)).status_code == 201
    assert (await client.post("/attempts", json=start)).status_code == 201
    patch = {"steps": [{"type": "hook", "wrong": 0, "hintLevel": 0, "ms": 3000}], "hints_used": 0}
    assert (await client.patch(f"/attempts/{attempt_id}", json=patch)).status_code == 200
    town = (await client.get("/town", params={"profile_id": ada["id"]})).json()
    assert town["objects"]["glass"] == "next", "an unfinished attempt does not paint the object"
    assert (await complete(client, ada["id"], attempt_id=attempt_id)).json()["objects"]["glass"] == "done"
    assert await db.scalar(select(func.count()).select_from(LessonAttempt)) == 1


async def test_one_family_cannot_write_or_read_anothers_attempts(
    client: AsyncClient, other: AsyncClient
) -> None:
    await sign_up(client)
    await sign_up(other)
    ada = await add_profile(client)
    attempt_id = str(uuid.uuid4())
    await complete(client, ada["id"], attempt_id=attempt_id)
    assert (await complete(other, ada["id"])).status_code == 404
    assert (await other.get("/town", params={"profile_id": ada["id"]})).status_code == 404
    assert (
        await other.patch(f"/attempts/{attempt_id}", json={"steps": [], "hints_used": 0})
    ).status_code == 404
    theirs = await add_profile(other, "Tobi")
    stolen = await complete(other, theirs["id"], attempt_id=attempt_id)
    assert stolen.status_code == 409


async def test_attempts_need_sign_in_and_valid_data(client: AsyncClient, anonymous: AsyncClient) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    assert (await complete(anonymous, ada["id"])).status_code == 401
    assert (await complete(client, ada["id"], "not a lesson id")).status_code == 422
    assert (await complete(client, ada["id"], "chem.unknown")).status_code == 404
    bad = attempt_body(ada["id"])
    bad["notes"] = "free text is not accepted"
    assert (await client.post(f"/attempts/{uuid.uuid4()}/complete", json=bad)).status_code == 422
    assert (await client.get("/town", params={"profile_id": "not-a-uuid"})).status_code == 422


# --- Mastery -------------------------------------------------------------------------------


def test_mastery_arithmetic() -> None:
    assert next_score(0.0, needs_review=False) == pytest.approx(0.4)
    assert next_score(0.4, needs_review=False) == pytest.approx(0.64)
    assert next_score(0.64, needs_review=True) == pytest.approx(0.384)
    assert [review_delay(n).days for n in (1, 2, 3, 4, 5, 9)] == [1, 3, 7, 16, 35, 35]


async def test_needing_the_answer_shown_lowers_mastery_and_brings_review_forward(
    client: AsyncClient, db: AsyncSession
) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    await complete(client, ada["id"])
    row = await db.scalar(select(ConceptMastery).where(ConceptMastery.concept_id == "density"))
    assert row is not None
    assert row.score == pytest.approx(0.4)
    assert row.next_review_at == START + timedelta(days=1)

    later = START + timedelta(days=1)
    await complete(client, ada["id"], when=later)
    await db.refresh(row)
    assert row.score == pytest.approx(0.64)
    assert row.next_review_at == later + timedelta(days=3)

    again = later + timedelta(days=3)
    await complete(client, ada["id"], when=again, review_concepts=["density", "made-up-concept"])
    await db.refresh(row)
    assert row.score == pytest.approx(0.384)
    assert row.successes == 0
    assert row.next_review_at == again + timedelta(days=1)
    assert await db.scalar(select(func.count()).select_from(ConceptMastery)) == 2, (
        "unknown concepts are ignored"
    )


# --- Streaks: the same rules as the web app's local store -----------------------------------


def test_streak_rules() -> None:
    day = date(2026, 10, 12)
    one = next_streak(StreakState(), day)
    assert (one.current, one.longest, one.rest_days_left) == (1, 1, 2)
    assert next_streak(one, day) == one
    two = next_streak(one, day + timedelta(days=1))
    assert two.current == 2
    rested = next_streak(two, day + timedelta(days=3))
    assert (rested.current, rested.rest_days_left) == (3, 1)
    reset = next_streak(rested, day + timedelta(days=9))
    assert (reset.current, reset.longest, reset.rest_days_left) == (1, 3, 2)
    assert next_streak(rested, day) == rested, "a clock that goes backwards leaves the streak alone"


async def test_streak_grows_across_days(client: AsyncClient) -> None:
    await sign_up(client)
    ada = await add_profile(client)
    await complete(client, ada["id"])
    view = (await complete(client, ada["id"], "phys.swing", when=START + timedelta(days=1))).json()
    assert view["streak"] == {"current": 2, "longest": 2, "last_day": "2026-10-13", "rest_days_left": 2}


# --- Lesson sync ---------------------------------------------------------------------------


async def test_lesson_sync_copies_lessons_and_removes_retired_ones(db: AsyncSession) -> None:
    db.add(
        Lesson(id="chem.retired", number=99, subject="chemistry", object="kitchen/x", title="Old", data={})
    )
    await db.commit()
    result = await sync_lessons(db, get_content())
    await db.commit()
    assert "chem.ice-floats" in result["added"]
    assert result["removed"] == ["chem.retired"]
    row = await db.get(Lesson, "chem.ice-floats")
    assert row is not None
    assert row.concepts == ["density", "states-of-matter"]
    assert row.data["facts"][0]["source"]
    again = await sync_lessons(db, get_content())
    assert again["added"] == [] and again["updated"] == [] and again["removed"] == []
