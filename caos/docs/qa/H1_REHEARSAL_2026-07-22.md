# H1 rehearsal — LAUNCH_PHASE1 §5 on the frozen image — 2026-07-22

Target-shaped local rehearsal on `caos-app@sha256:882efb398526…` under the
deploy container contract (read-only rootfs, cap-drop ALL, 4 g, UID 10001,
two workers, live PostgreSQL + ClamAV at manifest digests). Every §5 box was
executed except the four that require the real edge/host (marked OWNER).
The full checklist repeats verbatim on the named target at H1 proper.

| §5 box | Result today |
|---|---|
| Health | `{"status":"ok","version":"2.0.0",…}`; `llm:"configured"` verified in the live-key posture and `demo-fallback` in the offline posture (both captured) |
| Sign-in domain-restricted | **OWNER** — needs the Google OAuth client + domain on the edge stack |
| Identity gate fails closed | direct app hit without proxy → **401** ✔ |
| Header spoofing blocked | forged `X-Forwarded-Email` without the edge secret → **401** ✔ (Caddy strip leg = OWNER with the edge stack) |
| Edge credential enforced | boot **refuses** missing/weak `EDGE_PROXY_SECRET`; forged identity + no secret → 401 ✔ |
| Container hardening holds | app healthy under read-only rootfs/cap-drop/tmpfs; no stray-write crash-loops across 20+ min load ✔ |
| Demo seed OFF | `CAOS_DEMO_SEED=false`; boot guard additionally **refuses** `true` in production (captured); no demo-seed warning in logs ✔ |
| DB durability | issuer count 300 → restart → 300 ✔ |
| Vault durability | 441 vault files → restart → 441, retrievable ✔ |
| EDGAR lane live | fail-closed without `EDGAR_USER_AGENT` (honest 503-class message), then real SEC filing pointers with it set ✔ |
| Security headers | CSP (per-inline-script sha256 allowlist), `nosniff`, `Referrer-Policy` from the app ✔; HSTS = Caddy edge (OWNER leg) |
| Real run produces evidence | 510 governed runs completed on this stack; CP-1 module payloads + QA gate states served under load ✔ (full click-to-source persona pass = H6 on target) |
| Encryption at rest | **OWNER** — host/volume control (G9) |
| Error monitoring | 404/exception lines visible with method/path/caller in the log stream ✔ |
| Performance smoke | read gates PASS pre/mid-fault/post (p95 42–192 ms vs 500 ms budget); full profile in [perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md](perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md) |
| Backup restore drill | local drill + off-host round trip + **remote-only restore after local deletion** + restore→upgrade→boot rehearsal, all PASS — [audits/data-custody-recovery-2026-07-22.md](audits/data-custody-recovery-2026-07-22.md) |

**H2 companion (one-sweep regression on the candidate):** CI run
[29917558055](https://github.com/EricMG13/Credit-Operating-System/actions/runs/29917558055)
green on `cda106dc` (9 jobs incl. the complete three-browser Playwright lane
against the real server) + dispatched Nightly
[29929720671](https://github.com/EricMG13/Credit-Operating-System/actions/runs/29929720671)
green (golden E2E both lanes, hermetic backend, concept manifests, 300-issuer
load smoke) on the docs-only tip of the same code tree.

**Found & fixed during rehearsal:** the first-boot `/vault` ownership defect
(would 500 every upload on a pristine host) — `vault-init` one-shot compose
service; see the capacity artifact §"Defect found and fixed".
