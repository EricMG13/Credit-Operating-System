# Integration Seams & Contracts — Audit Report

**Date:** 2026-07-10
**Playbook:** [caos/docs/qa/playbooks/integration-seams.md](../playbooks/integration-seams.md)
**Branch:** `feat/command-center-layout-and-sector-rv-cleanup` @ `1b3b6ac8`
**Base:** `origin/main` @ `6603568e`
**Scope:** Full pass (all 10 gates) + deep dive on the PR delta (33 files, 948+/194− across FE hooks + BE engine modules).

## 1. Gate verdicts

| Gate | Verdict | Evidence |
|------|---------|----------|
| G1 endpoint parity | **PASS** | 0 of 57 deduped FE call targets (from `api.ts`) lack a matching OpenAPI operation. See §2. |
| G2 field parity | **PASS** | 0 confirmed missing/renamed/retyped/nullability-drifted fields across ALL 17 route modules (PR-delta deep dive §3 + full-sweep follow-up §8) — every typed and untyped endpoint checked. Two extra-field cases investigated and closed as verified-fine (§3). |
| G3 no new untyped routes | **PASS** | `routes/query.py`'s 9 dict-return endpoints are pre-existing debt, not new this PR. All 9 field-diffed by hand this run (5 in §3, 4 in §8) since no `response_model` exists for any of them. |
| G4 error envelope | **PASS** | `api.test.tsx` 8/8 green; both pinned shapes (string 409, structured `{message}` 409) trace to real call sites ([runs.py:256](../../../server/routes/runs.py), [runs.py:402-409](../../../server/routes/runs.py)). |
| G5 optional-field discipline | **PASS** | No new required request field on an existing endpoint found in the PR delta. `downside_fragility`'s FE literal-union narrowing verified safe against a closed server-side value ladder (§3). |
| G6 EDGAR fault mapping | **PASS** | Direct fault injection: 429/503/500/URLError/Timeout/malformed-JSON all raise `EdgarError` with the documented message (§4). Route-level `EdgarError`→502 mapping confirmed by static read. |
| G7 LLM degrade matrix | **PASS** | Both venvs green (1298/1298 collected: 1296 passed + 2 skipped on py3.11, 1295 passed + 3 skipped on py3.9). 6 keyless-lane spot probes all matched the documented degrade contract exactly (§5). |
| G8 MCP parity | **PASS** | All 4 EDGAR MCP tools map correctly to their routes — names, defaults, the `vault-url`/`vault-exhibit` alias pair (§6). |
| G9 timeout ladder | **PASS** | `queryOverlay`/`queryAnswer` FE timeout 130s > server `CAOS_LLM_TIMEOUT_S` 120s ✓. MCP httpx 60s > EDGAR `edgar_timeout_s` 30s ✓. No PR-delta change to any timeout value. |
| **G10 degradation honesty** | **FAIL** | 2 confirmed findings — new error/phase signals computed this PR but not wired to any visible UI in 4 of 5 consumer call sites (§7). |

**Net: 9/10 PASS, 1 FAIL (2 confirmed findings).**

## 2. P1 — Endpoint parity (full detail)

Server: 80 OpenAPI operations (~73 schema-visible after excluding 5 `include_in_schema=False` slash-tolerance duplicates + the catch-all `/api/{path}`). FE: 57 deduped `(verb, path)` targets extracted from `api.ts`.

**Playbook defect found and fixed in-place:** the playbook's own P1 discovery command (a same-line `grep`) silently dropped 3 calls whose axios chain splits across lines — `queryOverlay`, `queryAnswer` (the two 130s LLM-lane calls), and `edgarVaultUrl`. Replaced with a DOTALL Python regex over the whole file; verified it now catches all 58 raw call sites (57 after path-template dedup). This is now the canonical P1 command in the playbook.

