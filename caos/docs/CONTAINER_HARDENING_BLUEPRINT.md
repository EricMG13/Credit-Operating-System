# CAOS Container-Hardening Blueprint

**Prepared:** 2026-07-15
**Purpose:** implementation specification for a later Opus 4.8 session
**Scope:** documentation only; no production Dockerfile, Compose file, script, or ignore file was changed while producing this blueprint

## Outcome

This design covers every image in the current production topology:

| Service | Final image design | Runtime identity | Writable mounts | Zero-root by design? |
|---|---|---:|---|---|
| `app` (FastAPI + static Next.js export) | Node build + Python dependency build + `python:3.14-slim` runtime | `10001:10001` | `/vault`; bounded `/scratch` tmpfs | Yes |
| `db` (Postgres + pgvector) | pgvector artifact stage + clean `postgres:18-bookworm` runtime | `999:999` | `/var/lib/postgresql`; bounded socket, temp, and `/dev/shm` tmpfs | Yes |
| `caddy` | pinned vendor artifact + distroless static runtime | `65532:65532` | `/data`, `/config` | Yes |
| `oauth2-proxy` | pinned vendor artifact + distroless static runtime | `65532:65532` | none | Yes |
| `backup` | shellcheck stage + Alpine/Postgres-client runtime | `10001:10001` | `/backups`; bounded `/tmp` tmpfs | Yes |
| `clamav` (optional `av` profile) | pinned vendor runtime with the supported unprivileged entrypoint | `clamav` (must resolve non-zero) | `/var/lib/clamav`; bounded `/tmp` and log tmpfs | Yes, subject to the mandatory UID and startup probes below |

No separate frontend runtime image exists. `caos/frontend/next.config.js` uses static export; `caos/deploy/Dockerfile` builds `frontend/out`, copies it into `/app/static`, and FastAPI serves it. The `app` image therefore covers both the Next.js build and the production web/API process.

Every service is designed to have all four runtime controls simultaneously:

1. an explicit non-root image `USER` or supported vendor non-root user, reinforced by Compose `user`;
2. `read_only: true` with only named volumes or size-bounded tmpfs mounts writable;
3. `security_opt: ["no-new-privileges:true"]`;
4. `cap_drop: ["ALL"]` and no `cap_add`.

The result is **zero-root by design**, not yet zero-root by observation. The implementation is not complete until every per-image verification block passes on the production Linux host. Any failed assertion is a release blocker.

## 1. Evidence and current-state inventory

The design was reconciled against these repository files:

- `caos/deploy/Dockerfile`: current Node-to-Python two-stage app build;
- `caos/deploy/docker-compose.yml`: the six services and all current mounts, commands, health checks, networks, and profiles;
- `caos/.dockerignore`: currently too permissive for the widened context and does not exclude nested `.env` or `.venv311` reliably;
- `caos/scripts/build_frontend.sh`: frontend export path and build behavior;
- `caos/frontend/package.json`, `package-lock.json`, `next.config.js`, TypeScript/PostCSS/Tailwind configuration, and `src/`;
- `caos/server/requirements.lock`, runtime Python packages, migrations, `deepresearch_demo.md`, `ingest.py`, `engine/synth.py`, `engine/prompt_bundles.py`, and `routes/rv.py`;
- `caos/deploy/Caddyfile`, `oauth2-proxy.cfg`, `clamd.conf`, `backup.sh`, and `restore_drill.sh`;
- `.github/workflows/ci.yml` and `.github/dependabot.yml` for image-build and update behavior.

Repo-derived requirements that must not be lost while pruning:

- `engine/synth.py` and `engine/prompt_bundles.py` resolve the methodology at `/Modular OS` in the container. The image must contain all `*/*_ACTIVE_PROMPT.md` files, the complete CP-4D and CP-2G manifest-backed bundles, and `KNOWLEDGE SOURCES/00_GOVERNANCE/CP-COMMON_PREAMBLE.md`.
- `routes/rv.py` resolves the immutable reference snapshot at `/frontend/src/lib/command/market-data.json`. Copy that one JSON file into the runtime; do not copy the frontend source tree.
- `deepresearch.py` reads `/app/deepresearch_demo.md` at runtime.
- Alembic boot migration needs `/app/alembic.ini`, `/app/migrations/env.py`, and `/app/migrations/versions/*.py`.
- Ingestion uses `tempfile` and OCR subprocesses. Set `TMPDIR=/scratch`; do not leave an unbounded `/tmp` tmpfs.
- Postgres 18 is already mounted correctly at `/var/lib/postgresql`; do not regress it to the pre-18 `/var/lib/postgresql/data` path.
- `tiktoken` is already present in both `requirements.txt` and the hashed `requirements.lock`; pre-populate its encoding cache during the build.

## 2. Fixed implementation decisions

### 2.1 Files to add or replace later

The implementation session will make this exact file-level change set:

- replace `caos/deploy/Dockerfile` with the app Dockerfile in §4;
- add `caos/deploy/Dockerfile.db` from §5;
- add `caos/deploy/Dockerfile.caddy` from §6;
- add `caos/deploy/Dockerfile.oauth2-proxy` from §7;
- add `caos/deploy/Dockerfile.backup` from §8;
- add `caos/deploy/Dockerfile.clamav` from §9;
- update `caos/deploy/docker-compose.yml` exactly as the per-service snippets specify;
- edit the Caddy listener ports described in §6.2;
- change `SCRATCH_VAULT` in `restore_drill.sh` as described in §8.2;
- replace `caos/.dockerignore` with one repository-root `.dockerignore` from §10, because all local builds will use the repository root as context;
- update the CI image build context/Dockerfile path to the repository root form in §11.

Do not introduce a seventh frontend service. Do not bind-mount application source or `Modular OS` into production. Runtime code and prompts are immutable image artifacts.

### 2.2 Build context and cache order

Every local Dockerfile uses the repository root as its build context:

```yaml
build:
  context: ../..
  dockerfile: caos/deploy/Dockerfile.<service>
```

`docker-compose.yml` is under `caos/deploy`, so `../..` resolves to the repository root. This is required to copy both `caos/` and `Modular OS/` while one root `.dockerignore` constrains the context.

Cache-order rule for every image:

1. declare digest-pinned bases;
2. install OS packages or copy dependency manifests;
3. install immutable dependencies;
4. copy source/scripts/config-derived artifacts;
5. copy final artifacts into the runtime stage;
6. set ownership/permissions, then `USER`, `ENTRYPOINT`, and `CMD`.

For the frontend, `package.json` and `package-lock.json` are copied before `src/`. For Python, only `requirements.lock` is copied before app source. For backup, runtime packages are installed before scripts are copied. The other services consume pinned vendor artifacts and have no repo dependency layer.

### 2.3 Digest pins resolved for this blueprint

These are multi-platform index digests resolved from the registries on **2026-07-15**. They are real lookup results, not placeholders.

| Use | Reference to place in Dockerfile |
|---|---|
| frontend builder | `node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583` |
| Python builder/runtime | `python:3.14-slim@sha256:d3400aa122fa42cf0af0dbe8ec3091b047eac5c8f7e3539f7135e86d855dc015` |
| pgvector artifact source | `pgvector/pgvector:0.8.5-pg18-bookworm@sha256:12a379b47ad65289572ea0756efc11b7c241a6662833e8af7038cd3b73d647e0` |
| Postgres runtime | `postgres:18-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296` |
| Caddy artifact source | `caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648` |
| OAuth2 Proxy artifact source | `quay.io/oauth2-proxy/oauth2-proxy:v7.15.3@sha256:10a1165743a192e1940b4708fb9647027185ce11a681a1c5519b442ff7f1f561` |
| distroless static runtime | `gcr.io/distroless/static-debian13:nonroot@sha256:f7f8f729987ad0fdf6b05eeeae94b26e6a0f613bdf46feea7fc40f7bd72953e6` |
| Alpine builder/runtime | `alpine:3.24@sha256:28bd5fe8a37db77a7f68c0443f585b4f48ea712b3f65a1f57252a8901a0eb6ef` |
| ClamAV vendor runtime | `clamav/clamav:1.5@sha256:7f5389ccaa2368c383fa80e167ccfe44348d71e685f926fce4755eed1757673a` |

Before implementation, re-resolve every reference and record the date and result in the implementing PR:

```bash
images=(
  'node:26-slim'
  'python:3.14-slim'
  'pgvector/pgvector:0.8.5-pg18-bookworm'
  'postgres:18-bookworm'
  'caddy:2.11.4-alpine'
  'quay.io/oauth2-proxy/oauth2-proxy:v7.15.3'
  'gcr.io/distroless/static-debian13:nonroot'
  'alpine:3.24'
  'clamav/clamav:1.5'
)
for image in "${images[@]}"; do
  printf '%s ' "$image"
  docker buildx imagetools inspect "$image" --format '{{.Manifest.Digest}}'
done
```

