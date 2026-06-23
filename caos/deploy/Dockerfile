# syntax=docker/dockerfile:1
#
# CAOS single-process image: builds the Next.js static export, then bakes it
# into the FastAPI server so one container serves /api + the UI at /.
# Build context is the caos/ dir (see deploy/docker-compose.yml).

# ─── Stage 1: build the Next.js static export (output: "export" → ./out) ─────
FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python runtime (FastAPI + static UI) ──────────────────────────
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=production
WORKDIR /app

# Python deps first for layer caching. If a wheel build ever fails on slim,
# add: RUN apt-get update && apt-get install -y --no-install-recommends gcc
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Structure-preserving document extraction (covenant tables, multi-column credit
# agreements). The dev venv is 3.9 so the app shells out to markitdown via
# CAOS_MARKITDOWN_CMD; this runtime is 3.11, so the CLI installs straight onto
# PATH (/usr/local/bin/markitdown). [pdf] also covers EDGAR .htm exhibits; xlsx
# falls back to the built-in openpyxl path. ponytail: [pdf] not [all] — PDF pilot.
# -c requirements.txt: constrain this second install to the already-pinned set so
# markitdown's transitive deps can't silently bump a shared dep (e.g. starlette
# past the fastapi==0.138.* floor) with no lockfile to catch it. D9. (Pinning
# markitdown's own version + image digests is a follow-up needing a built-image
# `pip freeze` / `docker pull` pass — can't resolve offline.)
RUN pip install --no-cache-dir -c requirements.txt 'markitdown[pdf]'

# App source, then the built UI from stage 1 (served by StaticFiles at /).
COPY server/ ./
COPY --from=frontend /frontend/out ./static

# Drop root.
RUN useradd -m -u 10001 caos && chown -R caos:caos /app
USER caos

EXPOSE 8000

# /api/health is the only unauthenticated route — safe for a liveness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"

# run.py binds 0.0.0.0:$PORT because HOST=0.0.0.0; init_db() runs alembic on boot.
CMD ["python", "run.py"]
