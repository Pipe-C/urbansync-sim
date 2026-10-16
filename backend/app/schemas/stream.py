"""The realtime start/stop payloads.

The socket carries JSON, not a `Request`, so these schemas are the socket's
contract stated the same way the REST bodies are: camelCase via `CamelModel`, and
bounds that match the REST config schema because a client is not a security
boundary on either transport.

`submit_config` carries the operator's configuration — the same object the config
screen already validates and the `POST /configs` route already accepts, reused
here rather than restated so the two cannot drift about what a valid junction is.
"""

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.config import SimulationConfigCreate


def _session_id() -> str:
    """A session id: the run's own key, not the database's UUID.

    Bounded and non-empty. The socket stream is unauthenticated for now, so the
    id is a room label rather than a credential; the length cap is only there to
    stop an absurd one from becoming a memory key.
    """
    return Field(min_length=1, max_length=64)


class SimulationStreamRequest(CamelModel):
    """`submit_config`: start (or restart) the run for `session_id`."""

    session_id: str = _session_id()
    config: SimulationConfigCreate


class SimulationStopRequest(CamelModel):
    """`stop_session`: end the run for `session_id` early."""

    session_id: str = _session_id()
