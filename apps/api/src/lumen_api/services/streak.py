"""Day streaks, with rest days. The web app keeps the same rules for learners with no account."""

from dataclasses import dataclass
from datetime import date

REST_DAYS = 2


@dataclass
class StreakState:
    current: int = 0
    longest: int = 0
    last_day: date | None = None
    rest_days_left: int = REST_DAYS


def next_streak(streak: StreakState, today: date) -> StreakState:
    if streak.last_day == today:
        return streak
    if streak.last_day is None or streak.current == 0:
        return StreakState(1, max(streak.longest, 1), today, REST_DAYS)
    missed = (today - streak.last_day).days - 1
    if missed < 0:
        return streak
    if missed <= streak.rest_days_left:
        current = streak.current + 1
        return StreakState(current, max(streak.longest, current), today, streak.rest_days_left - missed)
    return StreakState(1, streak.longest, today, REST_DAYS)
