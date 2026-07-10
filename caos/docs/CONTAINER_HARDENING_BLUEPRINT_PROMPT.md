# Container-Hardening Blueprint — Fable 5 Prompt

Prompt for a **claude-fable-5** session to produce a container-hardening blueprint
that a later **Opus 4.8** session implements. Deliverable is the blueprint document
only — no builds, no config edits. Recommended effort: `high` (`xhigh` for maximum
per-image security rigor).

---

I'm hardening the container deployment for CAOS, our self-hosted leveraged-finance
credit platform. The production stack is Caddy → oauth2-proxy → FastAPI server →
Postgres, plus a Next.js frontend, run as a Docker Compose stack. I need a
container-hardening blueprint that a later Opus 4.8 session will implement from
directly, so it must be exact enough to build without re-deriving any decision.

Review the repo's Dockerfiles, docker-compose files, and container-build scripts
first, then write a granular Markdown hardening blueprint. The deliverable is the
blueprint document only — don't modify the actual Dockerfiles or compose files.

Goal: every production image runs unprivileged, on a read-only root filesystem,
from a digest-pinned minimal base, containing only what it needs to run — no build
tools, no dev source, no root processes. Cover each image in the stack discretely
(app-built and third-party). For each one, specify:

- Multi-stage build — a build stage separated from a slim runtime stage, so the
  final image carries only pruned production artifacts (`next build` output or
  `--production` deps), on a distroless or minimal base.
- Unprivileged runtime — an explicit non-root `USER`, plus the compose-level
  enforcement (`read_only`, `no-new-privileges`, `cap_drop: [ALL]`, a writable
  `tmpfs` only where the process genuinely needs one).
- Layer-cache order — dependency manifests (`package.json`/lockfile,
  `requirements.txt`/`pyproject`) copied and installed before source, so a source
  edit doesn't bust the dependency layer.
- Digest-pinned base — pinned by `@sha256:` to a real, currently-resolved digest
  for the chosen minimal tag. Look the digest up; never invent one. Note how to
  re-resolve it.

Include the exact multi-stage Dockerfile syntax patterns, the per-image compose
hardening directives, and one comprehensive `.dockerignore` (excluding VCS,
secrets, dev tooling, build caches, tests, and node_modules/venv).

Give each image its own verification section: the exact commands Opus 4.8 will run
after implementing to prove zero-root — `docker inspect` for effective UID, a check
that no process runs as UID 0, a read-only-rootfs confirmation, and
dropped-capability inspection. Don't build anything now; the commands live in the
blueprint for the post-implementation pass.

Check your own work as you build: after drafting each image's section, hand it to a
fresh-context subagent to audit against the zero-root goal — does the design as
written actually yield an unprivileged, read-only, non-root container, and is
anything missing? Fold their findings back in. Ground every completeness claim in
something you read from the repo or a subagent confirmed; if a section is
unverified, say so plainly.

When done, lead with the outcome — which images are covered and whether every one
reaches zero-root by design — then the blueprint.
