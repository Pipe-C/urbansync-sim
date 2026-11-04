"""Settings parsing.

These cover the layer the request tests do not reach: how a value written in a
compose file or on a platform's dashboard becomes a typed setting. The
`cors_origins` case is a real bug that only appeared when the variable was set in
the environment — the unit tests use the default and never saw it.
"""

import pytest

from app.core.config import Settings, get_settings
from app.main import create_app


def test_cors_origins_accepts_a_comma_separated_string(monkeypatch: pytest.MonkeyPatch) -> None:
    """The form an operator actually writes: `CORS_ORIGINS=http://a,http://b`.

    pydantic-settings would otherwise try to JSON-decode the list field and fail
    before the split runs.
    """
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test,http://b.test")

    assert Settings().cors_origins == ["http://a.test", "http://b.test"]


def test_cors_origins_accepts_a_json_array(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", '["http://a.test"]')

    assert Settings().cors_origins == ["http://a.test"]


def test_cors_origins_trims_whitespace(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " http://a.test , http://b.test ")

    assert Settings().cors_origins == ["http://a.test", "http://b.test"]


def test_database_url_gets_the_async_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    """Railway hands out `postgresql://`; the async engine needs `+asyncpg`."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@db:5432/app")

    assert Settings().database_url == "postgresql+asyncpg://user:pass@db:5432/app"


def test_legacy_postgres_scheme_gets_the_async_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@db:5432/app")

    assert Settings().database_url == "postgresql+asyncpg://user:pass@db:5432/app"


def test_database_url_with_a_driver_is_left_alone(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@db:5432/app")

    assert Settings().database_url == "postgresql+asyncpg://user:pass@db:5432/app"


def test_sqlite_database_url_is_left_alone(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./urbansync.db")

    assert Settings().database_url == "sqlite+aiosqlite:///./urbansync.db"


def test_insecure_secret_is_detected() -> None:
    """Startup refuses to run with the placeholder outside development; this is
    the check that decides it."""
    assert Settings(secret_key="dev-insecure-generate-a-real-256-bit-value").is_insecure_secret
    assert Settings(secret_key="short").is_insecure_secret
    assert not Settings(secret_key="x" * 48).is_insecure_secret


def test_production_app_refuses_the_placeholder_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """The check is wired into the factory, not just available as a property."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "dev-insecure-generate-a-real-256-bit-value")
    get_settings.cache_clear()

    try:
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            create_app()
    finally:
        get_settings.cache_clear()
