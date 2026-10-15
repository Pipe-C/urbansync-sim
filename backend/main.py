"""Process entry point.

    uvicorn main:app --reload --port 8000

The ASGI callable this process serves is FastAPI wrapped by the Socket.io
server, assembled in exactly one place. Socket.io answers `/socket.io/`; every
REST route falls through to the FastAPI app untouched.
"""

from app.api.ws.server import asgi_app
from app.main import create_app

fastapi_app = create_app()
app = asgi_app(fastapi_app)
