"""The simulation socket server: it streams a run's ticks over Socket.io.

WHY SOCKET.IO AND NOT A RAW `/ws` ROUTE

PLAN.md's Phase 2 bullet wrote the endpoint as `/ws/simulation/{session_id}`.
Three other places disagree with that literal path and agree with each other:
the AGENTS.md stack table pairs the frontend's `socket.io-client` with a "FastAPI
socketio backend", the tech-decisions log chose *python-socketio over FastAPI WS*
for "rooms, namespaces, auto-reconnect", and Phase 4 replaces the mock ticker
with a Socket.io connection. The transport that the consumer actually speaks is
therefore Socket.io, which owns its own handshake path (`/socket.io/`) and cannot
carry a path parameter. The session id travels as connection data instead, and
each connection joins a room named after it — which is what `rooms` were chosen
for in the first place.

WHAT THIS LAYER DOES

A client connects to the `/simulation` namespace, names a session, and joins that
session's room. It sends the operator's configuration on `submit_config`; the
server starts a `SimulationEngine` for that session and streams its events to the
room — `tick` ten times a second, `phase_change` and `evp_activated` as they
happen, `session_ended` at the horizon. `stop_session` ends a run early, and a
disconnect ends the run its connection started so a task is not left ticking into
an empty room.

The lifecycle lives in `hub.py`, which knows nothing about Socket.io; this module
is only the wire — validate a payload, start or stop a run, translate events to
`emit` calls. The stream is public and read-only: no token, any origin. That
matches the stub it replaces (the REST API is where credentials travel) and is
recorded here so it is a decision on the record and not an omission — which is
why starting a run is bounded by the hub's capacity rather than by auth.
"""

from typing import Any

import socketio
from pydantic import ValidationError

from app.api.ws.hub import HubAtCapacity, SessionHub, engine_config
from app.schemas.stream import SimulationStopRequest, SimulationStreamRequest

# CORS for the engine.io handshake. The simulation stream is public and, for now,
# read-only and unauthenticated, so any origin may open it. The REST API is where
# the strict origin list applies, because that is where credentials travel; when a
# token is put on the socket, this must narrow with it.
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

SIMULATION_NAMESPACE = "/simulation"


def _room_for(session_id: str) -> str:
    return f"session:{session_id}"


def _session_id_from(environ: dict[str, Any], auth: dict[str, Any] | None) -> str | None:
    """The client may pass the id in the connection `auth` payload (Socket.io 4)
    or as a query parameter (`?sessionId=…`), which is what a plain `websocket`
    URL can carry. Both are accepted so a curl-style probe and the app agree."""
    if auth and auth.get("sessionId"):
        return str(auth["sessionId"])

    query = environ.get("QUERY_STRING", "")
    for pair in query.split("&"):
        key, _, value = pair.partition("=")
        if key == "sessionId" and value:
            return value

    return None


async def _emit(session_id: str, kind: str, payload: dict[str, Any]) -> None:
    """The hub's `Emit`, in the socket's terms: event name, room, namespace.

    The event's `kind` becomes the Socket.io event name verbatim (`tick`,
    `phase_change`, …), and the session id rides in the body so an observer can
    tell which run a tick belongs to without tracking rooms itself.
    """
    await sio.emit(
        kind,
        {"sessionId": session_id, **payload},
        room=_room_for(session_id),
        namespace=SIMULATION_NAMESPACE,
    )


hub = SessionHub(_emit)

#: Which connection started a session's run, so a disconnect can stop it. A run is
#: scoped to the connection that asked for it; an observer that only watches reads
#: the room and owns nothing to release.
_owners: dict[str, str] = {}


async def _status(sid: str, payload: dict[str, Any]) -> None:
    await sio.emit(
        "simulation_status",
        {"connected": True, **payload},
        to=sid,
        namespace=SIMULATION_NAMESPACE,
    )


async def _reject(sid: str, message: str) -> None:
    await _status(sid, {"ticking": False, "error": message})


@sio.event(namespace=SIMULATION_NAMESPACE)
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None) -> bool:
    """Accept the connection and join its session room.

    A connection without a session id is accepted too: the observer opens the
    stream before a run exists, and refusing it would make the client reconnect
    in a loop over a state that is not an error. `ticking` reports whether a run
    is already alive for the session, so a client that keys its "live" badge off
    it never claims data it is not receiving.
    """
    session_id = _session_id_from(environ, auth)
    if session_id:
        await sio.enter_room(sid, _room_for(session_id), namespace=SIMULATION_NAMESPACE)

    await _status(
        sid,
        {"sessionId": session_id, "ticking": bool(session_id) and hub.is_running(session_id)},
    )
    return True


@sio.event(namespace=SIMULATION_NAMESPACE)
async def disconnect(sid: str, reason: str) -> None:
    """Stop every run this connection started.

    The run belongs to whoever asked for it; leaving it ticking after its owner
    has gone would spend the engine on a room no one is reading. Runs started by a
    connection that is still open are untouched.
    """
    owned = [session_id for session_id, owner in _owners.items() if owner == sid]
    for session_id in owned:
        _owners.pop(session_id, None)
        await hub.stop(session_id)


@sio.on("submit_config", namespace=SIMULATION_NAMESPACE)
async def submit_config(sid: str, data: dict[str, Any] | None) -> None:
    """Start (or restart) the run named by `sessionId` with the given config."""
    try:
        request = SimulationStreamRequest.model_validate(data or {})
    except ValidationError:
        await _reject(sid, "Configuración inválida.")
        return

    try:
        await hub.start(engine_config(request))
    except HubAtCapacity as error:
        await _reject(sid, str(error))
        return

    _owners[request.session_id] = sid
    await _status(sid, {"sessionId": request.session_id, "ticking": True})


@sio.on("stop_session", namespace=SIMULATION_NAMESPACE)
async def stop_session(sid: str, data: dict[str, Any] | None) -> None:
    """End the named run early. Idempotent: stopping an idle session is a no-op."""
    try:
        request = SimulationStopRequest.model_validate(data or {})
    except ValidationError:
        await _reject(sid, "Sesión inválida.")
        return

    _owners.pop(request.session_id, None)
    await hub.stop(request.session_id)
    await _status(sid, {"sessionId": request.session_id, "ticking": False})


def asgi_app(other_asgi_app: Any) -> socketio.ASGIApp:
    """Wrap the FastAPI app so one process serves both.

    Socket.io owns `/socket.io/`; every other path falls through to FastAPI. The
    wrapper is built here rather than in `app.main` so the FastAPI app never has
    to know the realtime layer exists.
    """
    return socketio.ASGIApp(sio, other_asgi_app=other_asgi_app)