Result: **0 orphan FE calls** (FE expecting a route the server doesn't have). 21 server operations have no FE caller — all informational, spot-checked:
- 4× catch-all `/api/{path}` (DELETE/HEAD/OPTIONS/PATCH) + `GET /api/health` — infra routes, expected.
- `GET /api/edgar/{search,filings,exhibits}`, `POST /api/edgar/vault-exhibit` — MCP-agent-only surface (the FE only calls `vault-url`, the browse/search UI doesn't exist client-side). By design per [caos/mcp/edgar/server.py](../../../mcp/edgar/server.py).
- `GET /api/autonomy/draft`, `GET /api/digest/daily` — confirmed matches memory: autonomy frontend is unwired (mock UI), consistent with `[[caos-autonomy-cycle]]`.
- `GET /api/issuers/{id}/{cross-default,documents,research-report*}`, `DELETE /api/auth/profile`, `GET /api/sponsors/*` — genuinely no FE caller found (checked broader `src/` grep, not just `api.ts`). Not a G1 failure (server having unused capacity isn't drift), but worth a follow-up look — possibly dead code or a planned-but-unwired feature.

## 3. P2 — Field-level DTO diff (findings)

Checked the PR-touched typed DTOs (`RunSummaryDTO`/`RunListItemDTO`/`ModuleStatusDTO`/`ModuleDetailDTO`/`PortfolioDTO`/`PortfolioRowDTO`) against their OpenAPI schemas, plus all 5 LLM-lane untyped endpoints in `routes/query.py` (`capabilities`, `graph`, `route`, `overlay`, `answer`) against their actual server-side dict-construction code (no `response_model` exists for these, so the schema dump alone can't verify them).

**PortfolioRowDTO / PortfolioDTO** — exact field match against `PortfolioRow`/`PortfolioResponse`. Clean.

**ModuleStatusDTO / ModuleDetailDTO** — exact field match against `ModuleStatus`/`ModuleDetail`. Clean.

**CapabilitiesResult / GraphResult / RouteResult / OverlayResult** — exact field match against the live dict-construction code in `querygraph.py`/`queryoverlay.py`, including both success and every degrade-path return site (e.g. the no-nodes early-exit in `overlay()` at [queryoverlay.py:256-258](../../../server/engine/queryoverlay.py) still populates all 7 FE-required fields). Clean.

**RunSummaryDTO / RunListItemDTO — investigated, closed as verified-fine.** Server schemas carry `analyst_id` and `tokens_used` that the FE mirrors omit. Adversarially checked for a workaround (raw/untyped field access) — none found. The one place that *does* need analyst attribution (`ProfileContent.tsx:920`) correctly uses a *different*, already-complete DTO (`ProfileRun`, which does carry `analyst_id`). Not a finding — these are genuinely unconsumed extra fields, which the playbook's own contract explicitly permits.

**`AnswerResult` — investigated, closed as verified-fine.** Server payload carries `fact_citations` and per-sentence `claim_type`/`fact_ids` that the FE `AnswerResult`/`AnswerSentence` types don't declare. Confirmed zero FE consumption anywhere. Not a finding.

**`downside_fragility` — investigated, closed as verified-fine.** FE narrows the server's `Optional[str]` to a literal union `"HIGH"|"MODERATE"|"LOW"|null` and switches on it in `LiveCoverage.tsx` without an exhaustive default. Traced the sole emitter ([downside.py:87-94](../../../server/engine/downside.py)) — a closed if/elif/else ladder that can only ever produce one of exactly those 3 strings (or the key is absent, which the FE already null-checks). The narrowing is safe today.

## 4. P4 — EDGAR fault-path probe

Direct `urllib.request.urlopen` fault injection against `edgar._get_json` (bypassing the UA kill-switch to reach the real call):

| Fault | Result |
|---|---|
| HTTP 429 | `EdgarError: EDGAR HTTP 429 for ...` |
| HTTP 503 | `EdgarError: EDGAR HTTP 503 for ...` |
| HTTP 500 | `EdgarError: EDGAR HTTP 500 for ...` |
| `URLError` (network) | `EdgarError: EDGAR request failed — network error or timeout.` |
| `TimeoutError` | `EdgarError: EDGAR request failed — network error or timeout.` |
| Malformed JSON body | `EdgarError: EDGAR returned non-JSON for ...` |

All 6 branches match the documented contract exactly. This closes the specific coverage gap the playbook itself calls out (these branches were confirmed untested by the pytest suite as of this run — mocking happens at `_get_json`/`search` level, never at `urlopen`).

## 5. P6 — Keyless degrade matrix probe

All 6 lanes probed with `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`OPENROUTER_API_KEY` blanked:

| Lane | Result | Matches spec |
|---|---|---|
| `POST /api/query/answer` | 503 `"Model lane unavailable — no provider key configured."` | ✓ |
| `POST /api/query/route` | 200 `{"candidates": [], "source": "keyword"}` | ✓ |
| `POST /api/query/overlay` | 503 same message | ✓ |
| `POST /api/chat/issuer` | 200, reply prefixed `"Demo mode — no model key configured."` | ✓ (explicitly labeled) |
| `GET /api/autonomy/draft` | 200, `marking: "AI-GENERATED, UNRATIFIED"`, `export_allowed: false` | ✓ (explicitly labeled) |
| `GET /api/health` | 200, `llm: "demo-fallback"` | ✓ |

## 6. P5 — MCP static parity

All 4 tools in [caos/mcp/edgar/server.py](../../../mcp/edgar/server.py) checked against [routes/edgar.py](../../../server/routes/edgar.py): parameter names/defaults consistent (`edgar_search`→`/search` limit default 10↔10; `edgar_issuer_filings`→`/filings/{cik}` limit default 25↔25; `edgar_fetch_and_vault`→`vault-exhibit`, one of the two valid POST aliases). No orphan calls, no name drift. Client-side has no bound-checking (relies on the server's 422s surfacing through `_api`'s `RuntimeError` wrapper) — confirmed by-design, matches the accepted-risk register.

## 7. P8 — Degradation honesty (2 CONFIRMED findings)

This PR added two new fail-open signals — `usePortfolio().error` (M-6) and `useLiveRun().phase` (M-1/M-2/M-3) — specifically so a genuine backend failure can be told apart from "no data yet." Traced every consumer of both hooks to see whether the new signal actually reaches a rendered element, not just state.

### Finding 1 — `usePortfolio().error` is computed but never rendered

**File:** [caos/frontend/src/lib/engine/usePortfolio.ts](../../../frontend/src/lib/engine/usePortfolio.ts) (hook, correct) / [caos/frontend/src/app/command/page.tsx](../../../frontend/src/app/command/page.tsx), [caos/frontend/src/app/sector-rv/page.tsx](../../../frontend/src/app/sector-rv/page.tsx) (consumers, gap)
**Severity:** HIGH — PM/CIO-facing (Command Center is explicitly the "scans for posture and what changed" surface per CLAUDE.md's Design Context).

**Failure scenario:** `GET /api/portfolio` throws (backend down, network error, 500). `usePortfolio` correctly sets `error: true` and falls back to `EMPTY` (`rows: [], issuerCount: 0, coveredCount: 0, live: false`). Neither `command/page.tsx` nor `sector-rv/page.tsx` reads `.error` anywhere (verified: every `portfolio.*` access in both files is `coveredCount`/`issuerCount`/`rows`/`live` only — grepped exhaustively). Command Center renders `Live Coverage 0/0` with an empty table; Sector-RV silently swaps to the static seeded `PORTFOLIO` mock array. Both render **identically** whether the cause is "backend is down" or "brand-new install, zero issuers covered yet" — and on Sector-RV, the seeded relative-value numbers display with no marking that they're not live. A PM scanning the Command Center during an outage sees an empty board, not an error state.

### Finding 2 — `useLiveRun().phase` is wired correctly on 1 of 3 consumers

**File:** [caos/frontend/src/lib/engine/useLatestRun.ts](../../../frontend/src/lib/engine/useLatestRun.ts) (source of the signal) / [caos/frontend/src/app/pipeline/page.tsx](../../../frontend/src/app/pipeline/page.tsx), [caos/frontend/src/app/reports/page.tsx](../../../frontend/src/app/reports/page.tsx) (gap) vs. [caos/frontend/src/app/deepdive/page.tsx](../../../frontend/src/app/deepdive/page.tsx) (correct reference implementation)
**Severity:** HIGH — Report Studio is the committee-memo export surface; this is squarely the "money is behind a wrong read" case.

**Failure scenario:** Same trigger — the run fetch inside `useLiveRun` throws, `phase` resolves to `"error"` (a real, reachable value per [useLatestRun.ts:63-65](../../../frontend/src/lib/engine/useLatestRun.ts): `"no backend / network error — surface as an error phase (not a silent noRun)"`). `deepdive/page.tsx:217` correctly threads `phase` into `deepDiveCaveatKind()`, which has a dedicated `"error"` render branch ([deepdive/page.tsx:334-338](../../../frontend/src/app/deepdive/page.tsx)) — verified end-to-end wired. **`pipeline/page.tsx` and `reports/page.tsx` never read `.phase` at all** — grepped every field access off `liveRun`/`live` in both files; the only fields read are `.liveEvidence`/`.runId` (for the already-fixed `EvidenceModal` gating). Both pages proceed exactly as if `runId` were null: the analyst sees the "no run yet, all figures are template" state with zero indication that a completed run actually exists and the fetch to retrieve it silently failed. The comment at [useLatestRun.ts:11](../../../frontend/src/lib/engine/useLatestRun.ts) names "the Pipeline page" by name as the intended beneficiary of this exact distinction — confirming this is a gap against the PR's own stated intent, not a hypothetical.

**Both findings share one root cause and one fix shape:** the hooks were correctly extended; 3 of 5 view-layer consumers weren't updated to read the new field. A single follow-up (surface `error`/`phase==="error"` as a visible banner/caveat in `command/page.tsx`, `sector-rv/page.tsx`, `pipeline/page.tsx`, `reports/page.tsx`, mirroring the `deepdive` pattern) closes G10.

## 8. Deep sweep (full-coverage follow-up)

A second pass closed the coverage gaps left open after the PR-delta-focused pass above: all 13 remaining typed route modules (auth, issuers, ingestion, chat, models, portfolios, qa, scenario, research, sector, settings, runs remainder, digest) plus the 4 remaining untyped `query.py` endpoints (catalog, insights, nl, links) were field-diffed schema-vs-FE-mirror, each with an independent adversarial-verify pass on any candidate finding.

**Result: 0 candidate findings across all 14 modules — every one checked out clean.** This substantially raises confidence in G2/G3 beyond the PR-delta subset: the codebase's convention of citing the server source-of-truth file in FE DTO comments (e.g. `// see routes/issuers.py`) is holding in practice, not just in the touched files.

**Dead-route investigation (the 8 no-FE-caller routes from §2), resolved with evidence:**

| Route(s) | Verdict | Evidence |
|---|---|---|
| `GET /api/issuers/{id}/cross-default` | **PLANNED** | Handler `issuers.py:504` (`e00ceeda`). FE consumer exists on unmerged `feat/covenant-frontend` (`3605c999`). `PRE_DEPLOYMENT_PLAN.md:126` explicitly flags this branch as un-deployable pending that merge. |
| `GET /api/sponsors/`, `GET /api/sponsors/{sponsor}` | **PLANNED** | Same story — `sponsors.py` (`e00ceeda`), FE page `app/sponsors/page.tsx` only on `feat/covenant-frontend`. |
| `GET /api/issuers/{id}/documents` | **DEAD** | Handler `issuers.py:162`, pre-CAOS era (`ec7572e7`). `FEATURE_TRACKER.csv:90` claims "Pass" but that's stale-tracker rot — zero real caller anywhere, no plan doc reference. |
| `GET/POST /api/issuers/{id}/research-report[/{report_id}]` | **DEAD-but-fresh** | Handlers `issuers.py:606-729` (`01aa9fcf`), backed by a full module (`research_report.py` + executor + migration `0033` + `test_research_report.py`). Backend-complete, zero FE caller, no explicit unwiring plan — reads as the next Issuer Profile feature to land, not abandoned work. |
| `DELETE /api/auth/profile` | **By-design, no UI yet** | `auth.py:381`, tested self-service GDPR erasure (`test_gdpr_erase.py`). Confirmed **not** a duplicate of `erase_analyst.py` — that CLI is the *operator* path for a departed analyst who can't self-serve; both share `erase_analyst_data()` in `database.py` but serve disjoint callers. No settings-page button calls it yet — a real, intentional feature gap, not dead code. |

None of these are contract-drift findings (nothing here is a case of the FE expecting something the server doesn't provide, or vice versa breaking a live view) — they're coverage/completeness notes for the product roadmap, included here because the playbook's own accepted-risk register needs them to avoid re-flagging as "unexplained" on the next run.

## 9. Accepted-risk register

No new items. All by-design seams matched the playbook's §6 register with no exceptions found this run.