If a digest differs, inspect the upstream release and changelog, update the pin deliberately, and rerun the image-specific verification. Never paste a guessed digest. Keep the readable tag next to `@sha256:` so Dependabot can understand the intended release line.

### 2.4 Shared Compose baseline

Every service block must contain these directives explicitly; do not rely on an extension anchor whose omission is hard to spot in review:

```yaml
restart: unless-stopped
init: true
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
read_only: true
```

No service gets `privileged`, `cap_add`, a Docker socket, a host PID/network namespace, or a writable bind mount. Preserve the internal network and the existing rule that only Caddy publishes host ports.

## 3. Standard zero-root verification contract

Run the per-service blocks after building and starting the implemented stack. They all use the same kernel-backed assertions:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
svc=app                           # replace per section
cid=$($COMPOSE ps -q "$svc")
test -n "$cid"

# Effective configured user must be explicit and non-root.
docker inspect -f 'user={{.Config.User}}' "$cid"
configured_user=$(docker inspect -f '{{.Config.User}}' "$cid")
case "$configured_user" in
  ''|root|0|0:*|root:*) echo "root-capable Config.User: $configured_user" >&2; exit 1 ;;
esac

# No currently-running process may have UID 0.
docker top "$cid" -eo uid,pid,args
! docker top "$cid" -eo uid,pid,args | awk 'NR > 1 && $1 == 0 { found=1 } END { exit !found }'

