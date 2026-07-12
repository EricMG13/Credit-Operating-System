# CAOS Container-Hardening Blueprint

**Author**: Fable 5 planning session, 2026-07-08. **Implementer**: a later Opus 4.8 session.
**Status of this document**: design only. No Dockerfile/compose/.dockerignore file in the repo has been modified to produce this blueprint — every snippet below is prescriptive, to be applied by the implementation session.

## 0. How to read this document

- Every digest below was resolved live against the registry on **2026-07-08 19:30 UTC** (§2.1 gives the exact method and commands — re-run them before implementing if time has passed, do not reuse these values blindly). No digest here was invented.
- Claims are tagged `[CERTAIN — source]` (verified against primary source: repo file, upstream Dockerfile/entrypoint on GitHub, or a live registry query — this session had no working local Docker daemon, see §0.1) or `[VERIFY AT IMPLEMENTATION — exact command]` (requires a live container to confirm; the command is given, run it and treat a mismatch as a stop-and-fix, not a doc error).
- §1 lists four **prerequisites** — issues discovered while researching this blueprint that block or undermine the hardening work if left alone. Fix these first; they are not optional extras.
- Each image section (§3–§8) is self-contained: Dockerfile/derived-Dockerfile syntax, compose directives, digest, migration steps for existing volumes, and a verification block. An implementer should be able to work through one section at a time without reading the others.

### 0.1 Local environment note

This session's Docker CLI could not reach a daemon (`unable to resolve docker endpoint: context "colima": context not found`). All digest and image-metadata claims below were instead resolved via (a) direct registry HTTP calls (Docker Hub / quay.io anonymous token flow) and (b) reading the actual upstream Dockerfile/entrypoint source for each base image via the GitHub API (`docker-library/postgres`, `docker-library/python`, `caddyserver/caddy-docker`, `oauth2-proxy/oauth2-proxy`, `Cisco-Talos/clamav-docker`, `GoogleContainerTools/distroless`). Where the implementer has a working Docker CLI, prefer `docker buildx imagetools inspect` / `docker run --rm <img> id <user>` to re-confirm — commands are given per-section. This blueprint does not guess; every uid/gid/entrypoint-behavior claim below traces to one of these two sources.

## 1. Prerequisites — fix before or alongside hardening

### 1.1 CRITICAL — `db` volume is mounted at the wrong path for Postgres 18 (data-loss / boot-crash risk, independent of hardening)

**This is not a hardening finding — it is a live correctness bug in the current `caos/deploy/docker-compose.yml`.** Flagging it here because §4 (db hardening) is meaningless to apply on top of a broken volume mount.

`pgvector/pgvector:pg18` is `FROM postgres:18-bookworm` with no PGDATA/VOLUME override [CERTAIN — `github.com/pgvector/pgvector` root `Dockerfile`: `ARG PG_MAJOR=17` then `FROM postgres:$PG_MAJOR-$DEBIAN_CODENAME`; pgvector:pg18 build resolves `PG_MAJOR=18`]. Postgres's own image made a breaking change starting at major version 18:

