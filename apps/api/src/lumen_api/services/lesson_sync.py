"""Copies the compiled lesson files into the lesson table. Run at deploy, or from the ops console."""

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import clock
from ..models import Lesson
from .content import Content


async def sync_lessons(db: AsyncSession, content: Content) -> dict[str, Any]:
    existing = {row.id: row for row in await db.scalars(select(Lesson))}
    added: list[str] = []
    updated: list[str] = []
    for lesson_id, data in content.lessons.items():
        row = existing.get(lesson_id)
        if row is None:
            row = Lesson(
                id=lesson_id,
                number=data["number"],
                subject=data["subject"],
                object=data["object"],
                title=data["title"],
                data=data,
            )
            db.add(row)
            added.append(lesson_id)
        elif row.data != data:
            updated.append(lesson_id)
        row.version = data.get("version", 1)
        row.number = data["number"]
        row.subject = data["subject"]
        row.object = data["object"]
        row.title = data["title"] if isinstance(data["title"], str) else str(data["title"].get("explain", ""))
        row.threads = data["threads"]
        row.needs = data["needs"]
        row.concepts = data["concepts"]
        row.card = data["card"]
        row.data = data
        row.synced_at = clock.now()
    removed = [lesson_id for lesson_id in existing if lesson_id not in content.lessons]
    if removed:
        await db.execute(delete(Lesson).where(Lesson.id.in_(removed)))
    await db.flush()
    return {"added": added, "updated": updated, "removed": removed, "total": len(content.lessons)}
