"""The simulation socket server — a Phase 2 stub, wired but not yet ticking.

WHY SOCKET.IO AND NOT A RAW `/ws` ROUTE

PLAN.md's Phase 2 bullet wrote the endpoint as `/ws/simulation/{session_id}`.
Three other places disagree with that literal path and agree with each other:
the AGENTS.md stack table pairs the frontend's `socket.io-client` with a "FastAPI
socketio backend", the tech-decisions log chose *python-socketio over FastAPI WS*
for "rooms, namespaces, auto-reconnect", and Phase 4 replaces the mock ticker
with a Socket.io connection. The transport that the consumer actually speaks is
therefore Socket.io, which owns its own handshake path (`/socket.io/`) and cannot
carry a path parameter. The session id travels as connection data instead, and
each connection joins a room named after it — which is what `rooms` above were
chosen for in the first place.

WHAT THIS STUB DOES, AND WHAT IT REFUSES TO DO

It establishes the channel and proves the wiring: a client connects to the
`/simulation` namespace, names a session, and joins that session's room. It emits
no metrics. The engine that produces real ticks arrives in Phase 3, and inventing
numbers here to make the socket look alive would put simulated traffic on the
same wire as measured traffic with nothing to tell them apart — the one thing
PRODUCT.md's evidence rule forbids. Until then the only event is a truthful
greeting.
"""

from typing import Any

import socketio

from app.core.config import get_settings

settings = get_settings()

# CORS for the engine.io handshake. The simulation stream is public and, for now,
# read-only and unauthenticated, so any origin may open it. The REST API is where
# the strict origin list applies, because that is where credentials travel; when
# Phase 4 puts a token on the socket, this must narrow with it.
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


@sio.event(namespace=SIMULATION_NAMESPACE)
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None) -> bool:
    """Accept the connection and join its session room.

    A connection without a session id is accepted too: the observer opens the
    stream before a run exists, and refusing it would make the client reconnect
    in a loop over a state that is not an error.
    """
    session_id = _session_id_from(environ, auth)
    if session_id:
        await sio.enter_room(sid, _room_for(session_id), namespace=SIMULATION_NAMESPACE)

    # The one honest thing the stub can say: the channel is live. `ticking` is
    # false because no engine is streaming yet — a client that keys its "live"
    # badge off this will not claim data it is not receiving.
    await sio.emit(
        "simulation_status",
        {"sessionId": session_id, "connected": True, "ticking": False},
        to=sid,
        namespace=SIMULATION_NAMESPACE,
    )
    return True


@sio.event(namespace=SIMULATION_NAMESPACE)
async def disconnect(sid: str, reason: str) -> None:
    """No per-connection state is held on the server yet, so there is nothing to
    release; the room membership is dropped by Socket.io on disconnect."""
    return None


@sio.on("submit_config", namespace=SIMULATION_NAMESPACE)
async def submit_config(sid: str, data: dict[str, Any] | None) -> None:
    """Acknowledge a configuration pushed by the client.

    Phase 4 sends the operator's configuration here to start a run. For now the
    handler only confirms receipt — accepting the shape and echoing nothing that
    looks like a result, so a client cannot mistake an acknowledgement for a tick.
    """
    await sio.emit(
        "simulation_status",
        {"received": True, "ticking": False, "sessionId": (data or {}).get("sessionId")},
        to=sid,
        namespace=SIMULATION_NAMESPACE,
    )


def asgi_app(other_asgi_app: Any) -> socketio.ASGIApp:
    """Wrap the FastAPI app so one process serves both.

    Socket.io owns `/socket.io/`; every other path falls through to FastAPI. The
    wrapper is built here rather than in `app.main` so the FastAPI app never has
    to know the realtime layer exists.
    """
    return socketio.ASGIApp(sio, other_asgi_app=other_asgi_app)
