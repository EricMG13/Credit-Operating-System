# Full-Codebase Review — 2026-07-23

**Scope:** every application file — 784 total (522 frontend TS/TSX, 235 server Python, 27 frontend scripts) — reviewed via five instruments: fallow 3.8.1 static analysis, rendered axe-core a11y matrix, three-persona adversarial review (25 batches, 100% file coverage), automated sweeps (tsc/eslint/ruff/mypy), and adversarial verification of every significant claim. Tracker with per-file status retained in session scratchpad (`review/tracker.tsv`, 0 pending).

**Verdict: CLEAN with 4 fixes applied.** No CRITICAL defect survived verification anywhere in the codebase. Every "CRIT" raised by a review lens was refuted against the actual type contracts, producers, or platform semantics. The codebase's defensive conventions (is_finite_number gates, safe_div, LLM fault isolation, wrap_untrusted, fail-closed config) held under hostile review in all 71 engine files and all 34 route files.

---

## Fixes applied this review (all verified, uncommitted)

| File | Change | Proof |
|---|---|---|
| [RequireAuth.tsx](../../frontend/src/components/shared/RequireAuth.tsx) | Auth-wall SurfaceState `headingLevel={2}` (both states) — h1→h3 heading-order skip on every route during identity check | axe recheck 0 violations; 11/11 tests |
| [erase_analyst.py](../../server/erase_analyst.py) | Operator CLI now accepts former-email aliases and passes `identity_aliases` (self-service route already did) — pre-rename-stamped documents no longer survive GDPR erasure | 4/4 test_gdpr_erase |
| [nlquery.py](../../server/nlquery.py) | Both LLM lanes (`translate`, `plan`) switched from greedy `{.*}` regex + plain `json.loads` to `first_json_value` (raw_decode + Infinity/NaN rejection) — same bug class previously fixed in council.py | ruff clean; 29/29 test_nlquery |
| [routing.ts](../../frontend/src/lib/query/routing.ts) | 9 keyword rows for the 4 unregistered walks (covenant-register, head-to-head, rating-distribution, portfolio-exposure) per the walk-registration mandate | 23/23 query tests |
| [SectorReviewDossier.tsx](../../frontend/src/components/sector/SectorReviewDossier.tsx) | In-page tabs `aria-current="page"`→`"true"` per repo convention (page = route nav only) | 20/20 sector tests |

## Accessibility

Rendered axe-core matrix (WCAG 2.0/2.1/2.2 A+AA + best-practice, 18 routes, isolated QA stack): **3 moderate violations found → fixed → final full-matrix re-run: 0 violations across all 18 routes.** Per the observation log, the skill's regex scanner was not used (known ~1,169-false-positive failure mode on CAOS); only rendered axe results were treated as authoritative.

## Automated sweeps

- **ruff** (server): 0. **mypy** (105-file gate): 0. **eslint** (src): 0.
- **tsc**: 1 error — pre-existing, owned by in-flight WIP: [profile-distill.test.tsx:95](../../frontend/src/app/issuers/profile/profile-distill.test.tsx) fixture lacks `market_history`, required since the uncommitted api.ts change. Left for the feature author (fixture update, mechanical).
- **fallow full**: 19 dead-code issues, 1.40% duplication (healthy), avg maintainability 89.1, 175 complexity findings (15 critical).
- **fallow security + manual verification**: 4 candidates, **all refuted** (dev-only scripts; static literal headers on a 127.0.0.1 server; fixed-literal path.resolve).

## Adversarial-verification scorecard

Subagent findings were re-verified against code before acceptance — the dominant outcome was refutation, consistent with prior audits ("agents inflate severity"):

