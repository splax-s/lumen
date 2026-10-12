"""Test setup: a real Postgres database migrated with Alembic, and an in-memory Redis."""

import os
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://lumen@127.0.0.1:5433/lumen_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["LUMI_PROVIDER"] = "none"
os.environ["DEV_PLAN_OVERRIDE"] = ""
os.environ.setdefault("LESSONS_DIST", str(Path(__file__).parents[3] / "packages" / "lessons" / "dist"))

from lumen_api import clock  # noqa: E402
from lumen_api.config import get_settings  # noqa: E402
from lumen_api.db import Base, get_session  # noqa: E402
from lumen_api.deps import get_redis  # noqa: E402
from lumen_api.main import create_app  # noqa: E402

API_ROOT = Path(__file__).parents[1]
HEADERS = {"X-Lumen-Client": "test"}
PASSWORD = "correct horse battery"


@pytest.fixture(scope="session")
def migrated() -> None:
    """Builds the schema with the real migrations, which also proves they run from empty."""
    config = AlembicConfig(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.downgrade(config, "base")
    command.upgrade(config, "head")


@pytest.fixture(scope="session")
async def engine(migrated: None) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(TEST_DATABASE_URL)
    yield engine
    await engine.dispose()


@pytest.fixture
async def sessions(engine: AsyncEngine) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    yield async_sessionmaker(engine, expire_on_commit=False)
    tables = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def db(sessions: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    async with sessions() as session:
        yield session


@pytest.fixture
def redis() -> FakeAsyncRedis:
    return FakeAsyncRedis(decode_responses=True)


@pytest.fixture
def app(sessions: async_sessionmaker[AsyncSession], redis: FakeAsyncRedis) -> Any:
    get_settings.cache_clear()
    application = create_app()

    async def session_override() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    application.dependency_overrides[get_session] = session_override
    application.dependency_overrides[get_redis] = lambda: redis
    return application


def make_client(app: Any) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=HEADERS)


@pytest.fixture
async def client(app: Any) -> AsyncIterator[AsyncClient]:
    async with make_client(app) as c:
        yield c


@pytest.fixture
async def other(app: Any) -> AsyncIterator[AsyncClient]:
    """A second browser, for a second person."""
    async with make_client(app) as c:
        yield c


@pytest.fixture
async def anonymous(app: Any) -> AsyncIterator[AsyncClient]:
    async with make_client(app) as c:
        yield c


async def sign_up(client: AsyncClient, email: str | None = None, **extra: Any) -> dict[str, Any]:
    body = {
        "email": email or f"parent-{uuid.uuid4().hex[:8]}@example.com",
        "password": PASSWORD,
        "country": "NG",
        "consent": {"terms": True, "privacy": True, "is_adult": True},
        **extra,
    }
    response = await client.post("/auth/signup", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


async def add_profile(client: AsyncClient, nickname: str = "Ada", band: str = "under_13") -> dict[str, Any]:
    response = await client.post("/profiles", json={"nickname": nickname, "birth_year_band": band})
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


@pytest.fixture
def frozen(monkeypatch: pytest.MonkeyPatch) -> Any:
    """Sets the clock. Call it with a datetime, or with nothing for a fixed default."""

    def freeze(when: datetime | None = None) -> datetime:
        moment = when or datetime(2026, 10, 12, 10, 0, tzinfo=UTC)
        monkeypatch.setattr(clock, "now", lambda: moment)
        return moment

    return freeze
