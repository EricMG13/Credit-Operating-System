# syntax=docker/dockerfile:1
#
# CAOS single-process image: builds the Next.js static export, then bakes it
# into the FastAPI server so one container serves /api + the UI at /.
# Build context is the caos/ dir (see deploy/docker-compose.yml).

# ─── Stage 1: build the Next.js static export (output: "export" → ./out) ─────
# Base images pinned by digest for reproducibility (#24); the tag is kept for
# readability. Refresh the digest deliberately when bumping the base for CVEs:
#   docker buildx imagetools inspect node:20-slim --format '{{.Manifest.Digest}}'
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python runtime (FastAPI + static UI) ──────────────────────────
# Pinned by digest (#24); refresh with:
#   docker buildx imagetools inspect python:3.11-slim --format '{{.Manifest.Digest}}'
FROM python:3.14-slim@sha256:63a4c7f612a00f92042cbdcc7cdc6a306f38485af0a200b9c89de7d9b1607d15 AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=production
WORKDIR /app

# Python deps first for layer caching. If a wheel build ever fails on slim,
# add: RUN apt-get update && apt-get install -y --no-install-recommends gcc
#
# Fully-pinned, hashed lockfile — the single integrity fix the old two-install
# layout called out (#24). requirements.lock is pip-compiled from
# server/requirements.txt + markitdown[pdf]==0.1.6 with --generate-hashes, so the
# whole transitive tree (incl. markitdown's) is exact and hash-verified, and
# --require-hashes makes pip reject any artifact whose hash doesn't match.
# Regenerate after editing requirements.txt:
#   pip-compile --generate-hashes --strip-extras --output-file=server/requirements.lock \
#     <(cat server/requirements.txt; echo 'markitdown[pdf]==0.1.6')
# The app shells out to markitdown via CAOS_MARKITDOWN_CMD; this 3.11 runtime
# installs the CLI straight onto PATH (/usr/local/bin/markitdown). [pdf] not
# [all] — PDF pilot; xlsx falls back to the built-in openpyxl path.
COPY server/requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

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
