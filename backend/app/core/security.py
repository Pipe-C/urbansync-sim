"""Password hashing and JWT issuance.

`passlib` is not used. AGENTS.md named it, but its last release was 2020 and it
cannot drive bcrypt 5: it reads `bcrypt.__about__.__version__`, removed in 4.1,
and hands bcrypt a probe hash longer than bcrypt's 72-byte limit, which bcrypt 5
raises on instead of silently truncating. The hashing itself is unchanged —
bcrypt at the same cost — so this is the same guarantee with fewer layers that
can break under a dependency bump.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

# Cost factor. 12 is the current conventional floor for interactive logins: slow
# enough to make offline guessing expensive, fast enough that a login is not
# perceptibly delayed.
BCRYPT_ROUNDS = 12

# bcrypt reads at most 72 bytes and, as of 5.0, refuses longer input rather than
# truncating it. Truncating here is explicit about the boundary the algorithm
# always had, and it keeps a long password from turning a login into a 500.
BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Return a bcrypt hash, salt included, as ASCII text fit for a column."""
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode(
        "ascii"
    )


def verify_password(password: str, hashed_password: str) -> bool:
    """Constant-time comparison via bcrypt.

    A malformed stored hash returns `False` rather than raising: a corrupt row in
    `users` should fail one login, not take down the endpoint for every user.
    """
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(password), hashed_password.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(*, subject: str, issued_at: datetime, expires_at: datetime) -> tuple[str, str]:
    """Sign a JWT and return `(token, token_id)`.

    The `jti` is generated here and returned so the caller can persist it in
    `sessions` — that row is what makes the token revocable, and a `jti` that was
    never stored is a revocation handle nobody holds.
    """
    settings = get_settings()
    token_id = str(uuid4())

    claims: dict[str, Any] = {
        "sub": subject,
        "jti": token_id,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    token = jwt.encode(claims, settings.secret_key, algorithm=settings.algorithm)
    return token, token_id


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify signature and expiry, or raise `JWTError`.

    `python-jose` raises `ExpiredSignatureError` (a `JWTError` subclass) on an
    expired token, so callers catch one exception type for every way a token can
    be unusable.
    """
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def token_expiry(now: datetime | None = None) -> datetime:
    """`now + ACCESS_TOKEN_EXPIRE_MINUTES`, in UTC."""
    settings = get_settings()
    return (now or datetime.now(UTC)) + timedelta(minutes=settings.access_token_expire_minutes)


__all__ = [
    "BCRYPT_ROUNDS",
    "JWTError",
    "create_access_token",
    "decode_access_token",
    "hash_password",
    "token_expiry",
    "verify_password",
]
