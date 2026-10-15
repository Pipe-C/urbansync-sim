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

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
