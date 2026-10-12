"""One place to ask what time it is, so tests can set the clock."""

from datetime import UTC, datetime


def now() -> datetime:
    return datetime.now(UTC)
