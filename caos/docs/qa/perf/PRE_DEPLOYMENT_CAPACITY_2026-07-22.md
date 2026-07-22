# Pre-deployment capacity & fault profile — 2026-07-22 (L25, frozen candidate image)

Closure artifact for **L25 / PD-07** on the immutable candidate.

## Binding

- **Image:** `caos-app:h0-cda106dc` = `sha256:882efb398526…` — the exact H0
  manifest digest (`arm64/linux`, 246 MB; the digest, not a rebuild, is what
  ran).
- **Container contract:** identical to the deploy compose — read-only rootfs,
  `tmpfs /tmp (1g)`, `mem_limit 4g`, `cap_drop ALL`, `no-new-privileges`,
  UID 10001, `WEB_CONCURRENCY=2`, bounded pool (`max_overflow 5`,
  `pool_timeout 30s`), `CAOS_UPLOAD_CONCURRENCY=1`.
- **Stack:** PostgreSQL `pgvector/pgvector:pg18@sha256:12a379b4…` (manifest
  digest), ClamAV `clamav/clamav:1.5@sha256:7f5389cc…` (manifest digest,
  amd64-under-emulation on this arm64 host), production posture (edge secret,
  strong credentials, fail-closed guards all active).
- **Data:** 300 sanitized QA-scale issuers, 600 documents, 2,400 metric facts
  (`seed_qa_scale.py`), **15 registered analyst principals**, 10 pre-load
  engine runs; **510+ engine runs by the end of the steady stage** (run
  creation was itself a load task).
- **Host limitation recorded:** single arm64 workstation runs both stack and
  driver; this is target-*shaped*, not the named target host (G9 remains an
  owner item). Numbers are envelope evidence, not host certification.

## Stage results

| Stage | Profile | Result |
|---|---|---|
| Read gate (pre) | 200 req × c20 per canonical read (health, runs, issuers, CP-1 module) | 0 errors; p95 104–192 ms — **PASS** (<500 ms budget) |
| **Steady 20 min** | 15 authenticated principals, mixed reads + report assembly + NL + run creation | **25,630 requests, 0 unexpected failures, 0 5xx** on real routes; aggregate p50 18 ms / p95 42 ms / p99 61 ms; heaviest lanes: POST /runs p95 58 ms, report p95 38 ms, NL p95 63 ms. (1,203 recorded 404s were a harness path error — the app correctly 404s a nonexistent route; corrected next stage) |
| Upload stage 4 min | same 15 principals + real PDF uploads through ClamAV | **4,806 requests, 0 failures**; upload p50 2.4 s / p95 5.0 s (AV scan + parse, serialized by the documented `CAOS_UPLOAD_CONCURRENCY=1` envelope); concurrent reads held p90 33 ms — uploads do not starve the interactive path |
| Provider fault **429** | mock provider (Anthropic+OpenRouter endpoints) returns 429; 15-user load + chat probes | chat → **502 in 0.0 s** (no retry storm); read gate **PASS during fault** (p95 121 ms); 1,601 load reqs, 0 unexpected failures; health ok after |
| Provider fault **529** | same, 529 | identical fail-fast profile; read gate PASS during fault (p95 160 ms); 1,882 reqs, 0 unexpected |
| Provider fault **hang** | mock never responds; `CAOS_LLM_TIMEOUT_S=15` | chat bounded at **exactly 15.0 s → 502**, all five probes; event loop not starved — read gate PASS **during** the hangs (p95 96 ms); 1,003 reqs, 0 unexpected; health ok |
| Storage fault | `docker restart` of PostgreSQL under 8-user load | 6/411 requests 5xx **inside the restart window** (15:17:15–29), zero after; `/api/health` reported `db:ok` **1 s** after the restart; pools reconnected without intervention |
| Durability | app container restart after all stages | 300/300 issuers, 441 vault files, health ok — DB and vault volumes persist |
| Read gate (post) | repeat of pre-gate | PASS (p95 75–112 ms) |

## Telemetry (5 s samples, 409 samples across all stages)

Max app CPU 193% (of 8 cores ≈ 24% host), max memory **18.7% of the 4 g
limit** (~765 MiB peak, flat 402 MiB in steady state — no growth over 20 min),
max PostgreSQL connections **50** (bounded; no pool exhaustion, no
`pool_timeout` hits in logs), PIDs ≤ 21.

## Defect found and fixed (the reason this loop exists)

**First-boot vault ownership defect:** the app image contains no `/vault`
directory, so a pristine `vault-data` named volume mounts root-owned while
the app runs as UID 10001 on an immutable rootfs with all caps dropped — the
first document upload on a fresh host fails `EACCES → HTTP 500` (212/212
uploads failed in the first upload stage; reproduced 3-line minimal case).
The backup image bakes `/backups` ownership and is unaffected. **Fix:** a
one-shot `vault-init` compose service (same frozen image, `user: 0:0`,
`chown /vault` then exits; app `depends_on: service_completed_successfully`) —
no app-image rebuild; the digest override now pins both services. Verified:
post-fix upload stage ran 4,806 requests / 0 failures. This changes the
**config fingerprint only**; the manifest must be regenerated on the
committed tree (PD-01 fingerprint leg reopens until then).

## Verdict

On the exact frozen image digest under the deploy container contract, 15
authenticated principals with simultaneous heavy operations hold sub-50 ms
interactive p95s with ~5× memory headroom; every injected provider/storage
fault degraded fast, bounded, and isolated, and recovery was self-service.
Remaining PD-07 residue: repeat on the **named** target host once G9 names it.
