"""Everything stored about one learner profile, gathered for export, and removed on deletion."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import Base
from ..models import LearnerProfile


def _plain(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def tables_holding_profile_data() -> list[tuple[type[Any], str]]:
    """Every mapped table with a foreign key to learner_profile, with the column that holds it."""
    found: list[tuple[type[Any], str]] = []
    for mapper in Base.registry.mappers:
        table = mapper.local_table
        for column in table.columns:
            if any(fk.column.table.name == "learner_profile" for fk in column.foreign_keys):
                found.append((mapper.class_, column.name))
    return sorted(found, key=lambda item: item[0].__tablename__)


async def export_profile(db: AsyncSession, profile: LearnerProfile) -> dict[str, Any]:
    out: dict[str, Any] = {
        "profile": {
            c.key: _plain(getattr(profile, c.key)) for c in inspect(LearnerProfile).mapper.column_attrs
        }
    }
    for model, column in tables_holding_profile_data():
        rows = await db.scalars(select(model).where(getattr(model, column) == profile.id))
        out[model.__tablename__] = [
            {c.key: _plain(getattr(row, c.key)) for c in inspect(model).mapper.column_attrs} for row in rows
        ]
    return out
