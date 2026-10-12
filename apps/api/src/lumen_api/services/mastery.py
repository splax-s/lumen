"""A simple spaced-review model: a score from 0 to 1 per concept and a date to see it again."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ConceptMastery

REVIEW_DAYS = [1, 3, 7, 16, 35]
GAIN = 0.4
DROP = 0.6


def next_score(score: float, needs_review: bool) -> float:
    """Success moves the score 40% of the way to 1. Needing the answer shown cuts it to 60%."""
    return score * DROP if needs_review else score + (1 - score) * GAIN


def review_delay(successes: int) -> timedelta:
    """After the nth success in a row, wait 1, 3, 7, 16 then 35 days."""
    index = max(0, min(successes, len(REVIEW_DAYS)) - 1)
    return timedelta(days=REVIEW_DAYS[index])


async def record_concepts(
    db: AsyncSession,
    learner_id: uuid.UUID,
    concepts: list[str],
    review_concepts: list[str],
    when: datetime,
) -> None:
    for concept in dict.fromkeys(concepts):
        needs_review = concept in review_concepts
        row = await db.get(ConceptMastery, (learner_id, concept))
        if row is None:
            row = ConceptMastery(
                learner_id=learner_id,
                concept_id=concept,
                score=0.0,
                successes=0,
                last_seen=when,
                next_review_at=when,
            )
            db.add(row)
        row.score = round(next_score(row.score, needs_review), 4)
        row.successes = 0 if needs_review else row.successes + 1
        row.last_seen = when
        row.next_review_at = when + (timedelta(days=1) if needs_review else review_delay(row.successes))
