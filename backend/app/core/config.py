"""Application settings.

One typed source of truth for every environment-driven value. Nothing else in
the codebase calls `os.environ`; a missing or misnamed variable fails here, at
startup, with a clear message, rather than somewhere deep in a request handler.

The field names map to the environment variables in AGENTS.md (`SECRET_KEY`,
`ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, …) — pydantic-settings matches them
case-insensitively, so the field is the lower-cased variable.
"""

import json
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Values read from `.env` and the process environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # Unknown variables are ignored rather than fatal: the same machine runs
        # the frontend, which has its own `.env` with `VITE_*` keys.
        extra="ignore",
    )

    environment: str = "development"

    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/urbansync"

    # The signing key for every JWT. The default is intentionally unusable:
    # `is_insecure_secret` lets startup refuse to run with it outside development.
    secret_key: str = "dev-insecure-generate-a-real-256-bit-value"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Explicit origins plus a regex for the preview deployments. Vercel gives each
    # branch its own hostname, so enumerating them would be a list that is wrong
    # the moment anyone pushes a branch.
    #
    # `NoDecode` is required: without it pydantic-settings JSON-decodes every
    # list-typed variable *before* the validator below runs, so the natural
    # `CORS_ORIGINS=http://a,http://b` in a compose file would fail with a parse
    # error the validator never gets to see.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    cors_origin_regex: str = r"https://[a-z0-9-]+\.vercel\.app"

    @field_validator("database_url", mode="before")
    @classmethod
    def _async_driver(cls, value: object) -> object:
        """Normalise a plain PostgreSQL URL to the async driver.

        Managed platforms (Railway, Heroku, Render) hand out
        `postgresql://...` or `postgres://...` without a driver. SQLAlchemy
        would resolve that to psycopg2, which this async-only project does not
        install. Rewriting here means the platform variable can be pasted as-is;
        a URL that already names a driver, or a SQLite URL, is left untouched.
        """
        if isinstance(value, str):
            if value.startswith("postgres://"):
                return f"postgresql+asyncpg://{value[len('postgres://') :]}"
            if value.startswith("postgresql://"):
                return f"postgresql+asyncpg://{value[len('postgresql://') :]}"
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept `a,b,c` or a JSON array.

        `NoDecode` turned off pydantic-settings' own JSON parsing, so the JSON
        form has to be decoded here explicitly — both spellings are in use:
        `.env.example` shows the JSON array, `docker-compose.yml` the comma list.
        """
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                return json.loads(text)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_insecure_secret(self) -> bool:
        """True while the secret is still the placeholder or trivially short."""
        return self.secret_key.startswith("dev-insecure") or len(self.secret_key) < 32


@lru_cache
def get_settings() -> Settings:
    """Settings are read once and shared. `lru_cache` makes it a singleton without
    a module-level global that tests cannot replace."""
    return Settings()
