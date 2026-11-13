"""Password-reset email delivery and its development fallback."""

import logging

import pytest

from app.core.config import Settings
from app.services import email as email_service

RESET_URL = "http://127.0.0.1:5173/reset-password?token=secret-token"


async def test_development_without_smtp_logs_the_reset_link(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Local development has no mail provider. Printing the link is what makes
    the flow testable without one; production must never do this."""
    monkeypatch.setattr(
        email_service,
        "get_settings",
        lambda: Settings(environment="development", smtp_host=None),
    )

    with caplog.at_level(logging.WARNING):
        await email_service.send_password_reset_email(
            recipient="operator@urbansync.sim",
            display_name="Operator",
            reset_url=RESET_URL,
        )

    assert RESET_URL in caplog.text


async def test_production_without_smtp_does_not_log_the_reset_link(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """A missing production mail configuration is an operational error, not a
    reason to put a working reset token in the logs."""
    monkeypatch.setattr(
        email_service,
        "get_settings",
        lambda: Settings(
            environment="production",
            secret_key="x" * 48,
            smtp_host=None,
        ),
    )

    with caplog.at_level(logging.ERROR):
        await email_service.send_password_reset_email(
            recipient="operator@urbansync.sim",
            display_name="Operator",
            reset_url=RESET_URL,
        )

    assert "not sent" in caplog.text
    assert RESET_URL not in caplog.text