- **Refuted (13):** React-escape "XSS" claims (repo has zero `dangerouslySetInnerHTML`); qa.ts `id.slice` "CRIT" (field required on both Pydantic and TS contracts); issuers `sector:=industry` (no sector column — deliberate alias); edgar SSRF (exact-host `==` + userinfo reject + post-redirect recheck already present); migration-0030 revision-id "CRIT" (**do not apply the suggested rename — deployed alembic_version tables hold `fb2488db06e3`; renaming bricks every existing DB**); ControlPlanePanel key collision (per-issuer aggregate rows); revokeObjectURL race (test-pinned idiom); DominantTableRegion stale Symbol (symbol is the identity); pipeline stale-run selection (server documents newest-first); validator exit codes (uncaught throw = exit 1); `ticker||name` falsy chains (server validates non-whitespace names); GraphCanvas href (server-literal `obsidian://` + `quote()`); rails severity fallback (label rendered verbatim).
- **Confirmed and fixed (4):** heading-order, erase-alias gap, nlquery JSON extraction ×2 sites, walk keywords (+ aria-current convention).
- **Confirmed, report-only (below).**

## Open items (report-only, prioritized)

**Short-term**
1. **[user-WIP] tsc break** — profile-distill fixture needs `market_history: []`.
2. **Monitor complexity cluster** — worst in repo: AlertRowActions (cyc 31/cog 59), TriageActions (30/58), WatchRuleEditor, 437-line `usePersistedMonitorController`. Review found no bugs hiding in it, but it is the repo's top refactoring target (fallow hotspots concur).
3. **Dead code cleanup** — 10 unwired `scripts/validate-*`/browser-audit harnesses (not in package.json), `lib/command/data.ts` sim/email constants, `@eslint/eslintrc` devDep. `refreshAlertEvents`/`getAlertEvents` are *intentional* (test-pinned guard-rail / documented compat shim) — suppress in fallow config rather than delete.

**Medium-term**
4. Pipeline dual-poll: both status hooks poll while only one renders — thread an enabled flag through `useLatestRunStatus` (perf only).
5. Deep-dive DIV-grid tables (tabs.tsx) lack table/grid semantics for screen readers — matches the existing open ARIA-grid observation; batch with that work.
6. xlsx_safety: external-relationship scan covers `.rels` only — consider scanning cell comments for external links.

**Fragile-assumption register** (no action required; watch on refactor): LIVE_MODULES allowlist silently filters unknown modules; projection-array length coupling (scenarios.ts); AUTH_ENTRY_POST_PATHS discipline; surface_state magic keys; frozenReviewedSectionCount unvalidated vs section count; migration downgrade-refusal↔feature-flag coupling; modal focusables selector narrower than row-action-keyboard's; market_history schema-drift silently degrades chart.

## Positives worth keeping

- Engine money-math discipline is real, not aspirational: every CP-1-derived divide verified gated (`is_finite_number`/`safe_div`/`_finite`), relative tolerances use `abs()`, MAD guards, overflow-to-None semantics — 71/71 files clean under hostile review.
- LLM injection posture: `wrap_untrusted` + `UNTRUSTED_RULE` on all document-fed lanes, `safe_chunk_id` fabricated-citation containment, `loads_finite` non-finite rejection (nlquery was the last regex holdout — now closed).
- Trust-boundary quality: csv/xlsx injection escapes verified complete with tests, path-safe ingestion, exact-host EDGAR SSRF guard, constant-time signature compares, fail-closed production guards, cross-analyst workspace cache isolation is *tested*.
- Test posture: contract types match server Pydantic models field-for-field everywhere checked; behavior-focused tests pinned several idioms this review would otherwise have "fixed" into regressions.

## Regression proof

- Full frontend vitest suite: **1,832 passed, 0 failed.**
- Full server pytest suite (sequential after vitest per the no-overlap rule; MUST run from repo root — `test_sec_audit_tool` imports root-level `run_sec_audit.py`): **2,925 passed, 38 skipped (offline mode), 1 initial failure = the erase_analyst CLI test's mock predating the new alias parameter — mock updated ([test_coverage_edges.py](../../tests/server/test_coverage_edges.py)), now green (5/5 targeted rerun).**
- Final full-matrix axe: **0 violations, 18/18 routes, 0 scan errors.**
- eslint on all edited frontend files: clean. ruff on all edited server files: clean.

*Method note: five skills drove this review (a11y-audit, adversarial-reviewer, audit, debug-skill, fallow). dap interactive debugging was loaded but not needed — no confirmed defect required live-state inspection; all claims resolved by contract verification and targeted tests.*
