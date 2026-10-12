"""Settings, read from the environment or a .env file."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://lumen:lumen@localhost:5432/lumen"
    redis_url: str = "redis://localhost:6379/0"
    session_ttl_hours: int = 24 * 14
    staff_session_ttl_hours: int = 8
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    cookie_secure: bool = False

    lumi_provider: Literal["anthropic", "openai_compatible", "none"] = "none"
    lumi_model: str = "claude-opus-5-5"
    # Reasoning effort for the tutor: low, medium, high. Empty leaves it to the model's default
    # (needed for older models that do not accept the setting).
    lumi_effort: str = "low"
    lumi_timeout_seconds: float = 20.0
    anthropic_api_key: str = ""
    openai_base_url: str = ""
    openai_api_key: str = ""

    tutor_retention_days: int = 90
    lessons_dist: str = "../../packages/lessons/dist"
    dev_plan_override: Literal["", "free", "family", "school"] = ""

    # Rate limits: how many, in how many seconds.
    login_limit: int = 10
    login_window: int = 15 * 60
    signup_limit: int = 5
    signup_window: int = 60 * 60
    ask_limit: int = 20
    ask_window: int = 60 * 60
    join_limit: int = 10
    join_window: int = 15 * 60
    events_limit: int = 600
    events_window: int = 60 * 60

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def lessons_path(self) -> Path:
        return Path(self.lessons_dist)

    @property
    def effective_provider(self) -> str:
        """The provider that will actually be used. A provider with no key falls back to none."""
        if self.lumi_provider == "anthropic" and self.anthropic_api_key:
            return "anthropic"
        if self.lumi_provider == "openai_compatible" and self.openai_api_key and self.openai_base_url:
            return "openai_compatible"
        return "none"


@lru_cache
def get_settings() -> Settings:
    return Settings()