```
ENV PGDATA /var/lib/postgresql/18/docker
VOLUME /var/lib/postgresql
```
[CERTAIN — `docker-library/postgres` `18/bookworm/Dockerfile`, confirmed identically in `18/alpine3.23/Dockerfile`]. Prior to PG18, `PGDATA` was `/var/lib/postgresql/data` and that path was the `VOLUME`. `caos/deploy/docker-compose.yml:31` still mounts the **old** path:
```yaml
volumes:
  - db-data:/var/lib/postgresql/data
```
This is not merely stale — the PG18 entrypoint actively detects and rejects it. Its directory-setup logic (`docker-entrypoint.sh`, function `docker_setup_db`) does, in order:
1. Check `$PGDATA/PG_VERSION` (i.e. `/var/lib/postgresql/18/docker/PG_VERSION`) — absent on a fresh volume.
2. Since `PGDATA` equals the documented PG18 default, scan `/var/lib/postgresql`, `/var/lib/postgresql/data`, `/var/lib/postgresql/*/docker` for a `PG_VERSION` file from an old-format install.
3. If none of those exist **but** `/var/lib/postgresql/data` is itself a mountpoint (true here — `db-data` is mounted there), it is flagged as `OLD_DATABASES+=('/var/lib/postgresql/data (unused mount/volume)')`.
4. `docker_error_old_databases()` then runs: if `OLD_DATABASES` is non-empty, it prints an explanatory error (referencing `docker-library/postgres` PR #1259) and **`exit 1`** [CERTAIN — same file, lines ~139–166; the `exit 1` is unconditional once the array is non-empty].

Net effect: on any fresh initialization of the `db` service under the current compose file (first deploy, or any redeploy where the `db-data` volume is empty/new), **the container will not start** — it crash-loops with that error. If the currently-live deployment predates the switch to `pgvector/pgvector:pg18` and has never been recreated since, it may still be running on borrowed time against an old container instance; the first `docker compose up -d --build` that recreates `db` will hit this.

Even setting the crash aside: because the compose mount only covers `/var/lib/postgresql/data` and not `/var/lib/postgresql`, the actual `PGDATA` (`/var/lib/postgresql/18/docker`) sits **outside any named volume**, in the container's writable layer — so even in a hypothetical world where the entrypoint didn't refuse to start, data would not survive `docker compose down` / container recreation.

**Fix** (apply before or together with the hardening rollout in §9): change the mount to match the image's declared `VOLUME`:
```yaml
volumes:
  - db-data:/var/lib/postgresql
```
The image pre-creates that exact path owned `postgres:postgres`, mode `1777` [CERTAIN — `18/bookworm/Dockerfile`: `install --verbose --directory --owner postgres --group postgres --mode 1777 /var/lib/postgresql`] — a fresh named volume mounted there inherits that ownership on first use, which is also a precondition for §4's `user: "999:999"`.

**Diagnostic before touching anything** — run this against the live stack first to know which scenario applies:
```bash
docker compose -f caos/deploy/docker-compose.yml exec db sh -c \
  'echo "PGDATA=$PGDATA"; ls -la /var/lib/postgresql/data 2>&1; ls -la /var/lib/postgresql/*/docker 2>&1'
```
- If `/var/lib/postgresql/data` has a real cluster (`PG_VERSION`, `base/`, etc.) and `PGDATA` points elsewhere with nothing in it: the running container is mid-migration-limbo — the live data is real but on the wrong side of the mount. Do **not** just flip the compose line and restart; that abandons the live data. Stop the one service (`docker compose -f caos/deploy/docker-compose.yml stop db` — no need to stop the whole stack), then migrate with a **single** volume mount and an explicit `mv` (not `cp -a` into a second mount of the *same* volume — mounting one volume twice into one container under two different paths doesn't create two independent trees, it's the same directory reachable two ways, so a recursive copy from one alias into a path nested under the other alias copies a tree into itself; `cp`'s cycle-guard usually saves the real data but can leave a stray self-referential artifact directory and, on some `cp` implementations, an ambiguous non-zero exit):
  ```bash
  docker run --rm -v caos_db-data:/vol --user 0:0 busybox sh -c '
    mkdir /vol/_migrate18 &&
    mv /vol/PG_VERSION /vol/base /vol/global /vol/pg_wal /vol/pg_xact /vol/pg_hba.conf /vol/pg_ident.conf /vol/postgresql.conf /vol/_migrate18/ 2>/dev/null;
    ls /vol/_migrate18 &&
    mkdir -p /vol/18 && mv /vol/_migrate18 /vol/18/docker'
  ```
  (adjust the volume name to what `docker compose config` / `docker volume ls` actually shows; the explicit filename list avoids sweeping up the newly-created `18/` directory the way a wildcard `mv /vol/* /vol/_migrate18/` would). Verify `PG_VERSION` lands at `/var/lib/postgresql/18/docker/PG_VERSION` post-move, confirm ownership is still `999:999` (a root-run `busybox` may leave things root-owned — `docker run --rm -v caos_db-data:/vol busybox chown -R 999:999 /vol` if so), then apply the mount fix and restart.
- If empty/absent everywhere: no live data at risk — apply the one-line fix directly.

### 1.2 Prod-crashing latent bug — `tiktoken` is imported but not installed

Not introduced by this blueprint, but §3's tiktoken pre-bake (needed for a fully offline, read-only-safe runtime) is meaningless without this fix, so it's a prerequisite here.

`caos/server/requirements.lock` has no `tiktoken` entry (grep-confirmed: zero matches in both `requirements.txt` and `requirements.lock`). Two call sites depend on it unconditionally:
- `caos/server/ingest.py:226` — `import tiktoken` sits **outside** the `try/except` that guards `get_encoding()`; `chunk_text()` raises `ModuleNotFoundError` in the current production image.
- `caos/server/engine/packer.py:4` — module-level `import tiktoken`; any code path that imports `packer` (reached via `engine/queryanswer.py`) fails the same way.

**Fix**: append to `caos/server/requirements.txt`:
```
tiktoken>=0.9,<1
```
[VERIFY AT IMPLEMENTATION — check the current tiktoken release before pinning the floor: `curl -s https://pypi.org/pypi/tiktoken/json | python3 -c "import json,sys;print(json.load(sys.stdin)['info']['version'])"`]. Regenerate the lock exactly as the existing Dockerfile comment prescribes:
```bash
pip-compile --generate-hashes --strip-extras --output-file=server/requirements.lock \
  <(cat server/requirements.txt; echo 'markitdown[pdf]==0.1.6')
```
This is the one dependency-manifest change in this blueprint; everything else is Dockerfile/compose/.dockerignore only.

### 1.3 Secrets and a dev virtualenv are currently baked into the production image

`caos/.dockerignore` excludes `.env` and `.env.*` only at the context root, and `**/.venv` only (not `**/.venv311`). Two real artifacts in the tree are missed and get `COPY server/ ./`'d straight into the image today:
- `server/.env` — 972 bytes, real local secret values (not a template).
- `server/.venv311` — a full Python 3.11 virtualenv (site-packages).

Blast radius today is limited (CI builds with `push: false`, §7 confirms no registry push exists anywhere in the pipeline), but any local image that was ever built, tagged, and pushed or exported would carry `server/.env`'s contents in a layer. §10's replacement `.dockerignore` closes both gaps with depth-anchored patterns (`**/.env`, `**/.env.*`, `**/.venv*`). **Rotate any secret in `server/.env` if that image has ever left this host** (registry push, `docker save`, CI artifact upload) — this session found no evidence it has (CI's `image` job is build-only), but the implementer should confirm before treating it as low-risk.

### 1.4 CRITICAL — the Modular OS prompt corpus is outside the build context; live LLM synthesis is broken in every deployed container today

**Not a hardening finding, not introduced by this blueprint — a pre-existing production defect surfaced incidentally while auditing §10's `.dockerignore` claims.** Flagging it here at the same severity as §1.1 because, like the db mount-path bug, it means a core product feature does not work in the container as currently built, independent of anything in this document.

`caos/server/engine/synth.py:56`:
```python
MODULAR_OS_DIR = SERVER_DIR.parent.parent / "Modular OS"
```
`SERVER_DIR` (`caos/server/config.py:22`) is `Path(__file__).resolve().parent` — inside the container, `config.py` lands at `/app/config.py` (`WORKDIR /app` + `COPY server/ ./`), so `SERVER_DIR` = `/app` and `MODULAR_OS_DIR` resolves to `/Modular OS` [CERTAIN — path arithmetic confirmed directly: `/app`'s parent is `/`, and `/`'s own parent is itself, so `SERVER_DIR.parent.parent` = `/`]. `synth.py:377` (`LiveSynthesizer._active_prompt()`):
```python
path = MODULAR_OS_DIR / module_id / f"{module_id}_ACTIVE_PROMPT.md"
```
**hard-raises `SynthesisError` if that file is missing — no fallback.** This is the live path (used whenever `ANTHROPIC_API_KEY` is configured, i.e. in any real deployment), not the fixture/mock path.

Locally, `Modular OS/` is a real 24-directory corpus at the **repo root**, sibling to `caos/` — confirmed present (`Modular OS/CP-0/`, `CP-1/`, ... `CP-6E/`, each containing a `*_ACTIVE_PROMPT.md`). It has never been part of the Docker build context: the compose file's `build.context: ..` for the `app` service resolves to `caos/`, not the repo root, and neither the current nor this blueprint's Dockerfile has ever had a `COPY` step reaching outside `caos/`. **No `.dockerignore` pattern can fix this** — `.dockerignore` only filters files that are already inside a build context; `Modular OS/` was never inside the `caos/` context to begin with, so this is a build-context-scope problem, not a filtering problem. [CERTAIN — confirmed no bind mount, no COPY step, and no other mechanism supplies this directory to the container in the current `caos/deploy/docker-compose.yml` or `caos/deploy/Dockerfile`]

**Net effect**: `LiveSynthesizer.synthesize()` raises for every one of the 24 CP modules in any container built from either the current Dockerfile or this blueprint's — the entire "27-module Modular OS" LLM-synthesis feature (the core analytical methodology this whole platform is built around, per [CLAUDE.md](../../CLAUDE.md)) is non-functional in a deployed container today, whenever a real API key is configured. This is not hypothetical or edge-case — it's the default live code path.

**Fix — bind-mount the corpus into the `app` service, read-only** (the same pattern already used for `Caddyfile`/`clamd.conf`/`oauth2-proxy.cfg` — config/content that should be editable without a rebuild, not baked into an image layer):
```yaml
  app:
    volumes:
      - vault-data:/vault
      - app-scratch:/scratch
      - "../../Modular OS:/Modular OS:ro"   # NEW — see §1.4; path relative to caos/deploy/, matches MODULAR_OS_DIR
```
This is compatible with `read_only: true` (§3.3) without any further change — it's a separately-mounted read-only bind mount, not a rootfs write, exactly like the existing `./Caddyfile:...:ro` pattern on `caddy`. Quote the path (the directory name contains a literal space) — YAML's colon-delimited short volume syntax needs the whole `host:container:mode` triplet as one string when either side has a space.

**Permission dependency this fix does not itself guarantee — check before relying on it.** Unlike the named volumes elsewhere in this blueprint (`app-scratch`, `caddy-data`, etc.), a bind mount performs **no ownership remap**: Docker never chowns a bind-mounted host directory to match the container's user, and this stack sets no `userns_mode`. Access is governed purely by the host directory's raw permission bits against uid 10001 (`caos`), which has no matching owner or group on the host — in practice, only the Unix **"other"** permission class can ever grant read access here. [VERIFY AT IMPLEMENTATION — confirmed working on a normal git checkout with a default umask (`Modular OS/` and its files are world-readable, `755`/`644`, on this session's checkout), but that is an accident of umask, not something this fix guarantees. A host with a hardened default umask (e.g. `027`/`077` — common on CIS-hardened servers) would checkout the corpus without world-read/execute bits, and uid 10001 would get `EACCES` on every prompt file — the exact `SynthesisError` failure this section exists to fix, just relocated from "path missing" to "permission denied," and just as silent until the first real synthesis call. Check before deploying: `find "Modular OS" -type f ! -perm -044 -o -type d ! -perm -055` (repo root) should print nothing; if it prints anything, run `chmod -R o+rX "Modular OS"` (read+execute for "other" on every dir, read for "other" on every file) before starting the stack.]

**Alternative not recommended here**: widen the Docker build `context` to the repo root and `COPY` the corpus into the image at `/Modular OS`. This bakes the prompt corpus into the image (a prompt edit then requires a full image rebuild + redeploy rather than just touching a file on the host), widens the build context beyond what `caos/.dockerignore` (§10) is scoped to protect, and would sidestep the permission caveat above entirely (`COPY` sets ownership explicitly, no host-permission dependency) — worth reconsidering if the permission check above ever becomes operationally annoying, but the bind-mount stays the default recommendation since it keeps prompt iteration decoupled from image builds.

**This is a real gap in the deployed product, not just this blueprint's paperwork** — recommend confirming whether the currently-live deployment (if any) has ever actually exercised `LiveSynthesizer` successfully, or whether this has been silently broken since the container was first built. §3.4 includes a dedicated functional check for this fix — run it, don't assume the bind mount alone is sufficient proof.

## 2. Global conventions

### 2.1 Digest-pinning workflow

**Preferred (when Docker CLI has a working daemon):**
```bash
docker buildx imagetools inspect <repo>:<tag> --format '{{.Manifest.Digest}}'
```
This resolves and prints the **multi-arch index digest** — the value to pin. Always pin the index digest, not a per-arch manifest digest, so the reference still resolves correctly on any architecture Compose might build/pull on.

**Fallback (no daemon, as in this session) — anonymous registry HTTP query:**

Docker Hub (`docker.io`) — two-step: anonymous bearer token, then a manifest HEAD asking for index media types first:
```bash
repo=library/python   # or pgvector/pgvector, clamav/clamav, etc. — "library/" prefix only for official images
tag=3.14-slim
token=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
curl -sI \
  -H "Authorization: Bearer ${token}" \
  -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json" \
  "https://registry-1.docker.io/v2/${repo}/manifests/${tag}" | grep -i docker-content-digest
```
quay.io — same shape, its own token endpoint:
```bash
qtoken=$(curl -s "https://quay.io/v2/auth?service=quay.io&scope=repository:oauth2-proxy/oauth2-proxy:pull" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
curl -sI \
  -H "Authorization: Bearer ${qtoken}" \
  -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json" \
  "https://quay.io/v2/oauth2-proxy/oauth2-proxy/manifests/v7.15.3" | grep -i docker-content-digest
```
The `Docker-Content-Digest` response header is the value to pin — every lookup this session ran (and an independent re-run against all seven images, plus adversarial control requests, in a later gap-check pass) returned `content-type: application/vnd.oci.image.index.v1+json`, confirming the index digest is what's captured. [CORRECTION — the claim that ordering index media types first in `Accept` is *what causes* this was tested directly and found not to hold on current (2026) Docker Hub: identical requests with only a single-platform `Accept` type, and with no `Accept` override at all, returned the same index digest and content-type. Hub appears to serve the index unconditionally for these tags regardless of the header sent. The commands as written still produce the correct digest either way — nothing to fix operationally — but don't rely on the header-ordering explanation if adapting this method for a registry where it might matter; verify the returned `content-type` directly instead of trusting the mechanism.]

**Compose/Dockerfile reference format** — keep the human tag alongside the digest; the engine ignores the tag once a digest is present, but Dependabot's `docker`/`docker-compose` ecosystems (both already configured for `/caos/deploy` in `.github/dependabot.yml`) need the tag to detect and open version-bump PRs:
```
image: name:tag@sha256:<64-hex>
```
Dependabot updates `tag@digest` pairs as a unit (bumps both together on a new release, or refreshes just the digest if the tag was re-pushed). This applies equally to the two new derived Dockerfiles introduced below (§5, §6) — any file matching `Dockerfile*` under `/caos/deploy` is already covered by the existing `docker` ecosystem entry; no dependabot.yml change needed.

### 2.2 Resolved digests (as of 2026-07-08 19:30 UTC — re-resolve with §2.1 before using if stale)

| Image | Tag pinned | Resolved index digest | Note |
|---|---|---|---|
| `node` | `26-slim` | `sha256:5e5c559c8683f408b2e3d7d8a0b8ba0b1254ed80b929f629033cfde5bc1a5610` | **Differs from the Dockerfile's current pin** (`a1d9d671994fc2d26e297ac56b4b1522a8bc7fa71c43b14cd1b1fe6c5116f7dc`) — the `26-slim` tag has moved since that pin was set. Re-pin to the value above. |
| `python` | `3.14-slim` | `sha256:b877e50bd90de10af8d82c57a022fc2e0dc731c5320d762a27986facfc3355c1` | Matches the Dockerfile's current pin exactly — still current, no change needed. |
| `pgvector/pgvector` | `pg18` | `sha256:212765b63c1462883de295c4c415edcd22191b8d8d46853e86ad05d4b577a4cb` | Not previously pinned. |
| `postgres` | `18-alpine` | `sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15` | Not previously pinned. Used by `backup`. |
| `caddy` | `2.11.4-alpine` | `sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648` | Was floating `2-alpine`; resolves to the identical digest as the pinned patch tag today — pin the explicit patch tag `2.11.4-alpine` so it stops floating. |
| `clamav/clamav` | `1.5` | `sha256:6f4a9e7d616ffc8d1070200fe35ac860735fdd522161a1043f94856e6ee13c28` | Not previously pinned. |
| `quay.io/oauth2-proxy/oauth2-proxy` | `v7.15.3` | `sha256:10a1165743a192e1940b4708fb9647027185ce11a681a1c5519b442ff7f1f561` | Not previously pinned. |

### 2.3 Compose hardening directive glossary (applied per-service below)

| Directive | Effect | Applied to |
|---|---|---|
| `security_opt: ["no-new-privileges:true"]` | Blocks setuid/setgid/file-capability privilege escalation at exec time | all 6 services |
| `cap_drop: ["ALL"]` | Removes every Linux capability from the container | all 6 services |
| `cap_add: [...]` | Re-adds only what's strictly needed | none — every service in this blueprint reaches zero-root without re-adding a capability, including `caddy` (see §5) |
| `read_only: true` | Root filesystem mounted read-only; only explicit volumes/tmpfs are writable | app, db, caddy, oauth2-proxy, backup, clamav — all 6 |
| `user: "<uid>:<gid>"` or `user: "<name>"` | Overrides the image's default user, independent of and in addition to any Dockerfile `USER` | db, caddy, backup, clamav, oauth2-proxy (app already sets this via Dockerfile `USER`) |
| `tmpfs: ["/path:size=Xm,mode=YYYY"]` | In-memory writable mount, sized explicitly so it can't silently consume the whole `mem_limit` | sized per-service below; never left unsized |
| `pids_limit` | Caps forked/spawned process count | see §11 appendix |

### 2.4 Verification harness pattern (applied per-service in §3–§8)

Two variants depending on whether the running container has a shell to `exec` into:

**Shell-ful images** (app, db, caddy, backup, clamav — all have `sh`):
```bash
svc=<service>
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}} add={{.HostConfig.CapAdd}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q "$svc")"
docker compose -f caos/deploy/docker-compose.yml exec "$svc" id -u
docker compose -f caos/deploy/docker-compose.yml exec "$svc" sh -c 'touch /probe-write-test 2>&1 || true'   # expect "Read-only file system"
docker compose -f caos/deploy/docker-compose.yml exec "$svc" sh -c 'grep -E "CapEff|NoNewPrivs" /proc/1/status'  # expect CapEff 0000000000000000, NoNewPrivs 1
```

**Shell-less images** (oauth2-proxy — distroless, no `sh`, no `docker exec` possible): inspect-only, the kernel still enforces everything, we just can't probe interactively.
```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}} add={{.HostConfig.CapAdd}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q oauth2-proxy)"
docker top "$(docker compose -f caos/deploy/docker-compose.yml ps -q oauth2-proxy)"   # UID column must show the non-root uid, never root/0
```
`cap_drop: ["ALL"]` combined with no `cap_add` empties the container's *bounding* capability set — the `F(permitted) & P(bounding)` term in the kernel's exec-time capability formula (`capabilities(7)`) — which is the actual mechanism that zeroes `CapEff` regardless of any file capability a binary carries (e.g. caddy's own baked-in `setcap cap_net_bind_service=+ep`, §5.1). [CORRECTION — the doc's earlier framing ("nothing to drop *to* a non-root process that wasn't already capability-less") was imprecise: a non-root process is not inherently capability-less — one that execs a setcap binary *without* `cap_drop: ["ALL"]` in effect can absolutely gain non-zero capabilities, which is exactly what caddy's own baked-in setcap bit would otherwise do. The bounding-set intersection, not non-root-ness itself, is what closes it here.] This guarantee also assumes a non-buggy container runtime: a real, patched vulnerability (**CVE-2022-29162**, runc, fixed in 1.1.2) could under some conditions launch a process with a non-empty *inheritable* capability set, which combined with a binary's file-inheritable bits can populate permitted/effective independent of the bounding-set restriction — closed on any current Docker Engine/runc, but the grep-for-zero check below is the actual verification, not an assumption to skip. `no-new-privileges` (also set on every service) is the complementary control for the adjacent setuid-root-binary vector, which capability-dropping alone does not address.

## 3. `app` (built image — FastAPI + baked static frontend)

### 3.0 Topology note (frontend has no runtime image)

There is no separate frontend container. `caos/frontend/next.config.js` sets `output: "export"` — a static build (`next build` → `out/`), not a Node server. The existing Dockerfile's stage 1 builds that static export and stage 2 (`COPY --from=frontend /frontend/out ./static`) bakes it into the FastAPI image, served via `StaticFiles` at `/` (`caos/server/main.py:322-324`). One image serves both `/api/*` and the UI. This blueprint's "app" section covers that one image; there is no separate "frontend" section.

### 3.1 Current gaps

The image is already multi-stage, already digest-pinned (both bases), and already runs as non-root `USER caos` (uid 10001) with `read_only: true` + `cap_drop: ["ALL"]` already set at the compose level. Remaining gaps: (a) `pip` itself and its build-time footprint still live in the shipped runtime stage; (b) the `/tmp` tmpfs has no size cap while the OCR lane can write ~1 GB of scratch, and that tmpfs currently counts against `mem_limit: 2g`; (c) `tiktoken` isn't installed at all (§1.2) so there's nothing to pre-bake yet; (d) `chown -R caos:caos /app` makes the app source directory writable-by-owner when it never needs to be.

### 3.2 Dockerfile — add a `pydeps` builder stage, strip pip from runtime

Full replacement for `caos/deploy/Dockerfile` (3 stages: `frontend` unchanged, new `pydeps`, `runtime` restructured):

```dockerfile
# syntax=docker/dockerfile:1
#
# CAOS single-process image: builds the Next.js static export, installs Python
# deps in an isolated builder stage, then assembles a pip-free runtime that
# serves /api + the UI at /.
# Build context is the caos/ dir (see deploy/docker-compose.yml).

# ─── Stage 1: build the Next.js static export (output: "export" → ./out) ─────
# Re-resolve per §2.1 before bumping; pinned value confirmed current as of
# 2026-07-08 (§2.2) — was previously stale, re-pin below.
FROM node:26-slim@sha256:5e5c559c8683f408b2e3d7d8a0b8ba0b1254ed80b929f629033cfde5bc1a5610 AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python dependency builder (pip + its caches never reach runtime) ─
FROM python:3.14-slim@sha256:b877e50bd90de10af8d82c57a022fc2e0dc731c5320d762a27986facfc3355c1 AS pydeps
WORKDIR /build
COPY server/requirements.lock ./
RUN pip install --no-cache-dir --require-hashes --prefix=/install -r requirements.lock

# Pre-bake tiktoken's cl100k_base vocab so the runtime never needs egress for
# it (requires tiktoken added to requirements.lock — see blueprint §1.2).
ENV TIKTOKEN_CACHE_DIR=/opt/tiktoken-cache
RUN PYTHONPATH=/install/lib/python3.14/site-packages python -c \
    "import tiktoken; tiktoken.get_encoding('cl100k_base')" \
    && ls -A /opt/tiktoken-cache | grep -q .

# ─── Stage 3: runtime (FastAPI + static UI, no pip, no build tools) ──────────
FROM python:3.14-slim@sha256:b877e50bd90de10af8d82c57a022fc2e0dc731c5320d762a27986facfc3355c1 AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=production \
    TMPDIR=/scratch \
    TIKTOKEN_CACHE_DIR=/opt/tiktoken-cache
WORKDIR /app

# Scanned/image PDFs carry no text layer — pypdf yields 0 chunks. ocrmypdf (wraps
# Tesseract + Ghostscript) is the last-resort OCR lane, shelled out via
# CAOS_OCRMYPDF_CMD only when markitdown and pypdf both come back empty. Own layer,
# before the deps copy, so it caches independently of the app deps.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ocrmypdf tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Non-root user + scratch dir, before the deps/app copy so ownership is set once.
# app/ itself stays root-owned (no chown) — read_only rootfs means caos never
# needs write access to its own source; it only ever writes /vault and $TMPDIR.
RUN useradd --no-log-init -m -u 10001 caos \
    && mkdir -m 1777 /scratch \
    && mkdir -p /opt/tiktoken-cache

# Python deps from the isolated builder stage — pip/setuptools/wheel and every
# build artifact pip left behind stay in the pydeps stage and are never copied.
COPY --from=pydeps /install /usr/local
COPY --from=pydeps /opt/tiktoken-cache /opt/tiktoken-cache

# Runtime never installs packages after this point; remove the interpreter's
# bundled pip so the image ships no installer at all. `uninstall` before the
# app source COPY so a future locked setuptools dependency (none today —
# confirmed: `grep '^setuptools\|^pip\|^wheel' server/requirements.lock` is
# empty) is never accidentally deleted after being needed.
RUN python -m pip uninstall -y pip setuptools wheel || true

# App source, then the built UI from stage 1 (served by StaticFiles at /).
COPY server/ ./
COPY --from=frontend /frontend/out ./static

USER caos
EXPOSE 8000

# /api/health is the only unauthenticated route — safe for a liveness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"

# run.py binds 0.0.0.0:$PORT because HOST=0.0.0.0; init_db() runs alembic on boot.
CMD ["python", "run.py"]
```

**Layer-cache order preserved**: `pydeps` keys only on `requirements.lock` (unchanged dependency → unchanged layer, same as today). `runtime`'s apt install and `useradd`/`mkdir` steps are static (never invalidated by source edits); the deps `COPY --from=pydeps` is keyed on the same lockfile; `server/` source is copied last, so a source-only edit only busts the final two `COPY` layers, identical caching behavior to today.

**Why not distroless**: the runtime stage needs `apt-get install ocrmypdf tesseract-ocr`, shelled out to at request time (`caos/server/ingest.py` OCR lane). No distroless variant can host an apt-managed package set; rebasing the OCR toolchain onto a from-scratch/distroless image is out of scope for this hardening pass (it would mean vendoring Ghostscript+Tesseract binaries and their shared-library closure by hand). `python:3.14-slim` stays the runtime base.

**`markitdown` console-script path is preserved**: pip `--prefix=/install` writes the script to `/install/bin/markitdown` with a shebang generated from the interpreter that ran pip (`/usr/local/bin/python3.14` inside the `pydeps` stage, which is the *same path* the `runtime` stage's own interpreter lives at, since both stages are `FROM python:3.14-slim`). After `COPY --from=pydeps /install /usr/local`, the script lands at `/usr/local/bin/markitdown` — the exact path the Dockerfile has always documented and `CAOS_MARKITDOWN_CMD=markitdown` (bare name, resolved via `PATH`) already relies on. [CERTAIN — pip's script generation always shebangs to the invoking interpreter; both stages share the identical base image and path layout]

**pip-uninstall safety**: [CERTAIN — `python:3.14-slim` ships pip via `--with-ensurepip` per `docker-library/python` `3.14/slim-bookworm/Dockerfile`, confirming pip is present to begin with in both `pydeps` and `runtime` stages]. The uninstall only reaches `/usr/local` (the `python3.14` interpreter tree pip itself lives in); it does not touch Debian's separate `/usr/bin/python3`. The `|| true` guards the (extremely unlikely, given the ensurepip confirmation above) case where a future base-image change ships without pip — uninstall becomes a no-op rather than a build failure.

**Correction — the "no build tools left in the final image" framing needs a caveat**: `apt-get install ocrmypdf tesseract-ocr` transitively pulls Debian's `python3-setuptools` (hard `Depends`, not `Recommends`, so `--no-install-recommends` doesn't block it: `ocrmypdf` → `python3-pkg-resources` → `python3-setuptools`) [VERIFY AT IMPLEMENTATION — `docker run --rm <built-image> apt-cache depends ocrmypdf tesseract-ocr | grep -i pip` to confirm plain `pip` itself is not also pulled in transitively; at build-graph-reading level this session found no `python3-pip` in that chain, only `setuptools`/`pkg_resources`, but that reading wasn't cross-checked against a live `apt-cache` run]. That `setuptools` lands under `/usr/bin/python3`'s site-packages — a different tree from the `/usr/local` one the `pip uninstall` step and the §3.4 verification both scope to — so it survives untouched. It is inert dead weight (nothing in the app, `markitdown`, or the OCR tools imports it at runtime under normal operation), not a functional risk, but the accurate claim is "no *installer* (pip) ships in the image," not "no build-tooling artifacts at all." §3.4's verification command only probes `/usr/local`'s `pip`/`python`; it does not and should not be read as proving `/usr/bin/python3` is clean too.

### 3.3 Compose directives

**Two separate edits — do not apply as one contiguous paste.** The `app:` service body below is a complete, self-contained block (verified independently parseable as YAML). The new top-level `volumes:` entry immediately after it is a **second, separate edit** to the file's single existing top-level `volumes:` block (the one already at the bottom of `docker-compose.yml`, alongside `db-data`, `vault-data`, etc.) — it is not part of the `app:` service and must not be pasted directly beneath it. [CONFIRMED BY AUDIT — pasting both fragments contiguously, in place, produces a file where `yaml.safe_load` succeeds *silently* while actually collapsing `services:` down to just `db`+`app` (later services swallowed as nested keys) and losing `app-scratch` entirely (last-`volumes:`-key-wins); `docker compose config` correctly rejects the same file outright with `mapping key "volumes" already defined`. Treat that rejection as the sole authoritative check — a clean `yaml.safe_load` on the *assembled* file is not sufficient proof of correctness for this section specifically. Copy each fenced block separately — don't select across the prose paragraph between them; over-selecting produces an obviously-broken YAML parse error (caught immediately by any editor), a milder failure mode than the silent corruption above, but still avoidable by copying one fence at a time.]

`app:` service body (self-contained):
```yaml
  app:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    restart: unless-stopped
    init: true    # reaps zombie ocrmypdf/gs/tesseract children — see §11
    depends_on:
      db:
        condition: service_healthy
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]
    read_only: true
    pids_limit: 512
    environment:
      # ...unchanged from current file (ENVIRONMENT, HOST, PORT, DATABASE_URL,
      # CAOS_STORAGE_DIR, CAOS_DEMO_SEED, ANTHROPIC_*, EDGAR_USER_AGENT,
      # MAX_UPLOAD_MB, CLAMAV_HOST/PORT, CAOS_MARKITDOWN_CMD, EDGE_PROXY_SECRET,
      # SESSION_SECRET, ANALYST_SIGNUP_CODE — every existing key carries over
      # unchanged, only TMPDIR below is new)...
      TMPDIR: /scratch   # NEW — moves tempfile/OCR scratch off tmpfs onto a disk-backed volume
    volumes:
      - vault-data:/vault
      - app-scratch:/scratch     # NEW — disk-backed OCR/upload scratch
      - "../../Modular OS:/Modular OS:ro"   # NEW — see §1.4, unrelated prerequisite fix, same service
    tmpfs:
      - /tmp:size=64m,mode=1777  # NEW — was unsized; now bounded for whatever still hardcodes /tmp
    mem_limit: 2g
    networks: [internal]
    # No `ports:` — unchanged, reachable only via oauth2-proxy.
```

Top-level `volumes:` block — **merge this key into the file's existing top-level `volumes:` block**, do not create a second `volumes:` key:
```yaml
  app-scratch:   # add this one line alongside the existing db-data/vault-data/caddy-data/caddy-config/backups/clamav-data entries
```

**Why a disk-backed scratch volume instead of a bigger tmpfs**: every heavy writer honors `TMPDIR` — `ingest.py:103` `NamedTemporaryFile`, `ingest.py:133` `TemporaryDirectory` (the ocrmypdf lane: `in.pdf` + `out.pdf` + a text sidecar, ≈750 MB+ scratch for a 250 MB upload), and Starlette's own `UploadFile` spooling (today, a 250 MB upload already spools into `/tmp`, i.e. against the 2g `mem_limit`). tmpfs pages are charged to the container's cgroup memory; moving the same writes to a volume via `TMPDIR=/scratch` removes that pressure entirely — OCR is CPU-bound, so the disk-vs-tmpfs I/O difference is immaterial. A `/scratch` volume also means `mem_limit: 2g` stays accurate (no more silent tmpfs eating into it). The tiny `/tmp` tmpfs (64 MB) stays only as a safety net for any library that hardcodes `/tmp` rather than honoring `TMPDIR`.

`mkdir -m 1777 /scratch` in the Dockerfile (§3.2) means a fresh, empty `app-scratch` volume inherits `1777` ownership/mode on first mount (Docker copies the image directory's contents — here, none — plus its mode/ownership — into a brand-new named volume) [CERTAIN — documented Docker named-volume "populate on first use" behavior]. Crash leftovers in `/scratch` are bounded (only reachable via a SIGKILL mid-OCR); they're safe to clear any time the app is stopped — no cleanup automation needed for this pass.

**Two OOM contributors the scratch-volume move does *not* address** — flagged by audit, not resolved by this blueprint, because both require an application code change outside its scope:
1. `ingest.py`'s upload handling buffers the full request body into an in-process `bytearray` up to `MAX_UPLOAD_MB` (250 MB) — genuine anonymous RSS against `mem_limit: 2g`, unaffected by `TMPDIR`/volume choice since it never touches a tempfile at all for this step.
2. `ocrmypdf` is invoked with no `--jobs`/`-j` flag, so it defaults to using every CPU core the host exposes to the container — on a multi-core host, Ghostscript+Tesseract can fan out well beyond what a single-request budget anticipates, still inside the same 2g cgroup as everything else.
Neither is a read-only-rootfs or non-root concern (this blueprint's scope), but both bear directly on whether `mem_limit: 2g` actually holds under a worst-case large scanned-PDF upload. [VERIFY AT IMPLEMENTATION — load-test a ~250 MB many-page scanned PDF through the OCR lane at `mem_limit: 2g` before treating that limit as final; if it OOMs, either raise the limit or have the implementer add an explicit `--jobs` cap to the `ocrmypdf` invocation in `ingest.py`.]

**`vault_export_dir` is a real write path this design does not cover.** `caos/server/config.py:248` defaults it to `""` (disabled — the export route 503s), but when set, `vault_export.py` does `mkdir(parents=True, exist_ok=True)` + `write_text(...)` against whatever path it's pointed at (reachable via `routes/ingestion.py`'s memo-write and `routes/runs.py`'s run-export). Under `read_only: true` with no volume/tmpfs mounted at that path, every write hits `EROFS` — the feature fails closed (it already degrades gracefully per its own design), but silently and completely, with no compose-level place to point it even if an operator wanted to enable it. **This blueprint takes no position on fixing that now** (the feature is off by default and out of scope for a hardening pass) — but if `VAULT_EXPORT_DIR` is ever going to be turned on, it must be pointed at `/vault` (already writable) or given its own dedicated volume analogous to `app-scratch`, added to compose at that time.

### 3.4 Verification

```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q app)"
# expect: caos ro=true drop=[ALL]

docker compose -f caos/deploy/docker-compose.yml exec app id -u
# expect: 10001

docker compose -f caos/deploy/docker-compose.yml exec app sh -c 'touch /app/probe 2>&1'
# expect: "Read-only file system"

docker compose -f caos/deploy/docker-compose.yml exec app sh -c 'touch /scratch/probe && rm /scratch/probe && echo scratch-writable-ok'
# expect: scratch-writable-ok (proves the volume mount + mode are correct)

docker compose -f caos/deploy/docker-compose.yml exec app sh -c 'command -v pip || python -m pip --version || echo no-pip-present'
# expect: no-pip-present

docker compose -f caos/deploy/docker-compose.yml exec app python -c "import tiktoken; print(len(tiktoken.get_encoding('cl100k_base').encode('hello world')))"
# expect: a small integer, no network error, no ModuleNotFoundError

docker compose -f caos/deploy/docker-compose.yml exec app sh -c 'grep -E "CapEff|NoNewPrivs" /proc/1/status'
# expect: CapEff 0000000000000000, NoNewPrivs 1

docker compose -f caos/deploy/docker-compose.yml exec app sh -c 'test -r "/Modular OS/CP-1/CP-1_ACTIVE_PROMPT.md" && echo modular-os-readable-ok'
# expect: modular-os-readable-ok — this is the §1.4 fix's own verification; a bind mount existing is not
# proof it's readable by uid 10001 (see §1.4's permission caveat). "Permission denied" here means fix
# the host directory's permissions per §1.4 before considering this section done.
```
**Functional gate** (not just inspection): run one upload through the OCR lane end-to-end (a scanned PDF with no text layer) and confirm it completes — this exercises real scratch-volume writes and the tiktoken bake. Separately, trigger one live synthesis call for any CP module (with `ANTHROPIC_API_KEY` configured) and confirm it completes without `SynthesisError` — this is the actual end-to-end proof of §1.4's fix; the `test -r` check above only proves the file is readable, not that `LiveSynthesizer` can walk the full corpus successfully.

## 4. `db` (pgvector/pgvector:pg18)

**Apply §1.1's mount-path fix first** — the directives below assume the volume is already mounted at `/var/lib/postgresql` (not `.../data`).

### 4.1 Dockerfile

None needed — no derived image. `pgvector/pgvector:pg18` already creates `postgres:postgres` uid/gid `999:999` [CERTAIN — `docker-library/postgres` `18/bookworm/Dockerfile`: `groupadd -r postgres --gid=999; useradd -r -g postgres --uid=999 ...`; pgvector's own Dockerfile only adds the extension on top, doesn't touch users] and pre-owns `/var/lib/postgresql` at that uid/gid, mode `1777` (§1.1).

### 4.2 Compose directives

```yaml
  db:
    image: pgvector/pgvector:pg18@sha256:212765b63c1462883de295c4c415edcd22191b8d8d46853e86ad05d4b577a4cb
    restart: unless-stopped
    user: "999:999"
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
      - /var/run/postgresql:size=16m,mode=1777   # unix socket + lockfile dir (Debian default unix_socket_directories)
    shm_size: 256m   # /dev/shm stays writable under read_only; 64m default aborts parallel-query plans
    pids_limit: 256
    mem_limit: 1g
    environment:
      POSTGRES_USER: caos
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: caos
    volumes:
      - db-data:/var/lib/postgresql   # FIXED PATH — see §1.1, was /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U caos -d caos"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]
```

**Why `cap_drop: ["ALL"]` is viable**: when started with `user: "999:999"`, the entrypoint's own root-only branches (chown-on-first-boot, port-binding <1024) never execute — Postgres listens on `5432` (unprivileged) and every file it touches is already owned by the uid it's running as. No capability is needed. [CERTAIN — mechanism confirmed by reading `docker_create_db_directories()` in the entrypoint: the `chown` branch is explicitly gated on `if [ "$user" = '0' ]`, skipped entirely for a non-root start]

**Existing-volume compatibility, once §1.1's mount is corrected**: a volume freshly mounted at `/var/lib/postgresql` inherits `999:999`/`1777` from the image (§1.1). [VERIFY AT IMPLEMENTATION — if migrating a live volume rather than starting fresh, confirm ownership post-migration: `docker compose exec db stat -c '%u:%g %a' /var/lib/postgresql/18/docker` → expect `999:999 700` (the `700` comes from `docker_create_db_directories`'s own `chmod 00700 "$PGDATA"`, not from the parent's `1777`). If anything is root-owned (e.g. left behind by the §1.1 migration), one-shot fix before switching to `user: 999:999`: `docker compose run --rm --user 0:0 --cap-add=CHOWN --entrypoint sh db -c 'chown -R 999:999 /var/lib/postgresql'` — the `--cap-add=CHOWN` is required even though `--user 0:0` is uid 0: this service's `cap_drop: ["ALL"]` (§4.2) is inherited by `docker compose run` regardless of the `--user` override, and `chown(2)` needs `CAP_CHOWN` unconditionally once capabilities are stripped — root with an empty capability set cannot `chown` any more than a normal user can. This same rule applies to every `--user 0:0` migration one-liner in this document (§5.4, §7.3, §8.3) — each already includes the flag.]

### 4.3 Verification

```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q db)"
# expect: 999:999 ro=true drop=[ALL]

docker compose -f caos/deploy/docker-compose.yml exec db id -u
# expect: 999

docker compose -f caos/deploy/docker-compose.yml exec db sh -c 'touch /var/lib/postgresql/probe 2>&1'
# expect: "Read-only file system" (proves rootfs is RO even though the data dir subtree is a writable volume — this touches the volume ROOT, not PGDATA, and should still fail since only PGDATA subdirs need write, not the volume mount point's sibling files — adjust probe path to something clearly outside the intended writable tree, e.g. /probe at the rootfs root, if this specific check is ambiguous)
docker compose -f caos/deploy/docker-compose.yml exec db sh -c 'touch /probe 2>&1'
# expect: "Read-only file system" — this is the unambiguous rootfs check

docker compose -f caos/deploy/docker-compose.yml exec db sh -c 'grep -E "CapEff|NoNewPrivs" /proc/1/status'
# expect: CapEff 0000000000000000, NoNewPrivs 1

docker compose -f caos/deploy/docker-compose.yml exec db pg_isready -U caos -d caos
# expect: accepting connections
```
**Functional gate**: full app boot (alembic `upgrade head` runs at app startup against this db) succeeds; `docker compose down && docker compose up -d` (or a volume-preserving restart) round-trips data — insert a marker row, recreate the container, confirm it's still there. This last check is the direct regression test for §1.1.

## 5. `caddy`

### 5.1 No derived image needed — the official image already supports this

The official `caddy:2.11.4-alpine` image pre-creates and pre-permissions exactly the two directories Caddy writes to:
```dockerfile
mkdir -p /config/caddy /data/caddy /etc/caddy /usr/share/caddy
chmod 1777 /config/caddy /data/caddy
```
[CERTAIN — `caddyserver/caddy-docker` `2.11/alpine/Dockerfile`] and sets:
```dockerfile
ENV XDG_CONFIG_HOME=/config
ENV XDG_DATA_HOME=/data
```
which is exactly where Caddy's storage layer writes ACME certificates (`$XDG_DATA_HOME/caddy` = `/data/caddy`) and autosave config (`$XDG_CONFIG_HOME/caddy` = `/config/caddy`) [CERTAIN — Caddy's documented file-location convention, `caddyserver.com/docs/conventions#file-locations`, matches the env vars set in the image]. Because those two subdirectories are `1777` (world-writable, sticky), **any** non-root uid can create files inside them without any chown or derived image — no `caddy` user exists in the base image at all (confirmed: no `USER`/`adduser`/`addgroup` directive anywhere in the Dockerfile), so there is nothing to inherit; an arbitrary numeric uid works. [CERTAIN, verified at the Docker/containerd implementation level, not just documentation: named-volume "populate on first use" (`moby/moby` `copyExistingContents` → `containerd/continuity` `fs.CopyDir`) recurses into subdirectories and calls `copyFileInfo` — explicit `Lchown` + `Chmod` — on every entry, so the `1777` mode on `/data/caddy` genuinely survives being copied into a fresh named volume, not just the top-level `/data` dir.]

The image also runs `setcap cap_net_bind_service=+ep /usr/bin/caddy` at build time — a file capability that would let the caddy binary bind ports <1024 as non-root. This is **inert** under the design below, for two independent reasons: (1) Caddy is reconfigured to listen on unprivileged ports 8080/8443 entirely, so nothing needs that capability; (2) even if it did, `security_opt: ["no-new-privileges:true"]` (kept in §5.2) disables file-capability elevation on `exec()` per `capabilities(7)` — so this baked-in setcap bit is not a usable fallback path either way, it simply does nothing once NNP is set. Noted so a future editor doesn't mistake it for a live escape hatch.

**No `Dockerfile.caddy` — use the stock image, override `user:` in compose only.**

### 5.2 Compose directives

```yaml
  caddy:
    image: caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
    restart: unless-stopped
    depends_on: [oauth2-proxy]
    user: "10002:10002"     # arbitrary — no /etc/passwd entry needed, see §5.3 caveat
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]        # NET_BIND_SERVICE dropped entirely — no longer needed, see below
    read_only: true
    pids_limit: 128
    mem_limit: 256m
    ports:
      - "80:8080"
      - "443:8443"
      - "443:8443/udp"       # HTTP/3 — the current tcp-only mapping silently drops h3; see §11
    environment:
      CAOS_DOMAIN: ${CAOS_DOMAIN:?set in .env}
      EDGE_PROXY_SECRET: ${EDGE_PROXY_SECRET:?set in .env — injected by Caddy, validated by the app}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks: [internal]
```

**Why `cap_add: ["NET_BIND_SERVICE"]` is deleted, not kept**: it exists today only so root-Caddy can bind ports 80/443 (<1024). Once Caddy listens on unprivileged ports 8080/8443 *inside* the container and the host-side port remap (`"80:8080"`, `"443:8443"`) does the privileged-port binding on the **host**, not in the container, no capability is needed at all. This is the standard documented pattern for non-root Caddy.

### 5.3 Caddyfile change — add a global options block

`caos/deploy/Caddyfile` needs one addition at the very top, before the existing site block, switching Caddy's own listen ports:
```caddyfile
{
	http_port 8080
	https_port 8443
}

# ...existing site block ({$CAOS_DOMAIN} { ... }) unchanged below...
```
Caddy's automatic HTTP→HTTPS redirect and ACME HTTP-01/TLS-ALPN-01 challenge handling both follow `http_port`/`https_port` automatically — no other Caddyfile change needed. [CERTAIN — documented Caddy global-options directive]

**Numeric-uid caveat**: `user: "10002:10002"` has no matching `/etc/passwd` entry inside the container (the image never creates one). Caddy is a static Go binary and doesn't need an NSS lookup for its own operation — `XDG_DATA_HOME`/`XDG_CONFIG_HOME` are set explicitly so it never falls back to resolving a home directory via `os/user`. [VERIFY AT IMPLEMENTATION — this is the one claim in this section not independently confirmed against Caddy's own source; if the container fails to start with any "unable to find current user" / uid-lookup error, the fallback is to add a 3-line derived `deploy/Dockerfile.caddy` that runs `adduser` for a real passwd entry: `FROM caddy:2.11.4-alpine@sha256:...` / `RUN addgroup -g 10002 caddy && adduser -D -H -h /data -u 10002 -G caddy caddy` / no `USER` line needed since compose's `user:` already sets it — the addgroup/adduser alone would resolve the passwd-lookup gap without changing anything else.]

### 5.4 Migration for the existing `caddy-data`/`caddy-config` volumes

The `1777` mode on `/data/caddy` and `/config/caddy` only governs *new* file creation — files Caddy already wrote as root (existing certs, autosave.json) remain root-owned and unreadable/unwritable by uid 10002. One-shot, run once at cutover:
```bash
docker compose -f caos/deploy/docker-compose.yml run --rm --user 0:0 --cap-add=CHOWN --entrypoint sh caddy -c 'chown -R 10002:10002 /data /config'
```
`--cap-add=CHOWN` is required, not optional, even with `--user 0:0`: `docker compose run` inherits the service's `cap_drop: ["ALL"]` (§5.2) unconditionally — `--user` overrides the uid but does not restore any capability, and `chown(2)` needs `CAP_CHOWN` regardless of uid once capabilities are stripped. Without the flag this fails with `Operation not permitted` on every file. (The `read_only: true` rootfs is *not* the problem here — `/data`/`/config` are separately-mounted named volumes without `:ro`, so they stay writable regardless of the rootfs setting; only the missing capability blocks this.) (Alternative: delete the `caddy-data` volume and let Let's Encrypt reissue — works, but burns rate-limit budget; the chown is preferred.)

### 5.5 Verification

```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}} add={{.HostConfig.CapAdd}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q caddy)"
# expect: 10002:10002 ro=true drop=[ALL] add=[]  (add MUST be empty — no NET_BIND_SERVICE)

docker compose -f caos/deploy/docker-compose.yml exec caddy id -u 2>&1 || docker top "$(docker compose -f caos/deploy/docker-compose.yml ps -q caddy)"
# `id` may fail (no passwd entry, §5.3 caveat) — docker top's UID column is the reliable fallback, expect 10002

docker compose -f caos/deploy/docker-compose.yml exec caddy sh -c 'touch /probe 2>&1'
# expect: "Read-only file system"

docker compose -f caos/deploy/docker-compose.yml exec caddy sh -c 'touch /data/caddy/probe && rm /data/caddy/probe && echo data-writable-ok'
# expect: data-writable-ok

docker compose -f caos/deploy/docker-compose.yml exec caddy sh -c 'grep -E "CapEff|NoNewPrivs" /proc/1/status'
# expect: CapEff 0000000000000000, NoNewPrivs 1
```
**Functional gate**: `curl -sSI https://$CAOS_DOMAIN` returns a valid TLS handshake + expected status (200/302); check `docker compose logs caddy` for successful cert issuance/renewal with no `permission denied` lines; confirm host ports 80/443 are still what's exposed externally (`docker compose port caddy 8080` / `443`) even though the container listens on 8080/8443 internally.

## 6. `oauth2-proxy`

### 6.1 Confirmed default user

`quay.io/oauth2-proxy/oauth2-proxy:v7.15.3` (the plain tag, no `-alpine` suffix — matches what's pinned today) is built with:
```makefile
DOCKER_BUILD_RUNTIME_IMAGE ?= gcr.io/distroless/static:nonroot
```
[CERTAIN — `oauth2-proxy/oauth2-proxy` `Makefile`, the default (non-`-alpine`) release target]. Google's distroless `:nonroot` variant runs as uid/gid `65532:65532`:
```
NONROOT = 65532
```
[CERTAIN — `GoogleContainerTools/distroless` `common/variables.bzl`]. So the image **already** runs non-root today, without any compose change — but the image sets no `USER` directive of its own visible in `oauth2-proxy`'s Dockerfile (it inherits distroless's baked-in default). Making it explicit in compose pins the behavior against any future base-image change and makes it auditable via `docker inspect` without trusting image metadata.

### 6.2 Compose directives

```yaml
  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.15.3@sha256:10a1165743a192e1940b4708fb9647027185ce11a681a1c5519b442ff7f1f561
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    user: "65532:65532"
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]
    read_only: true
    pids_limit: 64
    mem_limit: 256m
    command: ["--config=/etc/oauth2-proxy.cfg"]
    environment:
      OAUTH2_PROXY_CLIENT_ID: ${OAUTH2_PROXY_CLIENT_ID:?set in .env}
      OAUTH2_PROXY_CLIENT_SECRET: ${OAUTH2_PROXY_CLIENT_SECRET:?set in .env}
      OAUTH2_PROXY_COOKIE_SECRET: ${OAUTH2_PROXY_COOKIE_SECRET:?openssl rand -base64 32}
      OAUTH2_PROXY_REDIRECT_URL: https://${CAOS_DOMAIN:?set in .env}/oauth2/callback
      OAUTH2_PROXY_EMAIL_DOMAINS: ${CAOS_EMAIL_DOMAIN:?set in .env}
    volumes:
      - ./oauth2-proxy.cfg:/etc/oauth2-proxy.cfg:ro
    networks: [internal]
    # tmpfs REMOVED — oauth2-proxy sessions are client-side cookies; the process
    # writes nothing at runtime AS CURRENTLY CONFIGURED (see caveat below).
    # "tmpfs only where genuinely needed" (goal) means this one goes away
    # rather than staying as unused belt-and-braces.
```
**Caveat on "writes nothing"**: true only as long as `oauth2-proxy.cfg` never sets `logging_filename` (file-based log output — dormant today, source-traced to a real `os.OpenFile` call gated only on that option being non-empty), `redis_connection_url`/`session_store_type: redis` (an alternate session backend — not in use; cookies are the default and what's configured), or `tls_cert_file`/`tls_key_file` (in-process TLS termination — not in use). If a future edit to `oauth2-proxy.cfg` adds any of those, this service needs a `/tmp` tmpfs restored (or an appropriately-scoped one for whichever path is written) or it fails closed under `read_only: true` — which is the correct failure mode (loud, not silent data loss), but worth knowing in advance rather than debugging from a cold start.

[VERIFY AT IMPLEMENTATION — confirm the removed tmpfs doesn't break anything: `docker image inspect quay.io/oauth2-proxy/oauth2-proxy:v7.15.3 -f '{{.Config.User}}'` should print `65532` or empty-inheriting-from-base (distroless sets it at the base-image layer, may not surface in the final image's own `Config.User` — either way the numeric `user:` override in compose makes this moot). Full login round-trip test is the real gate (see below).]

### 6.3 Verification

```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q oauth2-proxy)"
# expect: 65532:65532 ro=true drop=[ALL]

docker top "$(docker compose -f caos/deploy/docker-compose.yml ps -q oauth2-proxy)"
# UID column: expect 65532, never root/0 (no shell in this image — docker exec/id is not possible, this is the reliable check)
```
No EROFS touch-probe or `/proc/1/status` grep is possible here — distroless has no shell, no `cat`, no `sh`. The `read_only: true` + non-root `user:` + `cap_drop: [ALL]` combination is enforced by the kernel/runtime regardless of whether we can interactively prove it from inside; `docker inspect`'s `HostConfig` fields are authoritative here since they reflect what was actually passed to the container runtime, not container-reported state.

**Functional gate** (this is the real test, given inspection is limited): full login round-trip through Caddy → oauth2-proxy → app, and logout, with `read_only: true` and no `/tmp` tmpfs — confirms no write attempt anywhere in the auth flow.

## 7. `backup`

### 7.1 Derived Dockerfile — needed because `/backups` doesn't exist in the base image

Unlike `caddy`'s `/data`/`/config` (pre-created and pre-permissioned by the upstream image for exactly this purpose), `/backups` is an application-specific path with no equivalent upstream convenience. A brand-new named volume mounted at a path absent from the base image initializes **root-owned**, mode `755` — uid `70` (below) can't write there without a chown somewhere. A 3-line derived image does it once, so a fresh volume inherits correct ownership automatically (same "populate on first use" mechanism as §3/§5):

`caos/deploy/Dockerfile.backup`:
```dockerfile
# syntax=docker/dockerfile:1
FROM postgres:18-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15
RUN mkdir -p /backups && chown 70:70 /backups
USER 70:70
```
`postgres:18-alpine`'s `postgres` system user is uid/gid `70:70` [CERTAIN — `docker-library/postgres` `18/alpine3.23/Dockerfile`: `addgroup -g 70 -S postgres; adduser -u 70 -S -D -G postgres -H -h /var/lib/postgresql -s /bin/sh postgres`]. The `backup` service never runs Postgres's own server locally (it overrides `entrypoint: ["/bin/sh", "/backup.sh"]`, bypassing `docker-entrypoint.sh` entirely — `pg_dump`/`psql`/`tar` are used purely as network clients against the `db` service), so **§1.1's PGDATA/volume issue does not apply to `backup` at all** — it's an unrelated concern for this service.

### 7.2 Compose directives

```yaml
  backup:
    build:
      context: .
      dockerfile: Dockerfile.backup
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    user: "70:70"
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]
    read_only: true
    tmpfs:
      - /tmp:size=16m,mode=1777   # defensive — pg_dump -Fc / tar write only to their named targets, but cover any stray temp use
    pids_limit: 64
    mem_limit: 512m
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      BACKUP_KEEP: ${BACKUP_KEEP:-7}
      BACKUP_INTERVAL_SECONDS: ${BACKUP_INTERVAL_SECONDS:-86400}
    entrypoint: ["/bin/sh", "/backup.sh"]
    volumes:
      - ./backup.sh:/backup.sh:ro
      - vault-data:/vault:ro
      - backups:/backups
    networks: [internal]
```

**No `.pgpass`/HOME dependency**: `backup.sh` authenticates via the `PGPASSWORD` environment variable passed straight to `pg_dump -U caos` — confirmed by direct read of the script; no home-directory credential file is used, so uid 70's minimal home (`-H` = no home dir created, per the alpine `adduser` flags above) is not a problem.

**Regression to fix — the 16 MB `/tmp` tmpfs breaks `backup.sh`'s own documented restore drill.** `backup.sh`'s header comment documents a quarterly DR-drill procedure to run inside this container: `mkdir -p /tmp/vault_restore_test && tar -xzf /backups/caos-vault-<ts>.tar.gz -C /tmp/vault_restore_test`. The `run_once()` path itself (§7.4's audit confirmed) never touches `/tmp` — `pg_dump -f` and `tar -czf` both write straight to their named `/backups` targets, so 16 MB is correctly sized for *that* path. But the drill decompresses a full vault tarball into `/tmp`, and a single upload can already be `MAX_UPLOAD_MB=250` — any real vault tarball will exceed a 16 MB tmpfs by a wide margin, and today's unhardened service has no such ceiling (writable rootfs, no tmpfs) so this has never been an issue before. **Fix**: extract into `/backups/_vault_restore_test/` instead (same volume this service already owns, no size ceiling; the rotation logic only globs `caos-db-*.dump`/`caos-vault-*.tar.gz` directly under `/backups`, not subdirectories, so no collision — `rm -rf` it after verifying). Update `backup.sh`'s comment to match when this blueprint is implemented; the drill only runs manually/quarterly, so this doesn't block the compose/Dockerfile changes, but leaving the comment pointed at `/tmp` will silently fail the next person who follows it.

**Separately, pre-existing and out of this blueprint's scope**: the same header comment's restore-drill examples (`createdb`, `pg_restore`, `dropdb`) omit the `PGPASSWORD="$POSTGRES_PASSWORD"` prefix that `run_once()`'s own `pg_dump` call uses — as written they'll fail auth in a non-interactive shell against this stack's default `scram-sha-256` setup. Not a hardening issue (nothing here changes with `read_only`/`cap_drop`/`user:`), but flagged because it undermines the same drill this section just fixed the `/tmp` sizing for — worth a one-line fix (`PGPASSWORD="$POSTGRES_PASSWORD"` prefix on each) whenever `backup.sh` is next touched.

### 7.3 Migration for the existing `backups` volume

If `backups` already has content written as root by the current (unhardened) service, one-shot before cutover:
```bash
docker compose -f caos/deploy/docker-compose.yml run --rm --user 0:0 --cap-add=CHOWN --entrypoint sh backup -c 'chown -R 70:70 /backups'
```
`--cap-add=CHOWN` is required even with `--user 0:0` — `docker compose run` inherits this service's `cap_drop: ["ALL"]` (§7.2) regardless of the uid override, and `chown(2)` needs `CAP_CHOWN` unconditionally once capabilities are stripped (see §4.2's fuller explanation of this mechanism; it applies identically here).

### 7.4 Verification

```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}}' "$(docker compose -f caos/deploy/docker-compose.yml ps -q backup)"
# expect: 70:70 ro=true drop=[ALL]

docker compose -f caos/deploy/docker-compose.yml exec backup id -u
# expect: 70

docker compose -f caos/deploy/docker-compose.yml exec backup sh -c 'touch /probe 2>&1'
# expect: "Read-only file system"

docker compose -f caos/deploy/docker-compose.yml exec backup sh -c 'touch /backups/probe && rm /backups/probe && echo backups-writable-ok'
# expect: backups-writable-ok

docker compose -f caos/deploy/docker-compose.yml exec backup sh -c 'grep -E "CapEff|NoNewPrivs" /proc/1/status'
# expect: CapEff 0000000000000000, NoNewPrivs 1
```
**Functional gate**: let one full backup cycle run (or trigger manually), then `docker compose logs backup | grep 'ok ->'` for both the Postgres dump and the vault tarball artifacts (per `backup.sh`'s own success-logging convention) — confirms uid 70 can read `vault-data:ro` and write both artifacts to `/backups`.

## 8. `clamav` (opt-in, compose profile `av`)

### 8.1 Officially supported non-root mode — no derived image, no fallback needed

This is **not** a best-effort design — `clamav/clamav` ships a first-class, maintainer-documented unprivileged entrypoint. The image's own README states:

> ### Running ClamD using non-root user using --user and --entrypoint
> You can run a container using the non-root user "clamav" with the unprivileged entrypoint script. To do this with Docker, you will need to add these two options: `--user "clamav" --entrypoint /init-unprivileged`

[CERTAIN — `Cisco-Talos/clamav-docker` `README-alpine.md`, §"Running ClamD using non-root user"]. The image creates the `clamav` user at build time (`adduser -D -G "clamav" -h "/var/lib/clamav" -s "/bin/false" -u 100 -S "clamav"`) and ships two entrypoint scripts: the default root one (`/init`) and `/init-unprivileged`, which starts `freshclam` and `clamd` without ever attempting a root-only chown step. Use `user: "clamav"` (by name — Docker resolves it against the image's own `/etc/passwd` at container start, sidestepping the need to guess the auto-assigned system gid) and override the entrypoint.

### 8.2 Compose directives

```yaml
  clamav:
    image: clamav/clamav:1.5@sha256:6f4a9e7d616ffc8d1070200fe35ac860735fdd522161a1043f94856e6ee13c28
    profiles: ["av"]
    restart: unless-stopped
    user: "clamav"
    entrypoint: ["/init-unprivileged"]
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]
    read_only: true
    tmpfs:
      - /tmp:size=768m,mode=1777          # clamd.sock + INSTREAM scan buffer — see sizing caveat below
      - /var/log/clamav:size=8m,mode=1777 # freshclam's UpdateLogFile target — see below, not optional
    pids_limit: 256
    mem_limit: 3g   # was 2g — clamd RSS (~1.3-1.5g) + up to 768m tmpfs pages now both charge this cgroup
    volumes:
      - clamav-data:/var/lib/clamav
      - ./clamd.conf:/etc/clamav/clamd.conf:ro
    healthcheck:
      test: ["CMD", "clamdcheck.sh"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s
    networks: [internal]
```

**Why `/tmp` needs 768 MB, not the app's 64 MB**: `clamd`'s own INSTREAM handling (`handle_stream()`) genuinely materializes the *entire* incoming stream to a real temp file in `/tmp` before scanning — not a streaming scan, confirmed at the source level (`clamd/server-th.c`: each chunk is written via `cli_writen()` to a `cli_gentempfd()`-opened file as it arrives, quota-checked against `StreamMaxLength` per chunk; the scan itself only starts once the terminator chunk closes the stream). `caos/deploy/clamd.conf` raises `StreamMaxLength`/`MaxScanSize`/`MaxFileSize` to `300M` specifically so uploads up to `MAX_UPLOAD_MB=250` scan instead of failing closed, so a single scan's data can be up to that size; `mode=1777` is needed since the tmpfs is created before the container's non-root user exists to own it.

**Sizing caveat this design does not fully close — concurrent uploads, not single-file size, are the real ceiling.** The 768 MB figure covers one worst-case scan (300 MB StreamMaxLength + slack) with headroom for a single in-flight upload. It does not cover concurrency: `caos/server/avscan.py` opens one independent TCP `INSTREAM` connection per upload with no semaphore or serialization, and clamd's receive/buffering step is not gated by `MaxThreads` (that setting only caps concurrent *scan* workers, not the connection-level write-to-tmp step that happens before a scan thread is even needed) — so N simultaneous large uploads can genuinely accumulate N × up-to-300MB in `/tmp` at once. Three simultaneous near-max uploads already exceeds 768 MB. **This blueprint does not resolve this** (fixing it means either an application-level change — a concurrency semaphore in `avscan.py`, out of this document's Dockerfile/compose scope — or an operational decision to size `/tmp` for a specific expected peak concurrency, e.g. `StreamMaxLength × N_expected + slack`). Flagging it explicitly rather than presenting 768 MB as a value that closes the question: it closes the single-upload case only. §8.4's functional gate (below) is extended with a concurrent-upload check specifically because the single-file gate that was here originally would not have caught this.

**`/var/log/clamav` tmpfs — not cosmetic, prevents log noise on every freshclam line.** The image's baked `freshclam.conf` unconditionally sets `UpdateLogFile /var/log/clamav/freshclam.log`; `freshclam`'s `--stdout` flag (passed by `/init-unprivileged`) only adds console output, it does not disable the file-log target — so every freshclam log line, including during the first-boot signature download in §8.4's gate 1, attempts a real file write. Without a mount there, each of those attempts fails `EROFS` under `read_only: true` (non-fatal — freshclam logs the failure and continues — but it means `docker compose logs clamav` is spammed with `"ERROR: Failed to open log file ... Read-only file system"` on every single line, exactly when an operator is watching first boot for real problems, and it also means §8.4 gate 6's original `grep -i denied` check would not have caught this failure mode at all since the error text is "Read-only file system," not "denied"). The `/var/log/clamav` tmpfs entry above makes these writes succeed instead, eliminating the noise entirely — simpler than teaching the verification gate to ignore an expected-benign error string.

**Why `read_only: true` is safe here**: `/init-unprivileged` writes only to `/tmp` (socket + a first-boot `freshclam_initial.conf`) and `/var/lib/clamav` (the signature DB, via `DatabaseDirectory` in the mounted `clamd.conf` — already a named volume). It reads (never writes) the image's own `/etc/clamav/freshclam.conf` — our mounted `clamd.conf` only replaces the clamd config, not freshclam's, and that file is left at its image-default path/permissions (world-readable), fine under a read-only rootfs.

**`clamd.conf`'s `User` directive**: the image's *default* clamd.conf template sets `User clamav` [CERTAIN — `Cisco-Talos/clamav-docker` build script: `sed ... -e "s|.*\(User\) .*|\1 clamav|" ... clamd.conf.sample`] so that a root-started `clamd` can drop privilege internally. `caos/deploy/clamd.conf` is a whole-file replacement that omits this line entirely — irrelevant once the *container itself* starts as `clamav` via `user:` (nothing to drop from), so no change to the mounted `clamd.conf` is needed.

### 8.3 `/var/lib/clamav` volume ownership

The image's own `RUN ... chown -R clamav:clamav /var/lib/clamav` at build time means a fresh volume mounted there inherits `clamav`-ownership on first use, same mechanism as §3/§5/§7. [VERIFY AT IMPLEMENTATION — if migrating an existing `clamav-data` volume populated by a prior root run: `docker compose --profile av run --rm --user 0:0 --cap-add=CHOWN --entrypoint sh clamav -c 'chown -R clamav:clamav /var/lib/clamav'` — `--cap-add=CHOWN` is required even with `--user 0:0`, per the same `docker compose run` capability-inheritance mechanism explained in §4.2 (this service's `cap_drop: ["ALL"]`, §8.2, is inherited regardless of the uid override).]

### 8.4 Verification

```bash
docker inspect -f '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} drop={{.HostConfig.CapDrop}}' "$(docker compose -f caos/deploy/docker-compose.yml --profile av ps -q clamav)"
# expect: clamav ro=true drop=[ALL]

docker compose -f caos/deploy/docker-compose.yml --profile av exec clamav id
# expect: uid=100(clamav) gid=<resolved>(clamav) — note the exact gid here for any future numeric-uid pinning preference

docker compose -f caos/deploy/docker-compose.yml --profile av exec clamav sh -c 'touch /probe 2>&1'
# expect: "Read-only file system"

docker compose -f caos/deploy/docker-compose.yml --profile av exec clamav sh -c 'grep -E "CapEff|NoNewPrivs" /proc/1/status'
# expect: CapEff 0000000000000000, NoNewPrivs 1
```
**Functional gate, in order** (this service has more first-boot complexity than the others — walk through all of these once at cutover):
1. Fresh `clamav-data` volume, first boot as `clamav` — confirm `freshclam` completes the initial signature-DB download and logs `"socket found, clamd started."` (from `/init-unprivileged`'s own log line).
2. Restart the container with the now-populated volume — confirm it comes up clean (no re-download).
3. `clamdcheck.sh` healthcheck reports healthy as uid 100.
4. Send an EICAR test string through the app's upload → ClamAV path — confirm it's rejected.
5. Send a ~250 MB benign file through the same path — confirm it scans within the 768 MB tmpfs budget and doesn't 503.
6. **Concurrency check** (added per the sizing caveat above — the single-file gate above does not exercise this): send 3 simultaneous large (~200 MB+) uploads through the app at once and confirm `/tmp` doesn't fill (`docker compose --profile av exec clamav df -h /tmp` during the run) — if it does, either serialize uploads at the app layer or raise the tmpfs size to match real expected concurrency before shipping this to production traffic.
7. `docker compose --profile av logs clamav | grep -i denied` — expect no output. With the `/var/log/clamav` tmpfs fix above, also expect zero `"Read-only file system"` lines; if any appear, something is still writing outside the two tmpfs mounts and needs tracing.

## 9. Rollout / cutover order

Apply in this order — later steps assume earlier ones are done:

1. **§1.2** tiktoken dependency fix (requirements.txt + lock regen) — independent, no risk, do first.
2. **§1.3** `.dockerignore` replacement (§10) — independent, do anytime before the next image build.
3. **§1.1** db volume-mount fix, including the diagnostic and (if needed) data migration — do this *before* touching any other db directive; it's a correctness fix, not a hardening one, and everything in §4 assumes it's already done.
4. **§3** app image rebuild (3-stage Dockerfile + compose scratch volume + **§1.4's Modular OS bind mount**) — rebuild and functionally test before moving on: the upload/OCR path per §3.4, **and** §1.4's permission check (`find "Modular OS" -type f ! -perm -044 -o -type d ! -perm -055` should print nothing) plus a live synthesis call for at least one CP module. Treat §1.4 as equally load-bearing here as the scratch volume — it's folded into this same step's compose block, not a separate step, but it is not optional and has its own failure mode (silent `SynthesisError` on a hardened host, see §1.4).
5. **§4** db hardening (`user:`, `cap_drop`, `read_only`, tmpfs, `shm_size`) — apply only after step 3's diagnostic confirms the volume is healthy.
6. **§5** caddy (Caddyfile global-options edit + compose `user:`/port remap) + one-shot volume chown. **These three changes (Caddyfile port block, compose `user:`, compose `cap_drop: ["ALL"]`+port remap) must land as one atomic deploy — do not apply them one at a time with a restart in between.** [CONFIRMED BY AUDIT] Landing the compose changes (non-root user, no `NET_BIND_SERVICE`) before the Caddyfile port change: Caddy tries to bind the default privileged ports 80/443 as non-root with no capability → `EACCES` → crash-loops the stack's sole ingress. Landing the Caddyfile port change before the compose port remap: Caddy listens internally on 8080/8443 while the host still forwards the old 80/443 → nothing answers on the published ports → silent full-site outage, and `caddy`'s compose block (§5.2) has no `healthcheck:` to catch it. Apply all three in the same change, restart once, then run §5.5's verification.
7. **§6** oauth2-proxy (digest pin + explicit `user:` + tmpfs removal) — lowest risk, no behavior change expected.
8. **§7** backup (`Dockerfile.backup` + compose) + one-shot volume chown.
9. **§8** clamav, only if the `av` profile is in use — walk the full 6-step functional gate in §8.4 before considering it done, **and run §8.3's `chown -R clamav:clamav /var/lib/clamav` migration first if the `av` profile has ever been started under the current (unhardened) config** — the existing `clamav` service sets no `user:` override today, so `/var/lib/clamav`'s ownership after any prior root run is not guaranteed to already be uid 100, the same class of gap step 6 and step 8 already call out for their own volumes.

After every step, run that section's verification block before moving to the next — don't batch all six services' changes into one `docker compose up -d --build` and debug backwards.

## 10. `.dockerignore` — full replacement

Two live leaks fixed by depth-anchoring (§1.3): `server/.env` and `server/.venv311` are currently baked into the image because the existing patterns (`.env`, `.env.*`, `**/.venv`) don't match those exact paths/depths.

**Do not add a blanket `**/*.md` pattern** — `server/deepresearch_demo.md` is read at runtime (`caos/server/deepresearch.py:34`: `_DEMO_PATH = Path(__file__).resolve().parent / "deepresearch_demo.md"`). The root-anchored `*.md` below is deliberate and must stay root-anchored.

Full replacement for `caos/.dockerignore`:
```
# Build context is caos/ (compose context ".."; CI context "caos").
# Anchored patterns match the context root; **/ patterns match at any depth.

# VCS / OS
**/.git
**/.gitignore
**/.DS_Store

# Secrets — any depth. server/.env was previously baked into the image (see
# blueprint §1.3) because the old pattern was root-anchored only.
**/.env
**/.env.*

# Python artifacts / local envs (server/.venv311 was previously baked in —
# the old **/.venv pattern didn't match the "311" suffix; **/.venv* alone
# already covers bare .venv too, so no separate **/.venv line is needed)
**/__pycache__
**/*.py[cod]
**/.venv*
**/.pytest_cache
**/.mypy_cache
**/.ruff_cache
**/.coverage
**/coverage
**/coverage.xml
**/htmlcov

# Node / Next.js artifacts
**/node_modules
**/.next
**/.next-*
**/out
**/tsconfig.tsbuildinfo

# Tooling / QA / test artifacts
**/.claude
**/.impeccable
**/.fallow
**/.ds-shims
**/test-results
**/playwright-report
**/capture*.mjs
**/*.log
**/caos_qa.db*

# Repo dirs never needed in the image. NOTE: these are bare (non-**/) patterns,
# so they match ONLY at the context root (caos/scripts, caos/docs, ...) — this
# is deliberate for docs/tests/mcp/data/deploy/server-static/server-data (no
# same-named dir exists elsewhere in the tree today), but "scripts" specifically
# DOES exist at other depths too (server/scripts/, frontend/scripts/) and the
# bare pattern misses both — server/scripts/smoke_gemini.py was confirmed
# shipping into the built runtime image via COPY server/ ./ before this was
# caught. Use the recursive form for scripts specifically:
**/scripts
docs/
tests/
mcp/
data/
deploy/
server/static
server/data

# Docs — root-anchored ON PURPOSE: server/deepresearch_demo.md is read at
# runtime (deepresearch.py). A **/*.md pattern would break demo deep-research.
# NOTE: this does not and cannot cover Modular OS/*_ACTIVE_PROMPT.md — that
# corpus lives outside this build context entirely; see §1.4, a separate
# (and far more severe) pre-existing defect no .dockerignore pattern can fix.
*.md
```

[VERIFY AT IMPLEMENTATION — `**/.env.*` drops the context-root `caos/.env.example` from the build context (the audit's initial check cited `frontend/.env.example`, which does not exist anywhere in this repo — the file actually affected is `caos/.env.example`). Confirmed nothing reads it at build time (static export, no `.env.production` in the tree) — but re-run the CI `image` job after this change to confirm the frontend build still passes with it absent.]

**Second, unfiltered build context — `caos/deploy/`.** §7.1's new `Dockerfile.backup` builds with `context: .` from `caos/deploy/docker-compose.yml`, i.e. the build context is `caos/deploy/` itself — a directory with no `.dockerignore` of its own. This ships the entire `deploy/` directory (`docker-compose.yml`, `oauth2-proxy.cfg`, `clamd.conf`, `.env.example`, `backup.sh`, `Caddyfile`, `README.md`) into the `backup` build context unfiltered. No live secret sits there today (only `deploy/.env.example`, a template — confirmed no `deploy/.env` exists), so this is context hygiene, not an active leak, but add a matching `caos/deploy/.dockerignore`:
```
**/.env
**/.env.*
**/.git
```
(narrower than `caos/.dockerignore` since `deploy/` has no build artifacts/venvs of its own — this just closes the same secret-shaped-file gap for the second build context this blueprint introduces).

## 11. Appendix — adjacent hardening (short, non-core)

Not part of the core zero-root goal, but directly relevant and cheap to apply alongside it:

1. **`init: true` on `app`** (already included in §3.3) — `python run.py` as PID 1 doesn't reap orphaned children; the OCR lane forks `ocrmypdf` → Ghostscript/Tesseract subprocesses, and a mid-OCR container kill (OOM, restart) can leave zombies. One line, real fix, already folded into §3.3's snippet.
2. **`pids_limit`** — included per-service above (app 512, db 256, clamav 256, caddy 128, oauth2-proxy 64, backup 64) as a fork-bomb/leak ceiling. Values are conservative estimates, not load-tested; revisit if a service legitimately needs more concurrent processes. `db`/`clamav`/`caddy`/`oauth2-proxy`/`backup`'s numbers were independently checked against each process's actual fork pattern (Postgres's `max_connections`-derived backend count, clamd's documented `MaxThreads`, Caddy/oauth2-proxy's goroutine-not-OS-thread concurrency, backup's sequential script) and confirmed comfortably sufficient. `app`'s 512 is the one value with a real, connected risk: it's the same OCR-lane unbounded-parallelism gap §3.3 already flags (no `--jobs` cap on `ocrmypdf` + no upload-concurrency limit) — a few simultaneous large scanned-PDF uploads on a many-core host could plausibly approach it. Not a new defect, just the same one showing up in a second place; the §3.3 load-test recommendation is what actually resolves this, not a bigger `pids_limit`.
3. **Log rotation** — none of the six services currently set a `logging:` block; all log to stdout/stderr (confirmed for `app` — no `FileHandler` anywhere in `caos/server/main.py`'s logging config), which Docker's default `json-file` driver will grow unbounded. Add per-service:
   ```yaml
   logging:
     driver: json-file
     options:
       max-size: "10m"
       max-file: "3"
   ```
   Caveat: if logs are meant to ship off-host for retention/audit before rotation drops them, wire that first — rotation without shipping is a silent retention-policy change, not just a hardening tweak.
4. **oauth2-proxy healthcheck gap** — distroless has no shell, so no `HEALTHCHECK CMD` is possible for this image (confirmed limitation, not an oversight to fix). `caddy`'s `depends_on: [oauth2-proxy]` stays order-only (no `condition: service_healthy`) for this service. Accept as-is — Caddy's `reverse_proxy` already retries a dead upstream; don't add a shell-ful sidecar just to manufacture a healthcheck.
5. **Invariants already true, worth asserting rather than re-deriving**: no `docker.sock` mount anywhere in the stack, no `privileged: true`, no `network_mode: host` — confirmed by direct read of `caos/deploy/docker-compose.yml`. Image-build reproducibility is already handled at the input level (digest-pinned bases, `npm ci`, `--require-hashes` pip) — chasing fully bit-identical output artifacts is out of scope for this pass.

## 12. Coverage summary

| Image | Zero-root by design | Confidence |
|---|---|---|
| app (built) | Yes | Design-certain; functional gates (OCR upload, tiktoken) not yet run against a live build. **Conditional on §1.4's Modular OS bind mount** for the LLM-synthesis feature specifically to work — the zero-root/read-only properties themselves don't depend on it |
| db (pgvector/pgvector:pg18) | Yes, **conditional on §1.1's mount fix landing first** | Mechanism confirmed from upstream source; live volume-migration path is a real operational step, not just a compose edit |
| caddy | Yes, **conditional on §9 step 6's three changes landing atomically** | Design-certain from upstream Dockerfile source; one unverified claim (§5.3 numeric-uid NSS lookup) with a documented fallback; the atomicity requirement is a rollout-order risk, not a design gap |
| oauth2-proxy | Yes | Design-certain (Makefile + distroless source); verification is inspection-only since the image has no shell |
| backup | Yes | Design-certain on the hardening design itself (`user:`/`cap_drop`/`read_only`); one unrelated, pre-existing, unfixed bug noted in passing (§13's row for §7 — a `PGPASSWORD`-missing typo in `backup.sh`'s own restore-drill comment) |
| clamav (opt-in) | Yes | Design-certain — officially documented non-root entrypoint, not a best-effort fallback design |

Every image in the stack reaches the stated goal (unprivileged, read-only rootfs, digest-pinned, `cap_drop: ["ALL"]`, no re-added capabilities) **by design**. None required accepting a documented compromise (e.g. "must stay root") — the clamav section in particular started this research expecting to need a root-fallback path and didn't: the official image ships first-class non-root support. The items gating full confidence are operational, not architectural: §1.1's db volume-mount fix (and migration, if live data already exists under the wrong path), §1.4's Modular OS bind mount and its host-permission dependency (for the LLM-synthesis feature — the app container is still zero-root without it, it just can't run its core analytical workload), and §9 step 6's caddy changes landing as one atomic deploy rather than piecemeal. Two smaller items are accepted as open by design, not architectural gaps: the app OCR-lane's memory footprint under worst-case concurrent uploads (§3.3) and clamav's `/tmp` tmpfs sizing under concurrent scans (§8.2) — both require an application-code change outside a Dockerfile/compose document's scope and are documented with the exact load test needed before either is treated as closed.

**Two defects found during this work are pre-existing production bugs, not hardening gaps** — they would be true of the current, unhardened container too: §1.1 (db mounted at the wrong path for PG18 — any fresh deploy crash-loops) and §1.4 (Modular OS corpus outside the build context — `LiveSynthesizer` cannot run). Both were surfaced incidentally while researching this blueprint and are fixed here because leaving them would make the hardening work moot, not because they're in scope for a hardening pass on their own.

## 13. Audit trail

Every section above was independently audited by a fresh-context subagent instructed to adversarially verify the design against ground truth (this repo's actual files, plus primary-source upstream Dockerfiles/entrypoints/source code re-fetched independently, not trusted from this document's own citations) rather than just check internal consistency. Findings were folded back into the sections above rather than listed separately — this is a record of what each audit found and confirms nothing was silently dropped.

| Section | Audited | Confirmed issues found → fixed in this doc | Confirmed correct / no issue |
|---|---|---|---|
| §1.1/§4 (db) | Yes | Live-data migration snippet's double-mount-same-volume `cp -a` bug (self-referential copy risk) → replaced with single-mount `mv`-based procedure | The core `docker_error_old_databases` fatal-`exit 1` diagnosis, pgvector's unmodified inheritance of postgres's PGDATA/VOLUME/user, uid:gid 999:999, the `db-data:/var/lib/postgresql` fix's correctness, and the full §4.2 compose design — all independently re-verified against freshly-refetched primary source, not just re-checked against this doc's own quotes |
| §1.2/§1.3/§3 (app) | Yes | `vault_export_dir` unaccounted write path → documented as an explicit gap (feature is off by default; guidance added for if it's ever enabled); OCR-lane OOM contributors (upload buffering, unbounded `ocrmypdf --jobs`) → flagged as unresolved, needs a load test before treating `mem_limit: 2g` as final; "no build tools" claim overclaimed (Debian's `python3-setuptools` transitively pulled in via `ocrmypdf`'s apt `Depends`, inert but present) → reworded to the accurate claim (no *installer*, not "no artifacts at all") | `markitdown` console-script path preservation, `USER caos` ordering, Starlette's `UploadFile` spooling honoring `TMPDIR` (independently confirmed against this repo's own vendored `starlette` source — resolved a claim the first draft had flagged as uncertain), the tiktoken pre-bake mechanism, and the `.dockerignore`/`server/.env`/`.venv311` leak diagnosis |
| §5 (caddy) | Yes | The migration one-liner's missing `--cap-add=CHOWN` (a `docker compose run --user 0:0` does **not** restore a capability `cap_drop: ["ALL"]` removed — confirmed at the `docker/compose` Go source level) → fixed here and, since the same bug pattern applies everywhere a migration snippet combines `user: 0:0` with `cap_drop: ["ALL"]`, also fixed in §4.2, §7.3, §8.3 pre-emptively | The 1777-subdirectory non-root-write design (independently traced to the actual `containerd/continuity` volume-populate implementation, not just Docker's docs), the `http_port`/`https_port` → ACME-challenge-port propagation (independently traced to Caddy's own Go source), and the inertness of the image's baked-in `setcap` bit under `no-new-privileges` (added as a documentation note, not a defect) |
| §6 (oauth2-proxy) | Yes | None — zero confirmed issues. One documentation-precision addition: the "writes nothing at runtime" claim is now stated as conditional on `oauth2-proxy.cfg` never enabling file logging / Redis sessions / in-process TLS, rather than unconditional | The plain `v7.15.3` tag's build path (traced to the exact git-tagged Makefile, confirming it resolves through `build-distroless` not `build-alpine`), the uid:gid 65532:65532 claim (traced to distroless's own BUILD rules and test fixtures), the "no shell at all" claim (traced to distroless's package manifest), and a source-level sweep of oauth2-proxy's own code for any runtime disk write (found none reachable under this repo's actual `oauth2-proxy.cfg`) |
| §7 (backup) | Yes | The 16 MB `/tmp` tmpfs breaks `backup.sh`'s own documented quarterly vault-restore drill (which decompresses into `/tmp`, not `/backups`) → documented with a fix (redirect the drill to `/backups/_vault_restore_test/`) | uid:gid 70:70, the derived `Dockerfile.backup`'s mkdir-then-chown-then-USER ordering, `pg_dump`'s custom-format archiver needing no side scratch file (traced directly into PostgreSQL's own C source), and the `/vault:ro` read-only-compliance of `backup.sh`. One pre-existing, out-of-scope bug surfaced in passing and noted (not fixed): the same restore-drill comment's example commands omit `PGPASSWORD`, so they'd fail auth as written — unrelated to hardening, flagged for whoever next touches `backup.sh` |
| §8 (clamav) | Yes | Two: (1) freshclam's baked-in `UpdateLogFile` target (`/var/log/clamav/freshclam.log`) has no writable mount, so every log line fails `EROFS` (benign but noisy, and invisible to the original verification gate's `grep -i denied`) → added a dedicated tmpfs mount and widened the gate's grep; (2) the 768 MB `/tmp` tmpfs sizing only accounts for one scan in flight — `avscan.py` has no upload-concurrency limit, so simultaneous large uploads can exceed it → documented as an open gap (needs an app-level semaphore or an ops sizing decision) and added a concurrency case to the functional verification gate | The official non-root `--user clamav --entrypoint /init-unprivileged` pattern (independently re-quoted from the README, then traced through the actual entrypoint script to confirm zero root-only steps), and — the one claim this audit was told to be hardest on — that INSTREAM scanning genuinely buffers the full stream to a real `/tmp` file rather than streaming (traced directly into clamd's own C source, `clamd/server-th.c`) |

No section's audit came back clean without at least a documentation refinement except oauth2-proxy, which had zero confirmed issues of any kind. Every CONFIRMED-ISSUE finding above was either fixed directly or, where the fix required an application-code change outside this document's Dockerfile/compose scope (the two "Accepted, flagged not fixed" rows above — app OCR memory footprint, clamav concurrent-scan sizing), documented as an explicit, load-test-gated open item rather than silently presented as resolved. Nothing was silently dropped.

### 13.1 Follow-up completeness pass

The image-by-image audit above (§13's table) covered every per-service section but not the document's cross-cutting parts — §2 (global conventions), §9 (rollout order), §10 (`.dockerignore`), or whether the six per-service compose snippets actually assemble into one valid file. A second round of five fresh-context subagents closed that gap, each independently re-fetching primary source rather than trusting this document's own citations, one of them writing and mechanically validating (`docker compose config`, not just `yaml.safe_load`) a full assembled compose file. Result: one new **critical, pre-existing production defect** (§1.4, not previously known to this blueprint), one confirmed structural defect in this document's own formatting, two rollout-order gaps, several `.dockerignore` completeness gaps, and two overclaimed mechanism explanations that didn't change any recommendation but were stated with more certainty than they'd earned. All fixed below; nothing found was left open except the two items already flagged in §13's table as intentionally out of scope for a Dockerfile/compose-only document.

| Finding | Confirmed issue | Fixed as |
|---|---|---|
| §1 prerequisites completeness | **New, most severe finding of either audit pass**: `caos/server/engine/synth.py` reads a 24-file Modular OS `*_ACTIVE_PROMPT.md` corpus at runtime from a path that resolves outside the `caos/` build context entirely (repo root, sibling to `caos/`) — no `.dockerignore` pattern can reach it, because it was never in context to begin with. `LiveSynthesizer.synthesize()` hard-raises for every CP module in any deployed container whenever a real API key is configured — the platform's core LLM-synthesis feature, broken today, independent of this blueprint. | New §1.4 prerequisite: read-only bind-mount of the corpus into the `app` service, compatible with `read_only: true` with no other change. |
| §3.3 app compose block | The code block glues the `app:` service body to a dedented top-level `volumes:` addendum in one fence with only a comment (not structure) distinguishing them. Verified two ways: `yaml.safe_load` on a literally-spliced full file **passes silently** while actually collapsing 4 of 6 services and losing `app-scratch` (last-key-wins); `docker compose config` — the real, authoritative loader — correctly **rejects** the same file with `mapping key "volumes" already defined`. | §3.3 reformatted into two explicitly separate fragments with an explicit instruction not to paste them contiguously, and a note that `docker compose config`, not `yaml.safe_load` alone, is the authoritative check for this section. |
| §9 step 6 (caddy) | Bundles three changes (Caddyfile port block, compose `user:`, compose `cap_drop`+port-remap) with no statement that they must land atomically. Landing the compose half first: non-root Caddy with no `NET_BIND_SERVICE` tries to bind ports 80/443 → `EACCES` crash-loop of the stack's sole ingress. Landing the Caddyfile half first: Caddy listens on 8080/8443 while the host still forwards the old ports → silent full-site outage, uncaught by any healthcheck (`caddy`'s compose block has none). | §9 step 6 now states the atomicity requirement and names both failure modes explicitly. |
| §9 step 9 (clamav) | Doesn't mention §8.3's volume-ownership migration, unlike step 6 (caddy) and step 8 (backup), which both explicitly append "+ one-shot volume chown." The current unhardened `clamav` service sets no `user:` override, so `/var/lib/clamav`'s ownership after any prior root run isn't guaranteed already-uid-100. | §9 step 9 now names the migration explicitly, matching the parallel structure used for caddy/backup. |
| §10 `.dockerignore` | `scripts/` (bare, root-anchored pattern) misses `server/scripts/` and `frontend/scripts/` — `server/scripts/smoke_gemini.py` confirmed shipping into the built runtime image. `caos/frontend/coverage/` (1.2 MB) matched no pattern. `**/.venv` was fully redundant with `**/.venv*`. The `[VERIFY AT IMPLEMENTATION]` footnote cited a nonexistent file (`frontend/.env.example`) instead of the real one (`caos/.env.example`). §7.1's new `Dockerfile.backup` introduces a second, entirely unfiltered build context (`caos/deploy/`) this blueprint never addressed. | `scripts/` → `**/scripts`; added `**/coverage`; removed the redundant `**/.venv` line; footnote corrected; new `caos/deploy/.dockerignore` added for the second build context. |
| §2.1 digest-resolution mechanism | Claimed requesting index media types first in `Accept` is what causes Docker Hub to return the multi-arch digest. Tested directly (identical requests with a single-platform-only `Accept`, and with no `Accept` override) against multiple images including a fresh never-queried tag — all returned the identical index digest. Hub appears to serve the index unconditionally for these tags; the stated causal mechanism doesn't hold as tested. | §2.1 corrected: the digest values are unaffected (still right either way), but the causal claim is now flagged as untested-on-other-registries rather than asserted as fact. |
| §2.3 CapEff guarantee | "`cap_drop: ["ALL"]` + non-root ⇒ CapEff all-zero by construction, because there's nothing to drop from a non-root process" — imprecise (a non-root process exec'ing a setcap binary *without* `cap_drop: ["ALL"]` absolutely can gain capabilities, which is what caddy's own baked-in `setcap` bit would do), and stated as an absolute with no acknowledgment that it depends on a non-buggy container runtime (a real, patched CVE — runc CVE-2022-29162 — could under some conditions have smuggled capabilities via the inheritable set despite `cap_drop: ["ALL"]`). | §2.3 corrected to name the actual mechanism (bounding-set intersection in the kernel's exec-time capability formula), note NNP's complementary role, and flag the CVE/runtime-version dependency — practical conclusion (CapEff reads zero on any current Docker Engine) is unchanged. |

Two lower-severity items surfaced but were left as informational rather than requiring a doc change: `backup`'s `image:`→`build:` conversion is a real behavior change (local build vs. pulled tag) worth being aware of at cutover but not a defect; and `app`'s elliptical environment-block presentation (`# ...unchanged from current file...`) technically omitted naming `CAOS_DEMO_SEED` explicitly, now named in §3.3's comment alongside the others.
