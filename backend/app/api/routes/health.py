"""Liveness and readiness in one endpoint.

The frontend's TopBar shows a connection state, and the deployment smoke test
asks the same question, so this is the single place that answers "is the API up,
and is its database reachable". It reports the database honestly rather than
claiming `ok` because the process booted: a server that answers HTTP but cannot
reach Postgres is not healthy, and saying so is the whole point of the route.
"""

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    db: Literal["ok", "down"]


@router.get("/health", response_model=HealthResponse)
async def health(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    """`SELECT 1` is the cheapest statement that proves the pool can borrow a
    connection and the server can answer; anything heavier would make a health
    check a load test."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        # Deliberately broad: any failure to reach the database is "down" from
        # the caller's point of view, and the reason belongs in the logs, not in
        # an unauthenticated response.
        return HealthResponse(status="degraded", db="down")

    return HealthResponse(status="ok", db="ok")
