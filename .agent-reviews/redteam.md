# Red-Team Decision Log

Before committing to an architecture, interface, or rollout plan, run a critic pass here first.

## Current Decision

Adopt this repository-local Markdown log, linked from `AGENTS.md`, as the red-team gate for future architecture, interface, and rollout commitments.

## Protocol

1. Builder records the proposed decision and evidence.
2. Critic argues why it is wrong, with one objection per row.
3. Builder fixes and verifies every high-impact weakness, or marks it accepted with a concrete reason.
4. Critic may reopen any unsupported answer.
5. Stop when no high-impact objection remains, or when the same objections repeat for two rounds without new evidence.
6. Do not paste secrets or confidential raw data into this log; reference files, commands, or sanitized excerpts.

## Objections

| ID | Date | Decision / Plan | Objection | Impact | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| RT-2026-07-02-01 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | A hidden repo-local log is easy to miss, so future architecture/interface/rollout work could bypass the critic loop. | High | Resolved | `AGENTS.md` now links to this file in "Red-team decision gate". |
| RT-2026-07-02-02 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | The first log row put `Accepted` under Impact, so the ledger did not actually record objection impact separately from status. | High | Resolved | This table now has separate `Impact` and `Status` fields with concrete values. |
| RT-2026-07-02-03 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | A decision log can tempt agents to paste sensitive plans, data, or secrets directly into review evidence. | Medium | Resolved | Protocol item 6 requires file/command references or sanitized excerpts instead of secrets/raw confidential data. |
| RT-2026-07-02-04 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | No product architecture, interface, or rollout proposal was supplied yet, so this pass cannot approve any substantive CAOS change. | Low | Accepted | The current decision is only the review gate itself; future concrete proposals must add their own objections. |
| RT-2026-07-04-01 | 2026-07-04 | Query Intelligence Plan (caos/docs/QUERY_INTELLIGENCE_PLAN.md) | Strict numeric grounding will false-drop reformatted figures ("4.25x"→"4.3x") and routinely empty the Desk Brief. | High | Resolved | Plan §Q1 validator: formatting-tolerant compare (separators stripped, 1-dp rounding) + all-cards-dropped degrades to labeled deterministic digest highlights, never a blank/fabricated panel. |
| RT-2026-07-04-02 | 2026-07-04 | Query Intelligence Plan | Brief generation on first page view (HEAVY lane, 10–60s live) could block or wedge the Query page load. | High | Resolved | Plan §Q1 trigger: endpoint always returns the persisted brief instantly; regeneration is a background single-flight task with `refreshing: true`; failures serve the prior brief (deterministic-fallback pattern). |
| RT-2026-07-04-03 | 2026-07-04 | Query Intelligence Plan | Delta/digest evidence ids are not chunk-resolvable, breaking the "every conclusion one click from evidence" mandate for those cards. | Medium | Resolved | Plan §Q1: non-chunk cards click through via their walk deep-link (delta → `metric-trend` for that issuer/metric; digest → the relevant watch walk); figures still pass the numeric gate. |
| RT-2026-07-04-04 | 2026-07-04 | Query Intelligence Plan | Untrusted memo/doc text flows into three new prompts — prompt-injection surface grows. | High | Resolved | Plan §5: `llm_safety` wrap on all untrusted text, closed-set id validation, numeric gate, no tools/writes on any lane, call sites registered in `_REVIEWED_LLM_CALL_SITES`, React-only rendering, AI text excluded from CSV (no CSV-injection path). |
| RT-2026-07-04-05 | 2026-07-04 | Query Intelligence Plan | Run-burst days could churn the data fingerprint and multiply daily LLM spend. | Medium | Resolved | Plan §Q1: regeneration requires BOTH >24h age AND fingerprint change; force is rate-limited; answers cached by (question, fingerprint); keyless deploys make zero calls. |
| RT-2026-07-04-06 | 2026-07-04 | Query Intelligence Plan | Single-flight `asyncio.Lock` and in-process rate limits silently break under Phase-2 multi-worker. | Medium | Accepted | Recorded Phase-1→2 boundary (plan §5) alongside the existing create-run lock/limiter assumptions; Phase-2 needs a DB advisory lock — documented, deliberately not built now. |
| RT-2026-07-04-07 | 2026-07-04 | Query Intelligence Plan | Migrations 0024/0025 may collide with parallel-WIP branches. | Low | Accepted | Renumber at rebase; `test_migrations.py` single-head + `alembic check` guards catch collisions before merge. |
| RT-2026-07-04-08 | 2026-07-04 | Query Intelligence Plan | Scope grows beyond the committed D2 (L) item — could crowd pre-deployment phases. | Medium | Accepted | The expansion is the user's explicit 2026-07-04 request (proactive insights); plan is gated PROPOSED until user approval, phases independently shippable, Q1 alone satisfies the core ask. |
| RT-2026-07-04-09 | 2026-07-04 | Query Intelligence build (Q1/Q2/Q3 IMPLEMENTED) | 2-lens adversarial red-team of the grounding gates: numeric-bypass + citation/injection/fault-isolation. | High | Resolved | Verdict (workflow wf_d67a7ba8): NO shipping defect. Citation gate (closed-set `by_id`), injection defense (wrap_untrusted + UNTRUSTED_RULE + pydantic drops extras), fault isolation (`_regen_inflight` set pre-`create_task`, `finally` reset, bg `except` logs, `/graph` independent), CSV/print exclusion — all confirmed sound. |
| RT-2026-07-04-10 | 2026-07-04 | queryinsights `_validate` numeric pool | Grounding pool appended each cited entry's free `text`, widening the intended closed `numbers` set (a card could ground a figure off a filename year / finding-id numeral). | Medium | Resolved | Fixed in-tree: ground ONLY against `e.numbers` (curated closed set); delta/coverage unaffected, finding/docs become word-only (numeric claim citing only them fails closed). +1 test (`test_validate_grounds_only_against_closed_numbers_not_free_text`). 925 BE pass. |
| RT-2026-07-04-11 | 2026-07-04 | Migrations 0024/0025 | New tables could reproduce the pre-existing `query_overlays` NOT-NULL drift flagged by `alembic check`. | Low | Resolved | Migration nullability aligned to the models (payload/timestamps NOT NULL); both new tables are drift-free (absent from `alembic check` output). Pre-existing systemic drift on other tables is out of scope (documented, fixed in a separate worktree per prior memory). |
| RT-2026-07-04-12 | 2026-07-04 | Covenant-register + sponsor-graph Query walks (shipped, no migration) | Adversarial review of the two new `querygraph` builders: node-id collision, NaN-poisoned headroom, `_append_accepted_links` shape assumptions, synthesis misread. | Medium | Resolved | Verified: hub ids namespaced (`cov:`/`sp:`) vs issuer UUIDs — no collision; headroom gated through `is_finite_number` on BOTH `leverage_covenant_x` and `current_net_leverage` (NaN/inf → cov-lite bucket, no false thin-flag); `_append_accepted_links` only reads `n["id"]`/appends issuer edges — safe on the new node shapes; the generic `concentration` synthesis would misread the register as a "largest cluster", so a capability-aware branch was added (leads with maintenance/cov-lite split + thin-headroom count, never a superlative). 928 BE + 26 FE tests green. |
| RT-2026-07-04-13 | 2026-07-04 | Covenant-register data-quality & scan bound | (a) Latest CP-4C is read regardless of `qa_status`, so a Blocked run's extracted covenant terms can surface as a node; (b) `_COVENANT_SCAN_CAP=2000` silently drops an issuer whose latest CP-4C sits past the newest 2000 module-output rows. | Low | Accepted | (a) Mirrors the existing committee-board / gate-lane boards (no `qa_status` filter) and the view is extraction-caveated ("keyword scan of governing docs"), not a validated-number aggregate like peer medians — lower poisoning stakes; upgrade path = filter to non-Blocked runs if covenant terms ever feed a validated downstream. (b) At the 33-issuer Phase-1 corpus, 2000 rows is ample; the comment names the ceiling; upgrade = SQL window latest-per-issuer if the corpus outgrows it. |
| RT-2026-07-05-01 | 2026-07-05 | Arrange issuer-profile layout rhythm in `ProfileContent.tsx` | A layout pass could accidentally demote the prior Financial trend → Strengths/Weaknesses/Thesis order or turn the dense profile into a decorative card stack. | High | Resolved | Preserved the current panel system and added `profile-distill.test.tsx` order assertions: Financial trend → Thesis → Business → Market. Focused Vitest passed. |
| RT-2026-07-05-02 | 2026-07-05 | Arrange issuer-profile layout rhythm in `ProfileContent.tsx` | The profile also renders inside `IssuerProfileOverlay`, so wider page-level spacing could make the overlay feel cramped or overflow. | Medium | Resolved | Playwright rendered the live profile at 1440px and 900px with `overflowX=false`; local axe scan on `/issuers/profile?id=a71f...0001` returned zero violations. |
| RT-2026-07-06-01 | 2026-07-06 | Command Center layout and query bar refactoring | Removing the Panel shell and predefined starters from the query bar could cause results to overflow or cause sudden layout shifts. | Low | Resolved | Results expand within the flex-col layout of the dashboard; the dashboard handles scroll regions gracefully. |
| RT-2026-07-06-02 | 2026-07-06 | Command Center layout and query bar refactoring | Collapsing the Sector Review Board horizontally could cause text overflow or button clipping in narrow viewports. | Medium | Resolved | Collapsed panel is rendered as a clean 40px wide sidebar with `writingMode: "vertical-lr"`, keeping the toggle button and label visible and readable. |
| RT-2026-07-06-03 | 2026-07-06 | Command Center portfolio view layout polish | Segmented view selector custom styling could break existing keyboard access or focus outline if not styled correctly. | Medium | Resolved | Verified: all buttons inside the segmented control retain focus-ring styling and are fully keyboard accessible. |
| RT-2026-07-06-04 | 2026-07-06 | Command Center SectorBoard grid-cols reduction | Changing SectorBoard grid from 4 columns to 2 columns and moving Add sector inside could overflow the container vertically or break text layouts. | Medium | Resolved | Verified: card size (min-h-110px) layout handles multi-line content gracefully, fits within left-sidebar flex, and Add sector tile follows consistent sizing. |
| RT-2026-07-06-05 | 2026-07-06 | Temporarily disable login in local frontend preview | A login bypass could leak into production or hide broken auth/API behavior. | High | Resolved | Bypass is guarded to non-production in `AuthProvider`; focused `AuthProvider.test.tsx` proves `/me` is not called only when the bypass flag is enabled. |
| RT-2026-07-06-06 | 2026-07-06 | Sector RV useSort getter dependency array fix | Excluding getVal from useSort dependency array could lead to stale sorting if sorting logic changes dynamically. | Low | Resolved | getVal is a pure projection over config.col, and config.col remains in the dependency array. Any sorting criteria change updates config.col, triggering correct re-sorting. |
| RT-2026-07-06-07 | 2026-07-06 | Sector RV CrossSectorHeatmap filter ghosting | Applying opacity-60 to heatmap during active filters could cause low contrast or confuse users about its function. | Medium | Resolved | Opacity is only used as a visual signal, accompanied by an explicit text badge changing from "[derived from universe · not per-sector]" to "[reference universe · filters not applied]". Heatmap remains readable and meets contrast standards. |
| RT-2026-07-06-08 | 2026-07-06 | Sector RV PeerTable row buttons for keyboard navigation | Wrapping the company cell in a button might break table layout, overflow text, or cause focus flow issues. | Medium | Resolved | Button is styled with left-aligned, margin-neutral layout styling (`w-full text-left focus-ring rounded px-1 -mx-1 -my-px outline-none`) that nests clean within table layout without overflow. |
| RT-2026-07-06-09 | 2026-07-06 | Sector RV right-column grid height constraint | Setting min-h-[360px] and h-full on right columns might restrict responsive scaling on very small heights. | Low | Resolved | Breakpoint guard `@[60rem]` restricts the height-stretching behaviour to larger views where it is appropriate, preventing squash on standard desktop grids. |

## Resolved Objections

- RT-2026-07-02-01: Discoverability gap fixed by linking this log from `AGENTS.md`.
- RT-2026-07-02-02: Malformed impact/status evidence fixed by replacing the initial row with explicit `Impact` and `Status` columns.
- RT-2026-07-02-03: Evidence-handling risk fixed by adding a no-secrets protocol rule.

## Accepted Objections

- RT-2026-07-02-04: No substantive CAOS proposal exists in this turn. Accepted because the decision under review is only the gate.

## Critic Reopen Check

Round 2 did not reopen RT-2026-07-02-01 or RT-2026-07-02-02 because the current files contain direct evidence for both fixes. No high-impact objection remains open.

## Stalemate

None.
