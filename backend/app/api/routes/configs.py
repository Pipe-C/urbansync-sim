"""`POST /configs`, `GET /configs/{id}`."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentUser, DbSession
from app.schemas.config import SimulationConfigCreate, SimulationConfigRead
from app.schemas.converters import config_to_read
from app.services import configs as configs_service

router = APIRouter(prefix="/configs", tags=["configs"])


@router.post("", response_model=SimulationConfigRead, status_code=status.HTTP_201_CREATED)
async def create_config(
    payload: SimulationConfigCreate, db: DbSession, user: CurrentUser
) -> SimulationConfigRead:
    config = await configs_service.create(db, payload=payload, owner_id=user.id)
    return config_to_read(config)


@router.get("/{config_id}", response_model=SimulationConfigRead)
async def get_config(
    config_id: UUID, db: DbSession, user: CurrentUser
) -> SimulationConfigRead:
    config = await configs_service.get(db, config_id=config_id)
    # The owner check is part of the lookup: a config that exists but is not the
    # caller's reads the same as one that does not exist.
    if config is None or (config.owner_id is not None and config.owner_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Configuración no encontrada."
        )
    return config_to_read(config)
