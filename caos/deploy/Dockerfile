# syntax=docker/dockerfile:1
#
# CAOS single-process image: builds the Next.js static export, then bakes it
# into the FastAPI server so one container serves /api + the UI at /.
# Build context is the repository root. The deny-by-default /.dockerignore is
# the build-input API (see deploy/docker-compose.yml).

# ─── Stage 1: build the Next.js static export (output: "export" → ./out) ─────
# Base images pinned by digest for reproducibility (#24); the tag is kept for
# readability. Refresh the digest deliberately when bumping the base for CVEs:
#   docker buildx imagetools inspect node:24-slim --format '{{.Manifest.Digest}}'
FROM node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS frontend
WORKDIR /frontend
COPY caos/frontend/package.json caos/frontend/package-lock.json ./
RUN npm ci
COPY caos/frontend/ ./
RUN npm run build

# ─── Stage 2: Python runtime (FastAPI + static UI) ──────────────────────────
# Pinned by digest (#24); refresh with:
#   docker buildx imagetools inspect python:3.14-slim --format '{{.Manifest.Digest}}'
FROM python:3.14-slim@sha256:cea0e6040540fb2b965b6e7fb5ffa00871e632eef63719f0ea54bca189ce14a6 AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=production
WORKDIR /app

# Scanned/image PDFs carry no text layer — pypdf yields 0 chunks. ocrmypdf (wraps
# Tesseract + Ghostscript) is the last-resort OCR lane, shelled out via
# CAOS_OCRMYPDF_CMD only when markitdown and pypdf both come back empty. Own layer,
# before the pip install, so it caches independently of the app deps. Heavier OCR
# (tables/equations) = olmOCR, but that needs a GPU → Phase-2.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ocrmypdf tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Python deps first for layer caching. If a wheel build ever fails on slim,
# add: RUN apt-get update && apt-get install -y --no-install-recommends gcc
#
# Fully-pinned, hashed lockfile — the single integrity fix the old two-install
# layout called out (#24). requirements.lock is pip-compiled from
# server/requirements-lock.in with --generate-hashes, so the
# whole transitive tree (incl. markitdown's) is exact and hash-verified, and
# --require-hashes makes pip reject any artifact whose hash doesn't match.
# Regenerate after editing requirements.txt:
#   pip-compile --generate-hashes --strip-extras \
#     --output-file=server/requirements.lock server/requirements-lock.in
# The app shells out to markitdown via CAOS_MARKITDOWN_CMD; this 3.14 runtime
# installs the CLI straight onto PATH (/usr/local/bin/markitdown). [pdf] not
# [all] — PDF pilot; xlsx falls back to the built-in openpyxl path.
COPY caos/server/requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

# App source, immutable runtime resources, then the built UI from stage 1
# (served by StaticFiles at /). The two external paths are the exact paths
# resolved by engine.synth/prompt_bundles and routes.rv respectively.
COPY caos/server/ ./
COPY --chown=0:0 ["Modular OS", "/Modular OS"]
COPY --chown=0:0 caos/frontend/src/lib/command/market-data.json \
  /frontend/src/lib/command/market-data.json
COPY --chown=0:0 caos/deploy/verify_image_resources.py \
  /app/verify_image_resources.py
COPY --from=frontend /frontend/out ./static

# Drop root.
RUN useradd -m -u 10001 caos && chown -R caos:caos /app
USER caos

# Run through the production Python consumers as the final runtime UID. This
# validates prompt presence/fingerprints, both manifest-backed bundles, and the
# RV JSON at its consumer-resolved path before an image can finish building.
RUN python verify_image_resources.py

EXPOSE 8000

# /api/health is the only unauthenticated route — safe for a liveness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"

# run.py binds 0.0.0.0:$PORT because HOST=0.0.0.0; init_db() runs alembic on boot.
CMD ["python", "run.py"]
