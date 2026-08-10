# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM docker.io/library/node:22-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM docker.io/library/python:3.13-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ripgrep \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/pyproject.toml ./backend/
COPY backend/grovemd ./backend/grovemd/
RUN pip install --no-cache-dir ./backend

COPY --from=frontend-build /build/frontend/dist ./frontend/dist

ENV DATA_ROOT=/data \
    STATIC_DIR=/app/frontend/dist \
    HOST=0.0.0.0 \
    PORT=8080

EXPOSE 8080

CMD ["uvicorn", "grovemd.main:app", "--host", "0.0.0.0", "--port", "8080"]
