# UrbanSync Sim API.
#
# Pinned to 3.11 to match the stack AGENTS.md documents. Local development here
# runs 3.14 and every dependency installs and passes on both; neither version is
# used for anything 3.12+ only, so the two agree at the source level.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl is only for the healthcheck below; kept out of the image's runtime needs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Requirements first: this layer is rebuilt only when the dependencies change,
# not on every source edit.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway assigns its own port; local Docker and compose keep 8000. The
# healthcheck below expands the same variable, so both paths agree.
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD-SHELL curl -fsS "http://localhost:${PORT}/health" || exit 1

# The database is migrated and the demo operator seeded before serving. For this
# single-replica academic deployment that is the same ordering compose uses and
# keeps a fresh Railway volume from booting against an empty schema; a
# multi-replica service would move migrations to a release step instead.
CMD ["sh", "-c", "alembic upgrade head && python -m app.db.seed && uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
