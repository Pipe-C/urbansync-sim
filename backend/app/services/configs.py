"""Configuration persistence."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.simulation_config import SimulationConfig
from app.schemas.config import SimulationConfigCreate


async def create(
    db: AsyncSession, *, payload: SimulationConfigCreate, owner_id: UUID | None
) -> SimulationConfig:
    """Store a configuration. The operator's weights are the only ones kept —
    the emergency stream's share is the model's and is never a request field."""
    config = SimulationConfig(
        owner_id=owner_id,
        name=payload.name,
        quiet_rate_per_minute=payload.quiet_rate_per_minute,
        type_weights=payload.type_weights.model_dump(),
        mode=payload.mode,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


async def get(db: AsyncSession, *, config_id: UUID) -> SimulationConfig | None:
    result = await db.execute(
        select(SimulationConfig).where(SimulationConfig.id == config_id)
    )
    return result.scalar_one_or_none()
