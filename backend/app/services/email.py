"""Outbound email for password recovery.

SMTP is configured through settings so deployments can use any provider without
a code change. In development, an absent `SMTP_HOST` logs the reset link instead
of failing the request; production logs only that delivery is not configured,
never the token itself.
"""

import logging
import smtplib
import ssl
from asyncio import to_thread
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _send(message: EmailMessage) -> None:
    settings = get_settings()
    smtp_host = settings.smtp_host
    if smtp_host is None:
        return

    context = ssl.create_default_context()

    if settings.smtp_use_ssl:
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            smtp_host, settings.smtp_port, context=context, timeout=15
        )
    else:
        client = smtplib.SMTP(smtp_host, settings.smtp_port, timeout=15)

    with client:
        client.ehlo()
        if settings.smtp_use_starttls and not settings.smtp_use_ssl:
            client.starttls(context=context)
            client.ehlo()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password or "")
        client.send_message(message)


async def send_password_reset_email(
    *, recipient: str, display_name: str, reset_url: str
) -> None:
    """Send the reset link, or record it locally when SMTP is not configured."""
    settings = get_settings()

    if not settings.smtp_host:
        if settings.is_production:
            logger.error(
                "SMTP_HOST is not configured; password reset email for %s was not sent.",
                recipient,
            )
        else:
            logger.warning(
                "SMTP_HOST is not configured. Password reset link for %s: %s",
                recipient,
                reset_url,
            )
        return

    message = EmailMessage()
    message["Subject"] = "Restablece tu contraseña de UrbanSync Sim"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(
        f"Hola {display_name},\n\n"
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta "
        "en UrbanSync Sim.\n\n"
        f"{reset_url}\n\n"
        f"El enlace vence en {settings.password_reset_expire_minutes} minutos. "
        "Si no hiciste esta solicitud, puedes ignorar este correo.\n"
    )

    try:
        await to_thread(_send, message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send password reset email to %s.", recipient)
