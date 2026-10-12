"""Tutor messages are kept for a limited time and then deleted."""

from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import clock
from ..config import get_settings
from ..models import JobRun, TutorMessage

JOB = "purge_tutor_messages"


async def purge_old_tutor_messages(db: AsyncSession) -> int:
    now = clock.now()
    cutoff = now - timedelta(days=get_settings().tutor_retention_days)
    result = await db.execute(delete(TutorMessage).where(TutorMessage.created_at < cutoff))
    removed = int(getattr(result, "rowcount", 0) or 0)
    statement = insert(JobRun).values(name=JOB, ran_at=now, detail={"removed": removed})
    await db.execute(
        statement.on_conflict_do_update(
            index_elements=["name"], set_={"ran_at": now, "detail": {"removed": removed}}
        )
    )
    return removed
