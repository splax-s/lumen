"""Sign-in sessions, kept in Redis as opaque tokens."""

import json
import uuid
from dataclasses import dataclass
from typing import Literal

from redis.asyncio import Redis

from .security import new_token

COOKIE = "lumen_session"
SessionKind = Literal["account", "pupil"]


@dataclass(frozen=True)
class SessionData:
    kind: SessionKind
    subject_id: uuid.UUID


def _key(token: str) -> str:
    return f"session:{token}"


def _index(subject_id: uuid.UUID) -> str:
    return f"sessions-of:{subject_id}"


async def create_session(redis: Redis, kind: SessionKind, subject_id: uuid.UUID, ttl_seconds: int) -> str:
    token = new_token()
    await redis.set(_key(token), json.dumps({"kind": kind, "id": str(subject_id)}), ex=ttl_seconds)
    await redis.sadd(_index(subject_id), token)
    await redis.expire(_index(subject_id), ttl_seconds)
    return token


async def read_session(redis: Redis, token: str | None) -> SessionData | None:
    if not token or len(token) > 128:
        return None
    raw = await redis.get(_key(token))
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        return SessionData(kind=data["kind"], subject_id=uuid.UUID(data["id"]))
    except (ValueError, KeyError, TypeError):
        return None


async def end_session(redis: Redis, token: str | None) -> None:
    if token:
        await redis.delete(_key(token))


async def end_all_sessions(redis: Redis, subject_id: uuid.UUID) -> None:
    """Signs a person out everywhere, for example when their account or profile is deleted."""
    tokens = await redis.smembers(_index(subject_id))
    if tokens:
        await redis.delete(*[_key(str(token)) for token in tokens])
    await redis.delete(_index(subject_id))