# Root filesystem is read-only; all capabilities are dropped; NNP is active.
test "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$cid")" = true
docker inspect "$cid" | jq -e '
  .[0].HostConfig.CapDrop == ["ALL"] and
  ((.[0].HostConfig.CapAdd // []) | length == 0) and
  (.[0].HostConfig.SecurityOpt | index("no-new-privileges:true") != null)'

# Native Linux deployment host: prove the kernel process state, including
# shell-less distroless containers. Expected: four non-zero UIDs/GIDs,
# CapEff/CapBnd all zero, and NoNewPrivs 1.
pid=$(docker inspect -f '{{.State.Pid}}' "$cid")
sudo awk '/^(Uid|Gid|CapEff|CapBnd|NoNewPrivs):/' "/proc/$pid/status"
sudo awk '
  /^Uid:/ { if ($2 == 0 || $3 == 0 || $4 == 0 || $5 == 0) exit 1 }
  /^Gid:/ { if ($2 == 0 || $3 == 0 || $4 == 0 || $5 == 0) exit 1 }
  /^CapEff:/ { if ($2 != "0000000000000000") exit 1 }
  /^CapBnd:/ { if ($2 != "0000000000000000") exit 1 }
  /^NoNewPrivs:/ { if ($2 != 1) exit 1 }
' "/proc/$pid/status"
```

The `docker inspect` read-only assertion is the authoritative rootfs check for distroless images. Shell-bearing services add a negative write probe in their own sections. Do not temporarily add a shell to a production image for verification.

## 4. `app`: FastAPI plus static Next.js

### 4.1 Exact multi-stage Dockerfile pattern

Replace `caos/deploy/Dockerfile` with this structure. Keep the syntax directive current at implementation time.

```dockerfile
# syntax=docker/dockerfile:1.11

ARG NODE_IMAGE=node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583
ARG PYTHON_IMAGE=python:3.14-slim@sha256:d3400aa122fa42cf0af0dbe8ec3091b047eac5c8f7e3539f7135e86d855dc015

FROM ${NODE_IMAGE} AS frontend-deps
WORKDIR /build/frontend
COPY caos/frontend/package.json caos/frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM frontend-deps AS frontend-build
COPY caos/frontend/next.config.js \
     caos/frontend/postcss.config.js \
     caos/frontend/tailwind.config.js \
     caos/frontend/tsconfig.json \
     caos/frontend/next-env.d.ts ./
COPY caos/frontend/src ./src
RUN npm run build \
    && test -f out/index.html

FROM ${PYTHON_IMAGE} AS python-deps
WORKDIR /build
COPY caos/server/requirements.lock ./requirements.lock
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install \
      --require-hashes \
      --no-compile \
      --prefix=/install \
      -r requirements.lock
RUN mkdir -p /tiktoken-cache \
    && PYTHONPATH=/install/lib/python3.14/site-packages \
       TIKTOKEN_CACHE_DIR=/tiktoken-cache \
       python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"

FROM ${PYTHON_IMAGE} AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=production \
    TMPDIR=/scratch \
    TIKTOKEN_CACHE_DIR=/opt/tiktoken-cache
WORKDIR /app

# OCR is a genuine production dependency. Install only runtime packages here;
# never install gcc, g++, make, git, node, npm, or headers in this stage.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ocrmypdf tesseract-ocr \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/python3.14/site-packages/pip* \
              /usr/local/bin/pip* /usr/local/bin/wheel* \
    && useradd --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin caos \
    && install -d -o 10001 -g 10001 -m 0750 /vault /scratch

COPY --from=python-deps /install/ /usr/local/
COPY --from=python-deps --chown=0:0 /tiktoken-cache/ /opt/tiktoken-cache/

# The root .dockerignore permits only runtime Python/data files under these paths.
COPY --chown=0:0 caos/server/*.py ./
COPY --chown=0:0 caos/server/engine ./engine
COPY --chown=0:0 caos/server/routes ./routes
COPY --chown=0:0 caos/server/migrations ./migrations
COPY --chown=0:0 caos/server/vendor ./vendor
COPY --chown=0:0 caos/server/alembic.ini caos/server/deepresearch_demo.md ./

# Runtime-only non-code artifacts proved by repo call sites.
COPY --chown=0:0 ["Modular OS", "/Modular OS"]
COPY --chown=0:0 caos/frontend/src/lib/command/market-data.json \
    /frontend/src/lib/command/market-data.json
COPY --from=frontend-build --chown=0:0 /build/frontend/out/ ./static/

RUN chmod -R a-w /app /frontend /opt/tiktoken-cache "/Modular OS" \
    && test ! -e /app/.env \
    && test ! -e /app/tests \
    && test ! -e /app/scripts \
    && test ! -e /usr/local/bin/pip \
    && test ! -e /usr/local/bin/npm \
    && test -f /app/static/index.html \
    && test -f /frontend/src/lib/command/market-data.json \
    && test -f "/Modular OS/CP-1/CP-1_ACTIVE_PROMPT.md"

USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status == 200 else 1)"]
CMD ["python", "run.py"]
```

Why this is minimal: Node, npm, TypeScript, frontend source, pip's build environment, caches, tests, local databases, and server scripts never enter the final stage. Python source is runtime source, not development-only source. OCR prevents a fully distroless Python image; `python:3.14-slim` is the minimal practical runtime unless OCR becomes a separate service.

### 4.2 Exact Compose directives

```yaml
app:
  build:
    context: ../..
    dockerfile: caos/deploy/Dockerfile
  image: caos-app:local
  user: "10001:10001"
  restart: unless-stopped
  init: true
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  read_only: true
  tmpfs:
    - /scratch:size=1g,mode=0700,uid=10001,gid=10001
  mem_limit: 3g
  pids_limit: 256
  depends_on:
    db:
      condition: service_healthy
  environment:
    ENVIRONMENT: production
    HOST: 0.0.0.0
    PORT: "8000"
    WEB_CONCURRENCY: ${WEB_CONCURRENCY:-1}
    CAOS_DEMO_SEED: "false"
    DATABASE_URL: postgresql+asyncpg://caos:${POSTGRES_PASSWORD}@db:5432/caos
    CAOS_STORAGE_DIR: /vault
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-opus-4-8}
    EDGAR_USER_AGENT: ${EDGAR_USER_AGENT:-}
    MAX_UPLOAD_MB: ${MAX_UPLOAD_MB:-250}
    CLAMAV_HOST: ${CLAMAV_HOST:-}
    CLAMAV_PORT: ${CLAMAV_PORT:-3310}
    CAOS_MARKITDOWN_CMD: ${CAOS_MARKITDOWN_CMD:-}
    CAOS_LINEAGE_V2_ENABLED: ${CAOS_LINEAGE_V2_ENABLED:-false}
    CAOS_MARKET_XLSX_V2_ENABLED: ${CAOS_MARKET_XLSX_V2_ENABLED:-false}
    CAOS_MODEL_ENGINE_V2_ENABLED: ${CAOS_MODEL_ENGINE_V2_ENABLED:-false}
    CAOS_CP_4D_ENABLED: ${CAOS_CP_4D_ENABLED:-false}
    CAOS_CP_2G_ENABLED: ${CAOS_CP_2G_ENABLED:-false}
    EDGE_PROXY_SECRET: ${EDGE_PROXY_SECRET:?set in .env}
    SESSION_SECRET: ${SESSION_SECRET:?set in .env}
    ANALYST_SIGNUP_CODE: ${ANALYST_SIGNUP_CODE:?set in .env}
    TMPDIR: /scratch
    TIKTOKEN_CACHE_DIR: /opt/tiktoken-cache
  volumes:
    - vault-data:/vault
  networks: [internal]
```

Do not add `/tmp`; all app `tempfile` and OCR work follows `TMPDIR=/scratch`. `/vault` is the only durable writable path. Existing `vault-data` content must be readable/writable by UID 10001 before cutover:

```bash
docker compose -f caos/deploy/docker-compose.yml run --rm --no-deps \
  --user 10001:10001 app sh -c 'test -r /vault && test -w /vault'
```

If that fails, stop `app`, back up the volume, and repair ownership once using the old shell-bearing app image as root; do not grant broad `0777` permissions.

### 4.3 `app` verification

Run §3 with `svc=app`, then:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
cid=$($COMPOSE ps -q app)
test "$(docker inspect -f '{{.Config.User}}' "$cid")" = '10001:10001'

$COMPOSE exec -T app sh -ceu '
  test "$(id -u):$(id -g)" = 10001:10001
  ! touch /rootfs-write-probe
  probe=/scratch/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/vault/.caos-hardening-probe; touch "$probe"; rm "$probe"
  test -f /app/static/index.html
  test -f /frontend/src/lib/command/market-data.json
  test -f "/Modular OS/CP-1/CP-1_ACTIVE_PROMPT.md"
  test ! -e /app/.env
  test ! -e /app/data
  test ! -e /app/tests
  ! command -v gcc
  ! command -v g++
  ! command -v make
  ! command -v git
  ! command -v node
  ! command -v npm
  ! command -v pip
'
docker inspect "$cid" | jq -e '
  ([.[0].Mounts[] | select(.RW == true) | .Destination] | sort) == ["/vault"] and
  ((.[0].HostConfig.Tmpfs | keys) == ["/scratch"])'
docker inspect "$cid" | jq -e '.[0].State.Health.Status == "healthy"'
curl -fsS "https://${CAOS_DOMAIN}/api/health" | jq -e '.status == "ok" and .db == "ok"'
```

Exercise the pruned runtime artifacts and both PDF lanes directly:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
$COMPOSE exec -T app python - <<'PY'
import json
from engine.prompt_bundles import load_prompt_bundle
from engine.synth import prompt_corpus_fingerprint
from routes.rv import _REFERENCE_PATH

rows = json.loads(_REFERENCE_PATH.read_text())
assert isinstance(rows, list) and rows, "RV reference snapshot is empty"
assert prompt_corpus_fingerprint() != "noprompts"
for module in ("CP-4D", "CP-2G"):
    bundle = load_prompt_bundle(module)
    assert bundle.files and bundle.fingerprint
PY

# Native text-layer PDF: point this at an approved non-secret fixture retained
# outside the image. It must extract without OCR.
test -f "${NATIVE_PDF_FIXTURE:?set NATIVE_PDF_FIXTURE to a native-text PDF}"
$COMPOSE exec -T app python -c '
import sys
from ingest import extract_pdf_text
text, used_ocr = extract_pdf_text(sys.stdin.buffer.read(), "native.pdf")
assert text.strip() and not used_ocr
' < "$NATIVE_PDF_FIXTURE"

# Tracked scanned fixture: must use the real OCR binary and bounded /scratch.
$COMPOSE exec -T app python -c '
import sys
from ingest import extract_pdf_text
text, used_ocr = extract_pdf_text(sys.stdin.buffer.read(), "scanned.pdf")
assert used_ocr and "Atlas Forge Industrials" in text and "4.2x" in text
' < caos/tests/server/golden/scanned_atlf_earnings.pdf
```

A passing health check alone does not prove the RV snapshot, methodology corpus, or extraction tools are operational.

## 5. `db`: Postgres 18 plus pgvector

### 5.1 Exact multi-stage Dockerfile pattern

Add `caos/deploy/Dockerfile.db`. The pgvector stage supplies only the extension artifacts; the final stage is the clean official Postgres runtime, so pgvector's build toolchain cannot leak into it.

```dockerfile
# syntax=docker/dockerfile:1.11

ARG PGVECTOR_IMAGE=pgvector/pgvector:0.8.5-pg18-bookworm@sha256:12a379b47ad65289572ea0756efc11b7c241a6662833e8af7038cd3b73d647e0
ARG POSTGRES_IMAGE=postgres:18-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296

FROM ${PGVECTOR_IMAGE} AS pgvector-artifacts
RUN test -f /usr/lib/postgresql/18/lib/vector.so \
    && test -f /usr/share/postgresql/18/extension/vector.control \
    && test -n "$(find /usr/share/postgresql/18/extension -maxdepth 1 -name 'vector--*.sql' -print -quit)" \
    && test -d /usr/lib/postgresql/18/lib/bitcode/vector \
    && test -f /usr/lib/postgresql/18/lib/bitcode/vector.index.bc

FROM ${POSTGRES_IMAGE} AS runtime
COPY --from=pgvector-artifacts \
  /usr/lib/postgresql/18/lib/vector.so \
  /usr/lib/postgresql/18/lib/vector.so
COPY --from=pgvector-artifacts \
  /usr/share/postgresql/18/extension/vector* \
  /usr/share/postgresql/18/extension/
COPY --from=pgvector-artifacts \
  /usr/lib/postgresql/18/lib/bitcode/vector \
  /usr/lib/postgresql/18/lib/bitcode/vector
COPY --from=pgvector-artifacts \
  /usr/lib/postgresql/18/lib/bitcode/vector.index.bc \
  /usr/lib/postgresql/18/lib/bitcode/vector.index.bc

ENV PGDATA=/var/lib/postgresql/18/docker
USER 999:999
```

There is no repo source to copy and no dependency install layer. Do not compile pgvector in the final stage. During implementation, compare the file list in the artifact stage with these four copy families; a missing path is a stop, not a reason to use `COPY / /`.

### 5.2 Exact Compose directives

```yaml
db:
  build:
    context: ../..
    dockerfile: caos/deploy/Dockerfile.db
  image: caos-db:pg18-pgvector-0.8.5
  user: "999:999"
  restart: unless-stopped
  init: true
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  read_only: true
  tmpfs:
    - /var/run/postgresql:size=16m,mode=0770,uid=999,gid=999
    - /tmp:size=64m,mode=1777,uid=999,gid=999
  shm_size: 256m
  mem_limit: 1g
  pids_limit: 256
  environment:
    POSTGRES_USER: caos
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    POSTGRES_DB: caos
    PGDATA: /var/lib/postgresql/18/docker
  volumes:
    - db-data:/var/lib/postgresql
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U caos -d caos"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks: [internal]
```

The official entrypoint supports starting as a non-root user, but it cannot repair an old volume's ownership without root. Before cutover:

```bash
docker compose -f caos/deploy/docker-compose.yml exec -T db \
  sh -ceu 'test "$(stat -c %u:%g /var/lib/postgresql)" = 999:999 || find /var/lib/postgresql -maxdepth 2 -printf "%u:%g %p\n" | head'
```

The mount-root check is not enough. Recursively reject any entry whose UID or GID is not 999:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
bad=$($COMPOSE exec -T db sh -c \
  'find /var/lib/postgresql -xdev \( ! -uid 999 -o ! -gid 999 \) -print -quit')
test -z "$bad" || { echo "ownership mismatch: $bad" >&2; exit 1; }
```

If either check fails, stop writers, take and verify a backup, then perform a one-time controlled `chown -R 999:999` on `db-data`. Never let the hardened steady-state service start as root for migration convenience.

### 5.3 `db` verification

Run §3 with `svc=db`, then:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
cid=$($COMPOSE ps -q db)
test "$(docker inspect -f '{{.Config.User}}' "$cid")" = '999:999'

$COMPOSE exec -T db sh -ceu '
  test "$(id -u):$(id -g)" = 999:999
  ! touch /rootfs-write-probe
  probe=/var/run/postgresql/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/tmp/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/dev/shm/.caos-hardening-probe; touch "$probe"; rm "$probe"
  test -w "$PGDATA"
  ! command -v gcc
  ! command -v g++
  ! command -v make
  ! command -v git
'
docker inspect "$cid" | jq -e '
  ([.[0].Mounts[] | select(.RW == true) | .Destination] | sort) == ["/var/lib/postgresql"] and
  ((.[0].HostConfig.Tmpfs | keys | sort) == ["/tmp", "/var/run/postgresql"]) and
  .[0].HostConfig.ShmSize == 268435456'
available=$($COMPOSE exec -T db psql -U caos -d caos -Atqc \
  "SELECT default_version FROM pg_available_extensions WHERE name='vector'")
test "$available" = '0.8.5'

# Run these installed-extension checks after the app has run Alembic migration
# 0030; a database-only first boot makes the extension available but does not
# install it yet.
$COMPOSE exec -T app alembic current
installed=$($COMPOSE exec -T db psql -U caos -d caos -Atqc \
  "SELECT extversion FROM pg_extension WHERE extname='vector'")
test "$installed" = '0.8.5'
$COMPOSE exec -T db psql -U caos -d caos -v ON_ERROR_STOP=1 -c \
  'CREATE TEMP TABLE hardening_vector_probe (v vector(3)); INSERT INTO hardening_vector_probe VALUES ('\''[1,2,3]'\''); SELECT v FROM hardening_vector_probe;'
```

Pass criteria: no UID 0 process, `vector` is available and then installed at 0.8.5, the temp vector query works, and only PGDATA plus the declared socket, temp, and shared-memory mounts are writable. Docker-managed pseudo-filesystems such as `/proc` and `/dev` are outside the immutable rootfs assertion and must be reviewed from `docker inspect` mount output.

## 6. `caddy`: public TLS edge

### 6.1 Exact multi-stage Dockerfile pattern

Add `caos/deploy/Dockerfile.caddy`. Caddy is a static Go binary, so copy only that binary from the pinned vendor image into distroless.

```dockerfile
# syntax=docker/dockerfile:1.11

ARG CADDY_IMAGE=caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
ARG DISTROLESS_IMAGE=gcr.io/distroless/static-debian13:nonroot@sha256:f7f8f729987ad0fdf6b05eeeae94b26e6a0f613bdf46feea7fc40f7bd72953e6

FROM ${CADDY_IMAGE} AS caddy-artifact
RUN apk add --no-cache file libcap-utils \
    && /usr/bin/caddy version \
    && file /usr/bin/caddy | grep -q 'statically linked' \
    && setcap -r /usr/bin/caddy \
    && test -z "$(getcap /usr/bin/caddy)" \
    && install -d -o 65532 -g 65532 -m 0700 /seed/data /seed/config

FROM ${DISTROLESS_IMAGE} AS runtime
ENV XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data \
    HOME=/data
WORKDIR /srv
COPY --from=caddy-artifact --chown=65532:65532 /usr/bin/caddy /usr/bin/caddy
COPY --from=caddy-artifact --chown=65532:65532 /seed/data /data
COPY --from=caddy-artifact --chown=65532:65532 /seed/config /config
USER 65532:65532
EXPOSE 8080 8443
ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

The artifact stage removes Caddy's vendor `cap_net_bind_service` file capability because the service binds only high ports. The final bounding set is still empty as a second control. Do not copy `/bin`, `/etc`, or the vendor root filesystem into distroless.

### 6.2 Caddyfile and Compose directives

Add this global options block at the top of `caos/deploy/Caddyfile` so Caddy does not need `NET_BIND_SERVICE`:

```caddyfile
{
	http_port 8080
	https_port 8443
}
```

Keep the existing site block and header policy unchanged. Compose maps privileged host ports to unprivileged container ports:

```yaml
caddy:
  build:
    context: ../..
    dockerfile: caos/deploy/Dockerfile.caddy
  image: caos-caddy:2.11.4
  user: "65532:65532"
  restart: unless-stopped
  init: true
  depends_on:
    - oauth2-proxy
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  read_only: true
  mem_limit: 256m
  pids_limit: 128
  ports:
    - "80:8080"
    - "443:8443"
  environment:
    CAOS_DOMAIN: ${CAOS_DOMAIN:?set in .env}
    EDGE_PROXY_SECRET: ${EDGE_PROXY_SECRET:?set in .env}
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy-data:/data
    - caddy-config:/config
  networks: [internal]
```

No tmpfs is specified: Caddy's mutable state belongs in `/data` and `/config`, and stdout carries logs. The image-seeded directories give fresh volumes UID/GID 65532. Existing volumes require this exact backup and one-time migration before the new service starts:

```bash
set -eu
mkdir -p volume-backups
DATA_VOL=$(docker volume ls -q \
  --filter label=com.docker.compose.project=caos \
  --filter label=com.docker.compose.volume=caddy-data)
CONFIG_VOL=$(docker volume ls -q \
  --filter label=com.docker.compose.project=caos \
  --filter label=com.docker.compose.volume=caddy-config)
test -n "$DATA_VOL" && test -n "$CONFIG_VOL"
docker compose -f caos/deploy/docker-compose.yml stop caddy

for spec in "$DATA_VOL:caddy-data" "$CONFIG_VOL:caddy-config"; do
  vol=${spec%%:*}; name=${spec##*:}
  docker run --rm --read-only --user 0:0 \
    --security-opt no-new-privileges --cap-drop ALL --cap-add DAC_READ_SEARCH \
    --mount "source=$vol,target=/source,readonly" \
    --mount "type=bind,source=$PWD/volume-backups,target=/backup" \
    --entrypoint /bin/sh \
    caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 \
    -ceu "tar -C /source -czf /backup/$name-pre-hardening.tgz ."
  test -s "volume-backups/$name-pre-hardening.tgz"

  docker run --rm --read-only --user 0:0 \
    --security-opt no-new-privileges --cap-drop ALL \
    --cap-add CHOWN --cap-add DAC_READ_SEARCH --cap-add FOWNER \
    --mount "source=$vol,target=/target" --entrypoint /bin/sh \
    caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 \
    -ceu 'chown -R 65532:65532 /target'

  docker run --rm --read-only --user 65532:65532 \
    --security-opt no-new-privileges --cap-drop ALL \
    --mount "source=$vol,target=/target" --entrypoint /bin/sh \
    caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 \
    -ceu 'test -r /target && test -w /target; touch /target/.ownership-probe; rm /target/.ownership-probe'
done
```

These are explicitly one-shot root helpers, not production services. Their capability additions must never appear in Compose.

### 6.3 `caddy` verification

Run §3 with `svc=caddy`, then:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
cid=$($COMPOSE ps -q caddy)
test "$(docker inspect -f '{{.Config.User}}' "$cid")" = '65532:65532'
docker inspect "$cid" | jq -e '
  .[0].NetworkSettings.Ports["8080/tcp"][0].HostPort == "80" and
  .[0].NetworkSettings.Ports["8443/tcp"][0].HostPort == "443" and
  ([.[0].Mounts[] | select(.RW == true) | .Destination] | sort) == ["/config", "/data"] and
  ([.[0].Mounts[] | select(.Destination == "/etc/caddy/Caddyfile" and .RW == false)] | length) == 1 and
  ((.[0].HostConfig.Tmpfs // {}) | length) == 0'

# The final image is intentionally shell-less and the binary starts without a loader error.
if docker run --rm --entrypoint /bin/sh caos-caddy:2.11.4 -c true; then exit 1; fi
docker run --rm --read-only --user 65532:65532 --cap-drop ALL \
  --security-opt no-new-privileges caos-caddy:2.11.4 version
curl -fsS "https://${CAOS_DOMAIN}/api/health" | jq -e '.status == "ok" and .db == "ok"'
docker compose -f caos/deploy/docker-compose.yml logs --no-color caddy | tail -n 100
```

Prove certificate-storage writes with isolated volumes and a local CA before production cutover:

```bash
cat >/tmp/Caddyfile.zero-root-probe <<'EOF'
{
  admin off
  http_port 18080
  https_port 18443
  skip_install_trust
}
https://localhost {
  tls internal
  respond "ok"
}
EOF
docker volume create caos-caddy-probe-data
docker volume create caos-caddy-probe-config
docker run -d --name caos-caddy-zero-root-probe \
  --user 65532:65532 --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 \
  -p 18443:18443 \
  -v /tmp/Caddyfile.zero-root-probe:/etc/caddy/Caddyfile:ro \
  -v caos-caddy-probe-data:/data -v caos-caddy-probe-config:/config \
  caos-caddy:2.11.4
curl -kfsS --resolve localhost:18443:127.0.0.1 https://localhost:18443 | grep -qx ok
docker top caos-caddy-zero-root-probe -eo uid,pid,args
docker run --rm --user 65532:65532 --read-only --cap-drop ALL \
  -v caos-caddy-probe-data:/probe:ro --entrypoint /bin/sh \
  caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 \
  -ceu 'test -n "$(find /probe -type f -print -quit)"'
docker rm -f caos-caddy-zero-root-probe
docker volume rm caos-caddy-probe-data caos-caddy-probe-config
rm /tmp/Caddyfile.zero-root-probe
```

For public ACME, retain alerting on renewal failures. If the deployment uses `tls internal`, keep `skip_install_trust` in Caddy and explicitly distribute the persisted root CA from `/data/caddy/pki/authorities/local/root.crt` to client trust stores; a non-root distroless container cannot install host/client trust roots itself.

## 7. `oauth2-proxy`: authentication reverse proxy

### 7.1 Exact multi-stage Dockerfile pattern

Add `caos/deploy/Dockerfile.oauth2-proxy`. The upstream image is already distroless and its OCI config was observed with UID 65532. The local artifact stage makes the final contents explicit and retains only the static binary on a separately pinned distroless base.

```dockerfile
# syntax=docker/dockerfile:1.11

ARG OAUTH2_PROXY_IMAGE=quay.io/oauth2-proxy/oauth2-proxy:v7.15.3@sha256:10a1165743a192e1940b4708fb9647027185ce11a681a1c5519b442ff7f1f561
ARG DISTROLESS_IMAGE=gcr.io/distroless/static-debian13:nonroot@sha256:f7f8f729987ad0fdf6b05eeeae94b26e6a0f613bdf46feea7fc40f7bd72953e6
ARG ALPINE_IMAGE=alpine:3.24@sha256:28bd5fe8a37db77a7f68c0443f585b4f48ea712b3f65a1f57252a8901a0eb6ef

FROM ${OAUTH2_PROXY_IMAGE} AS oauth2-proxy-artifact

FROM ${ALPINE_IMAGE} AS binary-check
RUN apk add --no-cache file
COPY --from=oauth2-proxy-artifact /bin/oauth2-proxy /bin/oauth2-proxy
RUN file /bin/oauth2-proxy | grep -q 'statically linked'

FROM ${DISTROLESS_IMAGE} AS runtime
WORKDIR /home/nonroot
COPY --from=binary-check --chown=65532:65532 \
  /bin/oauth2-proxy /bin/oauth2-proxy
USER 65532:65532
EXPOSE 4180
ENTRYPOINT ["/bin/oauth2-proxy"]
```

The current CAOS config does not use the optional upstream example JWT signing-key file, so do not copy it. TLS trust comes from the distroless CA bundle.

### 7.2 Exact Compose directives

```yaml
oauth2-proxy:
  build:
    context: ../..
    dockerfile: caos/deploy/Dockerfile.oauth2-proxy
  image: caos-oauth2-proxy:v7.15.3
  user: "65532:65532"
  restart: unless-stopped
  init: true
  depends_on:
    app:
      condition: service_healthy
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  read_only: true
  mem_limit: 256m
  pids_limit: 128
  command: ["--config=/etc/oauth2-proxy.cfg"]
  environment:
    OAUTH2_PROXY_CLIENT_ID: ${OAUTH2_PROXY_CLIENT_ID:?set in .env}
    OAUTH2_PROXY_CLIENT_SECRET: ${OAUTH2_PROXY_CLIENT_SECRET:?set in .env}
    OAUTH2_PROXY_COOKIE_SECRET: ${OAUTH2_PROXY_COOKIE_SECRET:?set in .env}
    OAUTH2_PROXY_REDIRECT_URL: https://${CAOS_DOMAIN:?set in .env}/oauth2/callback
    OAUTH2_PROXY_EMAIL_DOMAINS: ${CAOS_EMAIL_DOMAIN:?set in .env}
  volumes:
    - ./oauth2-proxy.cfg:/etc/oauth2-proxy.cfg:ro
  networks: [internal]
```

Remove the current `/tmp` tmpfs. The configured proxy uses encrypted client cookies, reads one config file, and logs to stdout; no runtime disk write was found in the CAOS configuration.

### 7.3 `oauth2-proxy` verification

Run §3 with `svc=oauth2-proxy`, then:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
cid=$($COMPOSE ps -q oauth2-proxy)
test "$(docker inspect -f '{{.Config.User}}' "$cid")" = '65532:65532'
test "$(docker inspect -f '{{.HostConfig.Tmpfs}}' "$cid")" = 'map[]'
docker inspect "$cid" | jq -e '
  ([.[0].Mounts[] | select(.RW == true)] | length) == 0 and
  ([.[0].Mounts[] | select(.Destination == "/etc/oauth2-proxy.cfg" and .RW == false)] | length) == 1 and
  .[0].State.Running == true and
  .[0].RestartCount == 0'
if docker run --rm --entrypoint /bin/sh caos-oauth2-proxy:v7.15.3 -c true; then exit 1; fi
docker run --rm --read-only --user 65532:65532 --cap-drop ALL \
  --security-opt no-new-privileges --entrypoint /bin/oauth2-proxy \
  caos-oauth2-proxy:v7.15.3 --version

# Validate externally because the final image has no shell or diagnostic tools.
curl -fsS "https://${CAOS_DOMAIN}/api/health"
headers=$(mktemp)
status=$(curl -sS -D "$headers" -o /dev/null -w '%{http_code}' "https://${CAOS_DOMAIN}/")
test "$status" = 302
grep -Eqi '^location: https://accounts\.google\.com/' "$headers"
grep -Eqi '^set-cookie: .*;[[:space:]]*secure(;|$)' "$headers"
grep -Eqi '^set-cookie: .*;[[:space:]]*httponly(;|$)' "$headers"
grep -Eqi '^set-cookie: .*;[[:space:]]*samesite=lax(;|$)' "$headers"
rm "$headers"

# Obtain an OAuth2 Proxy session cookie through the real allowed-domain login;
# pass the complete "name=value" pair, never commit it or print it.
test -n "${CAOS_OAUTH_COOKIE:?set CAOS_OAUTH_COOKIE from an allowed-domain login}"
curl -fsS -H "Cookie: ${CAOS_OAUTH_COOKIE}" \
  "https://${CAOS_DOMAIN}/api/auth/me" | jq -e '.email | length > 0'
$COMPOSE logs --no-color oauth2-proxy | tail -n 100
```

The unauthenticated health route must pass; a protected route must redirect through Google and set secure cookie attributes; a real allowed-domain session must carry identity to `/api/auth/me`. Complete one denied-domain login in the IdP integration harness and assert access is refused before release—the domain restriction cannot be proved by unauthenticated curl alone. Absence of `/tmp` is intentional; any write error in logs blocks rollout and must be traced before adding a bounded writable path.

## 8. `backup`: database and vault backups

### 8.1 Exact multi-stage Dockerfile pattern

Add `caos/deploy/Dockerfile.backup`. Build-time shellcheck never enters the runtime image. Alpine's runtime contains BusyBox utilities plus only the Postgres 18 client and CA certificates.

```dockerfile
# syntax=docker/dockerfile:1.11

ARG ALPINE_IMAGE=alpine:3.24@sha256:28bd5fe8a37db77a7f68c0443f585b4f48ea712b3f65a1f57252a8901a0eb6ef

FROM ${ALPINE_IMAGE} AS script-check
RUN apk add --no-cache shellcheck
COPY caos/deploy/backup.sh caos/deploy/restore_drill.sh /src/
RUN shellcheck /src/backup.sh /src/restore_drill.sh

FROM ${ALPINE_IMAGE} AS runtime
RUN apk add --no-cache ca-certificates postgresql18-client \
    && addgroup -S -g 10001 backup \
    && adduser -S -D -H -u 10001 -G backup backup \
    && install -d -o 10001 -g 10001 -m 0750 /backups \
    && install -d -o 10001 -g 10001 -m 0750 /tmp
COPY --from=script-check --chown=10001:10001 /src/backup.sh /usr/local/bin/backup.sh
COPY --from=script-check --chown=10001:10001 /src/restore_drill.sh /usr/local/bin/restore_drill.sh
RUN chmod 0555 /usr/local/bin/backup.sh /usr/local/bin/restore_drill.sh \
    && command -v pg_dump \
    && command -v pg_restore \
    && command -v psql \
    && command -v createdb \
    && command -v dropdb \
    && ! command -v gcc \
    && ! command -v make \
    && ! command -v git
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/backup.sh"]
```

If Alpine 3.24's package is no longer named `postgresql18-client`, resolve the exact package with the pinned Alpine repository and update the blueprint/PR; do not fall back to an unversioned client whose major can drift away from Postgres 18.

### 8.2 Script and Compose directives

Change this one line in `restore_drill.sh`:

```sh
SCRATCH_VAULT="${BACKUPS_DIR:-/backups}/.restore-drill-vault"
```

The restored vault can be large, so it belongs on the disk-backed `/backups` volume rather than a large memory tmpfs. The script already removes the directory before and after the drill.

```yaml
backup:
  build:
    context: ../..
    dockerfile: caos/deploy/Dockerfile.backup
  image: caos-backup:pg18
  user: "10001:10001"
  restart: unless-stopped
  init: true
  depends_on:
    db:
      condition: service_healthy
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  read_only: true
  tmpfs:
    - /tmp:size=64m,mode=0700,uid=10001,gid=10001
  mem_limit: 512m
  pids_limit: 128
  environment:
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    BACKUP_KEEP: ${BACKUP_KEEP:-7}
    BACKUP_INTERVAL_SECONDS: ${BACKUP_INTERVAL_SECONDS:-86400}
  volumes:
    - vault-data:/vault:ro
    - backups:/backups
  networks: [internal]
```

Do not bind-mount the scripts after they are copied into the image. Remove `BACKUP_SYNC_CMD` from this service and delete the `sh -c "$BACKUP_SYNC_CMD"` block from `backup.sh`. An arbitrary command running as the owner of `/backups` can delete the local recovery set. Off-host transfer must be a separately hardened sync service with `/backups:ro`, destination-specific credentials/config, and only its scratch destination writable.

**Implemented 2026-07-17:** `backup-sync` now supplies that seventh, isolated
service. It receives rclone configuration as a Docker secret, mounts
`/backups` read-only, downloads remote artifacts into a separate recovery
volume, and runs `restore_drill.sh` against the downloaded copy before its
health check turns green.

Also make a partially failed cycle return non-zero. In `run_once`, initialize `db_ok=0` and `vault_ok=0`, set the corresponding flag to `1` only after each non-empty artifact succeeds, and finish with:

```sh
if [ "$db_ok" -eq 1 ] && [ "$vault_ok" -eq 1 ]; then
  echo "[backup] $ts complete"
  return 0
fi
echo "[backup] $ts FAILED — at least one artifact is missing" >&2
return 1
```

In `restore_drill.sh`, replace the warning-only scratch-database cleanup with a hard failure:

```sh
if ! PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U caos "$SCRATCH_DB"; then
  fail "could not drop scratch DB $SCRATCH_DB — clean it up manually"
fi
```

Before cutover, back up and migrate the existing `backups` volume exactly once:

```bash
set -eu
mkdir -p volume-backups
BACKUPS_VOL=$(docker volume ls -q \
  --filter label=com.docker.compose.project=caos \
  --filter label=com.docker.compose.volume=backups)
test -n "$BACKUPS_VOL"
docker compose -f caos/deploy/docker-compose.yml stop backup

docker run --rm --read-only --user 0:0 \
  --security-opt no-new-privileges --cap-drop ALL --cap-add DAC_READ_SEARCH \
  --mount "source=$BACKUPS_VOL,target=/source,readonly" \
  --mount "type=bind,source=$PWD/volume-backups,target=/backup" \
  --entrypoint /bin/sh \
  alpine:3.24@sha256:28bd5fe8a37db77a7f68c0443f585b4f48ea712b3f65a1f57252a8901a0eb6ef \
  -ceu 'tar -C /source -czf /backup/backups-pre-hardening.tgz .'
test -s volume-backups/backups-pre-hardening.tgz

docker run --rm --read-only --user 0:0 \
  --security-opt no-new-privileges --cap-drop ALL \
  --cap-add CHOWN --cap-add DAC_READ_SEARCH --cap-add FOWNER \
  --mount "source=$BACKUPS_VOL,target=/target" --entrypoint /bin/sh \
  alpine:3.24@sha256:28bd5fe8a37db77a7f68c0443f585b4f48ea712b3f65a1f57252a8901a0eb6ef \
  -ceu 'chown -R 10001:10001 /target'
```

Then run the verification below as UID 10001. `tar -cf /dev/null -C /vault .` is the recursive readability check; `test -r /vault` alone is insufficient.

### 8.3 `backup` verification

Run §3 with `svc=backup`, then:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
cid=$($COMPOSE ps -q backup)
test "$(docker inspect -f '{{.Config.User}}' "$cid")" = '10001:10001'

$COMPOSE exec -T backup sh -ceu '
  test "$(id -u):$(id -g)" = 10001:10001
  ! touch /rootfs-write-probe
  probe=/tmp/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/backups/.caos-hardening-probe; touch "$probe"; rm "$probe"
  test -r /vault
  tar -cf /dev/null -C /vault .
  ! touch /vault/.caos-hardening-probe
  ! command -v gcc
  ! command -v make
  ! command -v git
'
docker inspect "$cid" | jq -e '
  ([.[0].Mounts[] | select(.RW == true) | .Destination] | sort) == ["/backups"] and
  ([.[0].Mounts[] | select(.Destination == "/vault" and .RW == false)] | length) == 1 and
  ((.[0].HostConfig.Tmpfs | keys) == ["/tmp"])'

# Wait for or trigger one real backup cycle, then run the existing destructive-safe drill.
$COMPOSE exec -T backup /usr/local/bin/restore_drill.sh
$COMPOSE exec -T backup sh -ceu '
  ls -l /backups/caos-db-*.dump /backups/caos-vault-*.tar.gz
  test ! -e /backups/.restore-drill-vault
'
```

Zero-root is necessary but not sufficient: the section passes only when the latest DB dump and vault archive are non-empty and the restore drill passes. Off-host durability remains explicitly unverified until the deployment-specific remote copy is restored into an empty local volume and this same drill passes against that remote-only recovery set.

## 9. `clamav`: optional malware scanner

### 9.1 Exact vendor-runtime wrapper

ClamAV is different from the single-binary Go services: its daemon, updater, signature tooling, libraries, and init scripts form a coupled vendor runtime. Rebuilding or copying individual files would create an unmaintainable fork. The pinned official image contains the production runtime; the CAOS wrapper records the supported unprivileged policy explicitly.

Add `caos/deploy/Dockerfile.clamav`:

```dockerfile
# syntax=docker/dockerfile:1.11

ARG CLAMAV_IMAGE=clamav/clamav:1.5@sha256:7f5389ccaa2368c383fa80e167ccfe44348d71e685f926fce4755eed1757673a

# Vendor runtime stage. ClamAV's compilation happened upstream; CAOS never
# introduces a compiler or source stage for this third-party image.
FROM ${CLAMAV_IMAGE} AS vendor-runtime

# The separate final stage deliberately preserves the vendor filesystem and
# metadata while changing only the supported user/entrypoint policy.
FROM vendor-runtime AS runtime
USER 0:0
RUN rm -f /sbin/apk /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg \
    && ! command -v apk \
    && ! command -v apt \
    && ! command -v apt-get \
    && ! command -v dpkg
USER clamav
ENTRYPOINT ["/init-unprivileged"]
```

This is the one intentional exception to a locally reconstructed slim runtime. It is still a multi-stage policy wrapper around a digest-pinned vendor runtime, but it does not claim to prune ClamAV internals. The implementation must prove the image contains no compiler/build tool with the checks below. If that check fails, stop and evaluate the vendor's `*_base`/unprivileged image or build ClamAV from its signed release in a dedicated builder; do not silently accept toolchain leakage.

The official OCI image currently has no default `User` and starts `/init`; therefore both the wrapper's `USER clamav` and `/init-unprivileged` are mandatory. Never run `/init` under an arbitrary numeric user.

### 9.2 Exact Compose directives

```yaml
clamav:
  build:
    context: ../..
    dockerfile: caos/deploy/Dockerfile.clamav
  image: caos-clamav:1.5
  profiles: ["av"]
  user: "clamav"
  restart: unless-stopped
  init: true
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  read_only: true
  tmpfs:
    - /run/clamav:size=16m,mode=1777
    - /tmp:size=1g,mode=1777
    - /var/log/clamav:size=16m,mode=1777
  mem_limit: 4g
  pids_limit: 256
  volumes:
    - clamav-data:/var/lib/clamav
    - ./clamd.conf:/etc/clamav/clamd.conf:ro
  healthcheck:
    test: ["CMD", "clamdcheck.sh"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 180s
  networks: [internal]
```

`/var/lib/clamav` is writable because `freshclam` updates signatures. `/tmp` is genuinely needed by the current `clamd.conf` (`LocalSocket /tmp/clamd.sock`) and scanning/update scratch; it is bounded. `/run/clamav` is a small bounded runtime-state mount for the supported vendor entrypoint even though CAOS places the configured socket in `/tmp`. `/var/log/clamav` is bounded because vendor scripts may expect it even though production logs go to stdout. Do not make `/etc/clamav` writable.

The 1 GiB `/tmp` value is a release value only for the current defaults: `MAX_UPLOAD_MB=250`, `caos_upload_concurrency=2`, and `WEB_CONCURRENCY=1`. Any increase in upload or worker concurrency requires recalculating scratch/memory and rerunning the concurrent maximum-size scan below. Keep the 4 GiB memory limit unless measured peak RSS plus tmpfs usage supports a different value.

The vendor documentation recommends roughly 4 GiB RAM for current signature databases; keep the Compose memory limit at 4 GiB unless measurement supports another value.

Before cutover, stop ClamAV and make the existing `clamav-data` contents owned by the image's `clamav` UID/GID. Resolve those numbers from the pinned image; do not assume an old documented number:

```bash
docker run --rm --entrypoint /bin/sh \
  clamav/clamav:1.5@sha256:7f5389ccaa2368c383fa80e167ccfe44348d71e685f926fce4755eed1757673a \
  -c 'id clamav'
```

Record the observed UID/GID in the implementing PR, then back up and migrate the existing signature volume:

```bash
set -eu
PIN='clamav/clamav:1.5@sha256:7f5389ccaa2368c383fa80e167ccfe44348d71e685f926fce4755eed1757673a'
CLAMAV_UID=$(docker run --rm --entrypoint /bin/sh "$PIN" -c 'id -u clamav')
CLAMAV_GID=$(docker run --rm --entrypoint /bin/sh "$PIN" -c 'id -g clamav')
test "$CLAMAV_UID" -ne 0 && test "$CLAMAV_GID" -ne 0
CLAMAV_VOL=$(docker volume ls -q \
  --filter label=com.docker.compose.project=caos \
  --filter label=com.docker.compose.volume=clamav-data)
test -n "$CLAMAV_VOL"
mkdir -p volume-backups
docker compose -f caos/deploy/docker-compose.yml --profile av stop clamav

docker run --rm --read-only --user 0:0 \
  --security-opt no-new-privileges --cap-drop ALL --cap-add DAC_READ_SEARCH \
  --mount "source=$CLAMAV_VOL,target=/source,readonly" \
  --mount "type=bind,source=$PWD/volume-backups,target=/backup" \
  --entrypoint /bin/sh "$PIN" \
  -ceu 'tar -C /source -czf /backup/clamav-data-pre-hardening.tgz .'
test -s volume-backups/clamav-data-pre-hardening.tgz

docker run --rm --read-only --user 0:0 \
  --security-opt no-new-privileges --cap-drop ALL \
  --cap-add CHOWN --cap-add DAC_READ_SEARCH --cap-add FOWNER \
  --mount "source=$CLAMAV_VOL,target=/target" --entrypoint /bin/sh "$PIN" \
  -ceu "chown -R $CLAMAV_UID:$CLAMAV_GID /target"
```

These root helpers are one-time migration tools only. No added capability belongs in the production service.

### 9.3 `clamav` verification

Start the profile, run §3 with `svc=clamav`, then:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
$COMPOSE --profile av up -d clamav
cid=$($COMPOSE ps -q clamav)
configured_user=$(docker inspect -f '{{.Config.User}}' "$cid")
test "$configured_user" = clamav

$COMPOSE exec -T clamav sh -ceu '
  test "$(id -u)" -ne 0
  test "$(id -g)" -ne 0
  ! touch /rootfs-write-probe
  probe=/run/clamav/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/tmp/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/var/log/clamav/.caos-hardening-probe; touch "$probe"; rm "$probe"
  probe=/var/lib/clamav/.caos-hardening-probe; touch "$probe"; rm "$probe"
  ! touch /etc/clamav/.caos-hardening-probe
  ! command -v gcc
  ! command -v g++
  ! command -v make
  ! command -v git
  ! command -v apk
  ! command -v apt
  ! command -v apt-get
  ! command -v dpkg
  clamdcheck.sh
'

docker inspect "$cid" | jq -e '
  ([.[0].Mounts[] | select(.RW == true) | .Destination] | sort) == ["/var/lib/clamav"] and
  ((.[0].HostConfig.Tmpfs | keys | sort) == ["/run/clamav", "/tmp", "/var/log/clamav"])'
docker top "$cid" -eo uid,pid,args | grep -E '[f]reshclam'
$COMPOSE exec -T clamav sh -ceu '
  latest=$(find /var/lib/clamav -maxdepth 1 -type f \( -name "*.cvd" -o -name "*.cld" \) \
    -exec stat -c %Y {} \; | sort -nr | head -n1)
  test -n "$latest"
  now=$(date +%s)
  test "$((now - latest))" -lt 172800
'

# Exercise the same INSTREAM client used by every upload. EICAR is a harmless
# standard antivirus test string.
$COMPOSE exec -T app python - <<'PY'
import asyncio
from fastapi import HTTPException
from avscan import scan

async def main():
    await scan(b"ordinary CAOS upload")
    eicar = rb'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    try:
        await scan(eicar)
    except HTTPException as exc:
        assert exc.status_code == 422
    else:
        raise AssertionError("EICAR was not rejected")

asyncio.run(main())
PY

# Prove configured-but-down fails closed, then restore the scanner.
$COMPOSE --profile av stop clamav
$COMPOSE exec -T app python - <<'PY'
import asyncio
from fastapi import HTTPException
from avscan import scan

async def main():
    try:
        await scan(b"scanner-down probe")
    except HTTPException as exc:
        assert exc.status_code == 503
    else:
        raise AssertionError("unavailable scanner did not fail closed")

asyncio.run(main())
PY
$COMPOSE --profile av start clamav

# Current release sizing gate: two simultaneous 250 MiB streams under one app worker.
$COMPOSE exec -T app python - <<'PY'
import asyncio
from avscan import scan

payload = b"0" * (250 * 1024 * 1024)
async def main():
    await asyncio.gather(scan(payload), scan(payload))
asyncio.run(main())
PY
$COMPOSE logs --no-color clamav | tail -n 150
```

Before these tests, start/recreate `app` with `CLAMAV_HOST=clamav`; otherwise `avscan.scan` is intentionally a no-op and the EICAR test will catch that misconfiguration. Pass criteria: the named UID/GID resolve non-zero, no process is UID/GID 0 (including `freshclam`), signatures were refreshed within 48 hours, `clamdcheck.sh` passes, clean/EICAR/concurrent scans behave correctly, and the app fails closed when the scanner is deliberately stopped.

## 10. One comprehensive repository-root `.dockerignore`

All local builds use the repository root as context. Delete `caos/.dockerignore` and add exactly one `/.dockerignore`. This is an allow-list: everything is excluded first, then only known build/runtime inputs are restored. VCS data, secrets, tests, dev tools, caches, generated output, local DBs, `node_modules`, virtualenvs (including `.venv311`), docs, screenshots, and agent metadata therefore cannot enter any build context.

```dockerignore
# Deny everything by default. Negations below are the complete build-input API.
**

# Keep the context policy itself visible to BuildKit.
!.dockerignore

# Frontend dependency manifests and production build inputs only.
!caos/
caos/**
!caos/frontend/
caos/frontend/**
!caos/frontend/package.json
!caos/frontend/package-lock.json
!caos/frontend/next.config.js
!caos/frontend/postcss.config.js
!caos/frontend/tailwind.config.js
!caos/frontend/tsconfig.json
!caos/frontend/next-env.d.ts
!caos/frontend/src/
caos/frontend/src/**
!caos/frontend/src/**
caos/frontend/src/**/__tests__/**
caos/frontend/src/**/*.test.*
caos/frontend/src/**/*.spec.*
caos/frontend/src/.impeccable/**

# Server dependency lock and runtime Python/data only. No tests, scripts,
# checked-in static build, local data, env files, caches, or virtualenvs.
!caos/server/
caos/server/**
!caos/server/requirements.lock
!caos/server/*.py
!caos/server/alembic.ini
!caos/server/deepresearch_demo.md
!caos/server/engine/
caos/server/engine/**
!caos/server/engine/**/*.py
!caos/server/routes/
caos/server/routes/**
!caos/server/routes/**/*.py
!caos/server/migrations/
caos/server/migrations/**
!caos/server/migrations/**/*.py
!caos/server/vendor/
caos/server/vendor/**
!caos/server/vendor/**/*.py

# Backup scripts are image inputs. Other deploy config remains bind-mounted
# directly by Compose and does not need to enter a build context.
!caos/deploy/
caos/deploy/**
!caos/deploy/backup.sh
!caos/deploy/restore_drill.sh

# Runtime methodology: legacy active prompts, the two complete manifest-backed
# bundles, and their shared governance preamble. Re-include directory parents
# before files because Docker ignore traversal is parent-sensitive.
!Modular OS/
Modular OS/**
!Modular OS/*/
Modular OS/*/**
!Modular OS/*/*_ACTIVE_PROMPT.md
!Modular OS/CP-4D/
!Modular OS/CP-4D/**
!Modular OS/CP-2G/
!Modular OS/CP-2G/**
!Modular OS/KNOWLEDGE SOURCES/
Modular OS/KNOWLEDGE SOURCES/**
!Modular OS/KNOWLEDGE SOURCES/00_GOVERNANCE/
Modular OS/KNOWLEDGE SOURCES/00_GOVERNANCE/**
!Modular OS/KNOWLEDGE SOURCES/00_GOVERNANCE/CP-COMMON_PREAMBLE.md
```

Important consequences:

- Every re-included parent is immediately re-excluded with `parent/**` before
  exact descendants are opened. Without that second line, a real BuildKit
  transfer can reopen the entire parent despite the leading `**` deny. The
  2026-07-20 negative control transferred 4.86 GB before this correction and
  3.88 MB from a fresh builder after it.

- `frontend/src/**` is required for `next build`; none of it reaches the final runtime except `out/` and the one RV JSON file explicitly copied.
- Root `**` denies `.git`, `.github`, `.env*`, keys, certificates, `node_modules`, `.next*`, `out`, coverage, tests, `.venv*`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `server/data`, checked-in `server/static`, local databases, docs, and agent/tooling folders without depending on a fragile list of secret filename patterns.
- The two full specialized prompt directories are required because `prompt_bundles.py` rejects extra/missing manifest members and hashes every listed file.

After implementation, verify the context and final app image rather than trusting the patterns:

```bash
docker buildx build --progress=plain --load \
  -f caos/deploy/Dockerfile -t caos-app:hardening-check .
docker history --no-trunc caos-app:hardening-check
docker run --rm --entrypoint sh caos-app:hardening-check -ceu '
  ! find /app /frontend "/Modular OS" -xdev -type f \( -name ".env" -o -name ".env.*" -o -name "*.pem" -o -name "*.key" \) -print | grep .
  ! find /app -maxdepth 3 \( -name tests -o -name node_modules -o -name ".venv*" -o -name __pycache__ \) -print | grep .
'
```

This scan is intentionally limited to application-controlled paths, so base-image CA bundles such as Certifi's `cacert.pem` do not create false failures.

## 11. Compose, CI, and rollout integration

### 11.1 Compose validation

After applying all per-service blocks:

```bash
docker compose -f caos/deploy/docker-compose.yml config --quiet
docker compose -f caos/deploy/docker-compose.yml config > /tmp/caos-compose.rendered.yml

# All six services must show the four controls. Inspect the rendered file in the PR.
for svc in app db caddy oauth2-proxy backup clamav; do
  SVC="$svc" yq -e '.services[strenv(SVC)].read_only == true' /tmp/caos-compose.rendered.yml
  SVC="$svc" yq -e '.services[strenv(SVC)].security_opt == ["no-new-privileges:true"]' /tmp/caos-compose.rendered.yml
  SVC="$svc" yq -e '.services[strenv(SVC)].cap_drop == ["ALL"]' /tmp/caos-compose.rendered.yml
  SVC="$svc" yq -e '.services[strenv(SVC)].user != null and .services[strenv(SVC)].user != ""' /tmp/caos-compose.rendered.yml
done
```

Render with a real deployment `.env` kept outside source control; never commit the rendered file because interpolation can contain secrets.

### 11.2 CI change

The current image job builds with context `caos` and Dockerfile `caos/deploy/Dockerfile`. Change it to:

```yaml
with:
  context: .
  file: caos/deploy/Dockerfile
  push: false
```

Add a matrix build for the five additional Dockerfiles. CI should build, scan, and inspect image metadata without pushing from pull requests:

```yaml
strategy:
  matrix:
    include:
      - { name: app, file: caos/deploy/Dockerfile }
      - { name: db, file: caos/deploy/Dockerfile.db }
      - { name: caddy, file: caos/deploy/Dockerfile.caddy }
      - { name: oauth2-proxy, file: caos/deploy/Dockerfile.oauth2-proxy }
      - { name: backup, file: caos/deploy/Dockerfile.backup }
      - { name: clamav, file: caos/deploy/Dockerfile.clamav }
```

Keep Dependabot's Docker coverage on `/caos/deploy`; verify it discovers all `Dockerfile*` pins.

### 11.3 Rollout order

1. Re-resolve all digests and review upstream deltas.
2. Add the root `.dockerignore`; update app/CI context to the repository root.
3. Build all six images and run static vulnerability/SBOM scans. Do not deploy yet.
4. Back up and verify `db-data`, `vault-data`, `caddy-data`, `caddy-config`, `backups`, and `clamav-data`.
5. Resolve and repair named-volume ownership while the old shell-bearing images are still available.
6. Deploy `db` alone; verify Postgres and pgvector.
7. Deploy `app`; verify migrations, health, static UI, RV snapshot, prompt corpus, native extraction, and OCR.
8. Deploy `oauth2-proxy`; verify health bypass and protected-route authentication.
9. Deploy Caddy on 8080/8443 internally mapped to host 80/443; verify ACME storage and renewal.
10. Deploy `backup`; wait for a real cycle and pass the restore drill.
11. Deploy the optional `clamav` profile; update signatures and test clean/malicious/fail-closed upload paths.
12. Run §3 for every service, save command output as deployment evidence, and observe logs/restarts for at least one normal operating interval.

Rollback means restoring the prior image references and Compose definition, not weakening the new containers to root. Volume-format or ownership changes must have a separately tested rollback path.

## 12. Whole-stack completion gate

Run after the individual sections pass:

```bash
COMPOSE='docker compose -f caos/deploy/docker-compose.yml'
services='app db caddy oauth2-proxy backup clamav'

for svc in $services; do
  cid=$($COMPOSE ps -q "$svc")
  test -n "$cid" || { echo "MISSING $svc" >&2; exit 1; }
  test "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$cid")" = true
  user=$(docker inspect -f '{{.Config.User}}' "$cid")
  case "$user" in
    ''|root|0|0:*|root:*) echo "root-capable Config.User for $svc: $user" >&2; exit 1 ;;
  esac
  docker inspect "$cid" | jq -e '
    .[0].HostConfig.CapDrop == ["ALL"] and
    ((.[0].HostConfig.CapAdd // []) | length == 0) and
    (.[0].HostConfig.SecurityOpt | index("no-new-privileges:true") != null)'
  ! docker top "$cid" -eo uid,pid,args | awk 'NR > 1 && $1 == 0 { found=1 } END { exit !found }'
done

$COMPOSE ps
curl -fsS "https://${CAOS_DOMAIN}/api/health"
```

If the `av` profile is intentionally disabled, omit `clamav` from this one loop but retain its image build and image-level verification in CI. Do not call the optional image verified merely because it is not running.

Completion requires all of the following evidence:

- six digest-pinned image builds with reviewed base provenance;
- explicit non-root image/Compose users;
- no UID 0 process in any running service;
- read-only root filesystems on all six;
- `CapDrop=[ALL]`, empty `CapAdd`, `NoNewPrivs=1`, `CapEff=0`, and `CapBnd=0` on all six;
- only the documented volumes/tmpfs mounts writable;
- no compiler, linker, development headers, language dependency installer (`pip`/`npm`), secret, test tree, build cache, virtualenv, or frontend dev source in a final image;
- successful service-specific functional probes and the backup restore drill.

## 13. Independent audit record

Each service section must receive a fresh-context audit after drafting. The implementer should preserve this table and update it if the design changes after this blueprint date.

| Section | Fresh-context audit | Result | Findings folded into this revision |
|---|---|---|---|
| `app` | `/root/audit_app`, fresh context | Zero-root design confirmed; post-implementation runtime unverified | Restored the full required Compose environment/dependency, replaced redirect-prone health probing, added executable RV/prompt/PDF checks, exact mount assertions, and a deterministic application-path secret scan. |
| `db` | `/root/audit_db`, fresh context | Zero-root design confirmed conditional on recursive volume ownership; production runtime unverified | Added recursive ownership rejection, separated available-extension proof from post-Alembic installation proof, asserted 0.8.5, included `/dev/shm`, and made artifact checks executable. |
| `caddy` | `/root/audit_caddy`, fresh context | Zero-root design confirmed conditional on volume provisioning; production runtime unverified | Seeded non-root volume directories, added exact backup/chown/probe steps, removed the file capability, corrected GET health proof, added shell/static-binary checks and an isolated certificate-write test. |
| `oauth2-proxy` | `/root/audit_oauth`, fresh context | Initial design blocked; blocker corrected; post-fix runtime unverified | Restored all OAuth environment inputs, added a static-binary check, exact read-only mount/running-state assertions, strict redirect/cookie checks, and an authenticated identity probe. |
| `backup` | `/root/audit_backup`, fresh context | Zero-root design confirmed conditional on volume migration; off-host recovery unverified | Removed the arbitrary writable-backup sync hook, made partial cycles and cleanup fail, added exact volume migration, recursive vault readability, mount assertions, and retained the remote-only restore caveat. |
| `clamav` | `/root/audit_clamav`, fresh context | Conditional target only; zero-root/runtime freshness remains unverified until all §9.3 gates pass | Added `/run` state, exact volume migration, UID/GID and mount checks, package-manager removal, updater freshness, clean/EICAR/fail-closed tests, and a current-concurrency sizing gate. |

All six sections received the requested fresh-context review. “Confirmed” in this table means the steady-state control design was independently checked; it does **not** mean the future images are implemented or that the post-implementation commands have passed. ClamAV remains the least-certain section because CAOS deliberately retains the coupled vendor runtime rather than reconstructing it file-by-file.

## 14. Primary upstream references

- Docker build contexts and `.dockerignore`: <https://docs.docker.com/build/concepts/context/>
- Compose `read_only`, `cap_drop`, `security_opt`, `tmpfs`, and `user`: <https://docs.docker.com/reference/compose-file/services/>
- Official Postgres image entrypoint: <https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh>
- pgvector Docker image source: <https://github.com/pgvector/pgvector/blob/master/Dockerfile>
- Distroless image model and nonroot tags: <https://github.com/GoogleContainerTools/distroless>
- OAuth2 Proxy images: <https://github.com/oauth2-proxy/oauth2-proxy>
- Official Caddy image source: <https://github.com/caddyserver/caddy-docker>
- ClamAV Docker documentation, including `/init-unprivileged`: <https://docs.clamav.net/manual/Installing/Docker.html>
