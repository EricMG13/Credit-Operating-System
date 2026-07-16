# CAOS Triage Code Review — 2026-07-16

> **Remediation addendum (same day, after `/outstanding` → "fix"):** every finding
> below is now **fixed in the working tree** with a fails-pre-fix test per item —
> P0 (Altman constant dropped; contract/golden/validation values re-captured by
> execution: VSAT 1.22 grey, FUN −2.02 distress), both P1s (verb-delta re-point;
> word-form/de-glyphed constraint direction + the sibling bare-`>` inversion in
> `_status`), all five P2s (total-leverage lookbehind; par-weighted scenario
> recovery; textscan currency gate; querygraph fact-unit rendering; RV modifier
> bucketing), and the P3 tail (energy same-clause, refinancing guard, tranche
> re-sort, hedge display, zero-bid dual-site, RV finite gate, sector 0.75
> threshold, `round3` finite guard). Verification: full offline server suite +
> frontend vitest green (counts in the session log), repo ruff clean, complexity
> delta gate passed (no new C901, none worsened). The findings text below is
> preserved as written at review time.

> Principal Code Reviewer run per `caos/docs/TRIAGE_REVIEW_BRIEF.md`. Branch `codex/112`,
> HEAD `50d615d4` (one commit past the brief's `8d746701` — the user landed a conftest
> static-export fix mid-brief). Working tree untouched except this report and
> `caos/docs/.triage-notes.md`; the user's WIP (`caos/frontend/src/lib/api.ts`,
> `caos/frontend/src/lib/api-auth-loss.test.ts`, `.agent-reviews/redteam.md`) was never
> staged, stashed, or checked out.

## Summary

**The headline: one P0, two P1s — all three in code an analyst reads today, and none
of them new code's fault alone.** The engine's celebrated money-math discipline
(finite gates, None-vs-0 degrade, output-overflow checks) genuinely holds across
~20 deep-read money files; what gets through is *semantically wrong finite numbers*
and *records that say "fixed" when the code says otherwise*:

- **[P0] The Altman Z″ distress zone is wrong on every scored issuer** — the engine
  adds the EM-Score +3.25 constant but zones on the no-constant 2.6/1.1 cutoffs, so
  the golden names themselves misread (Six Flags renders "grey" where the correct
  no-constant score ≈ −2.02 is deep **distress**; Viasat renders "safe" where ≈ 1.22
  is "grey"). This is the 07-10 audit's ENG-1 CRITICAL — recorded as remediated in
  that session's notes, but **the fix was never committed**: two commits in the
  file's whole history, and the tests + goldens + a human-validation doc all pin the
  wrong pairing. The most important sentence in this report for the Head of Research:
  *a defect can be "found", "fixed", validated, golden-pinned — and still be live.*
- **[P1] The keyless reported-disclosure CP-1 still publishes a delta as the level**
  for verb-only comparatives ("Adjusted EBITDA **rose** £12.3m to £963.4m" → EBITDA
  = 12.3, ~78× low; proven by execution) — a residual of the known ENG-2 class whose
  fix covers only "from/by" phrasings; with an LTM/FY token nearby it collapses the
  CP-3B recovery EV exactly as the original CRITICAL did.
- **[P1] A word-form minimum constraint is parsed as a maximum** ("Min 90.0% 1st
  lien" → `<=`), so a breached hard floor renders **Watch +5.00 headroom** at 85%
  and — perversely — **Pass +15.00** at 75%; the fresh-context verifier proved a
  second trigger (cp1252 CSV de-glyphs `≥` into `?`), which defeats the "real inputs
  use glyphs" defense entirely. Compliance monitor, Portfolio Lab, and the frozen
  committee snapshot all repeat it.

Below those: **five P2s** (a "total leverage" basis gap on the same reported lane; a
scenario-lens NAV-loss that applies the *unweighted stack-average* recovery to a
single-tranche position; currency-blind `$M` labeling in the shared text scanner and
in the query graph's head-to-head/trend surfaces — GBP/EUR magnitudes rendered as
dollars, display-only since every ranking lane is ratio-based; and an RV screen that
mis-buckets S&P `BB−`/`CCC−` one notch senior, overstating DM pickup for exactly the
weakest names), and **nine P3s** with proofs. The clean news is real and earned:
routes delegate money math to guarded engine helpers everywhere probed; the new
Model Builder v2 / workbook / market-import stack is the most disciplined code in
the repo (Decimal core, tie-outs at 1e-9, junk-to-None parsing); the AI query lanes
ground every numeral fail-closed; the frontend formatters render non-finite as a
dash without exception found.

**Four Adversarial Rewrite Tournaments ran** (budget floor of 4–8): `compute_exposure`
and `_amount` and `_annual_series` crowned Readability challengers — each verified by
this Orchestrator on a scratch copy with differential fuzz (412 / 70 / 2,502 cases,
zero mismatches), full test runs with actual output quoted, and measured C901
reductions (21→9, 12→7, and a legitimate `noqa` retirement to 9+4) — while
`propagate` produced a reasoned **Incumbent hold** after the Arbiter caught one
challenger's *undeclared* guard-semantics drift. No winner moved a golden number.

**What to do first:** fix the Altman pairing (drop the +3.25; update
`test_distress.py`, both goldens' values *and* zones, and `VIASAT_VALIDATION.md`
together), then the constraint-operator parser (word-form + de-glyphed minimums),
then the reported-lane verb-delta re-point — all three are small, precisely located,
and carry their failing-test recipes in the findings below.

## Method & coverage

**Stage 0 — re-index.** The GitNexus index was rebuilt at HEAD `50d615d4`. The `--pdg`
decision: **run it** — but the first `--pdg` build segfaulted every reader (exit 139 on
`cypher`/MCP/eval-server; a stale orphaned WAL fragment `lbug.wal.missing-shadow.*` was
poisoning LadybugDB recovery). A `gitnexus clean --force` + zero-state rebuild **with
`--pdg`** produced a healthy 74,945-node index. The taint layer (`explain`) is present
but exposed only over MCP, which stayed down after the mid-session DB swap; the CLI has
no `explain` command. **Taint enumeration therefore did not inform this review — the
security dimension is graph-blind and was reviewed by file reading only.** Symbol
graph, `impact`, `cypher`, and `query` were used throughout via the CLI.

**Stage 1 — taxonomy.** Path-prefix partition per §3B, refined into nine groups and
applied to the full `git ls-files` census (2,696 tracked files, each in exactly one
group):

| Group | Contents | Files | Depth |
|---|---|---|---|
| G1 Engine | `caos/server/engine/` | 71 | **Deep** (primary read, this reviewer) |
| G2 Routes | `caos/server/routes/` | 32 | Deep |
| G3 Server core | `caos/server/` excl. engine/routes | 120 | Deep on money/trust paths |
| G4 Frontend data | `caos/frontend/src/lib/` | 155 | Medium (number formatting/adapters) |
| G5 Frontend render | rest of `caos/frontend/` | 405 | Medium |
| G6 Tests | `caos/tests/` | 203 | Sweep (wrong-blessing risk) |
| G7 Corpus | `Modular OS/` | 483 | Sweep |
| G8 Ops | `caos/deploy`, `caos/scripts`, `.github`, docker | 73 | Sweep |
| G9 Docs & meta | `caos/docs`, root docs, `.agents`, `.claude`, `.goal`, skills | 1,154 | Sweep |

**Working-tree integrity — one incident, detected and repaired.** Late in the run,
`git status` showed `CLAUDE.md` and three `.claude/skills/gitnexus/*` files modified
by the GitNexus clean/rebuild cycle (the recovery from the segfaulting index): the
rebuild replaced the user's hand-written conditional GitNexus section with
auto-generated text (despite `--skip-agents-md`) and regenerated three skill files
from an older template. All four were **attributed by diff content (pure
machine-generated changes, no user content present) and restored to HEAD byte-for-byte**
by writing `git show HEAD:<file>` back — no `git checkout`, no staging, nothing else
touched. The user's parallel WIP was never modified: their live feature work (~45
files including `runner.py`, `routes/qa.py`, GovernancePanel and QA-findings frontend
wiring, `outstanding/SKILL.md`, `observation-log.md`) accumulated in the tree *during*
this review and was left strictly alone; all findings in this report were verified
against HEAD `50d615d4` content, not the moving working tree.

**Triage weighting.** The engine was read at full depth by this reviewer directly
(~20 money-math files in full: periods, metrics, synth, grounding, reported_cp1,
edgar_cp1, capstructure, distress, earnings, macro, downside, liquidity, textscan,
adjusted, covenants extraction core, scenario_network, runner core blocks,
model_engine_v2, anomaly, portfolio), with the post-audit git delta
(`088db6e6..HEAD`, +3,747 engine insertions) used to prioritize what the prior audits
had never seen. Findings below were **proven by executing the real modules** against
trigger inputs where falsifiable claims are made (commands + outputs quoted in each
finding).

**Self-check protocol (§6) execution.** One fresh-context adversarial verifier ran
per finding-bearing group — G1 (11 PASS / 2 report-level REVISEs), G2 (PASS + one
wording nit), G3 (4 PASS / 1 REVISE, and it *strengthened* the P1 with the cp1252
trigger), G4/G5 (PASS, upgraded the P3 from latent to live) — and **every REVISE was
reconciled in place before this report was declared done** (the reconciliation edits
are in the findings above). The sweep groups G6–G9 carried no dedicated verifier:
they contain no standalone findings to verify (G6's only item is a rider on the P0,
independently re-verified by the G1 verifier; G7–G9 report clean sweeps whose two
factual claims — zero corpus Altman references, the CP-2B no-default-magnitude note —
were grep-verified directly this session).

## Group: G1 Engine (`caos/server/engine/` — 71 files, deep)

**Outcome first:** the engine's money-math discipline is real and holds almost
everywhere — every previously-recorded CRITICAL/MATERIAL engine fix except one was
verified present in the live code. The exceptions that matter: **one recorded-as-fixed
CRITICAL that was never actually fixed** (Altman zones — every scored issuer reads
~3.25 too safe), **one live P1 residual** of the known delta-as-level bug class on the
keyless reported lane, and a short tail of P2/P3s concentrated in the newest,
never-audited code (`scenario_network.py`, `textscan.py` labeling).

### [P0] Distress score — Altman Z″ adds the EM constant but zones on no-constant cutoffs (recorded fixed; never fixed)
- **Finding (1 sentence):** `altman_z_double_prime` computes `3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4` (the EM-Score variant) while `zone_for` classifies on `SAFE_CUTOFF = 2.6` / `DISTRESS_CUTOFF = 1.1` — the published zones for Z″ *without* the +3.25 constant — so every scored issuer's zone is shifted ~3.25 toward "safe" and most stressed LBO balance sheets read "safe"/"grey".
- **Files / blocks:** `caos/server/engine/distress.py` → `altman_z_double_prime`, `zone_for`, `SAFE_CUTOFF`/`DISTRESS_CUTOFF`; wrong legend repeated in `caos/server/engine/metrics.py` → `METRIC_CATALOG` (altman_z description) and `caos/server/engine/edgar_cp1.py` → `_claims` (the C-EDG-Z claim text "below 1.1 distress, above 2.6 safe").
- **Analyst impact (1 sentence):** the committee-facing distress signal (claim text, metric store `altman_z` headline fact, profile zone coloring) is systematically optimistic on every EDGAR-scored issuer — an issuer with a genuinely distressed balance sheet (true no-constant Z″ ≈ 0.3) renders as z ≈ 3.5 "safe".
- **Blast radius (from `impact`):** direct caller `edgar_cp1._altman_distress` → `build_cp1_payload` → CP-1 `runtime_output["distress"]` → `metrics.extract_facts` (altman_z headline MetricFact, cross-issuer queryable) → profile/query surfaces. 3 impacted symbols across 3 depths, plus the claim text and catalog legend.
- **Novelty:** **known — and still open at HEAD despite a remediation trail.** This is CONFIDENCE_AUDIT_2026-07-10 **ENG-1 (CONFIRMED BUG, CRITICAL)**; the audit document itself lists it "**Still present on main**" at publication. The only "fixed" record is the 07-10 session's own working notes ("all fixed w/ fails-pre-fix tests — **NOT committed**, entangled with parallel user WIP"); `git log --follow` on `distress.py` shows exactly two commits ever (creation `e85e8f41` + NaN guards `45054ba5`) — **no remediation commit exists on any reachable branch**, and `caos/tests/server/test_distress.py` → `test_zones`/`test_altman_z_double_prime_value` pin the buggy pairing (3.25-based 5.67 → "safe" on 2.6/1.1 zones). Re-filed per the brief's own rule: a matrix (or a session note) is not proof of a fix; the code is. Independently re-verified by a fresh-context verifier this session.
- **Proof:** inputs CA=CL=500, TA=2000, RE=−100, EBIT=100, TL=1800, BE=200 → code returns `(3.54, "safe")`; the no-constant Z″ for the same inputs is 0.29 → "distress". On the golden names themselves: FUN (Six Flags) golden `altman_z = 1.23` renders "grey" today but is ≈ −2.02 → **"distress"** under the no-constant Z″; VSAT golden `4.47` renders "safe" but is ≈ 1.22 → "grey". **The golden pins both the value and the zone** (`test_golden_cp1.py` asserts `altman_z` *and* `zone`), and `caos/docs/VIASAT_VALIDATION.md` records a human validation of "Altman Z'' 4.47 (safe)" — i.e. the wrong pairing has been blessed downstream, so any fix must update the goldens, the zone strings, `test_distress.py`, and the validation doc together. Fix directions: (a) drop the +3.25 (the published Z″ definition; moves golden values and zones), or (b) keep the EM score and re-map zones — but no published safe/grey/distress zones exist for the EM variant, so (a) is the defensible fix. Either way the pinning tests are characterization tests of the defect (grep confirms zero Altman references in `Modular OS/`, so no corpus spec authorizes the current pairing).

### [P1] Reported CP-1 — verb-only "rose/declined £X to £Y" still publishes the delta as the level
- **Finding (1 sentence):** `_amount`'s comparative-phrase re-point handles "from £X … to £Y" and "by £X … to £Y" but not bare movement verbs, so "Adjusted EBITDA rose £12.3 million to £963.4 million" publishes **12.3** as the EBITDA level (78× low) — the same consequence class as the recorded ENG-2 CRITICAL, with a phrasing its fix does not cover.
- **Files / blocks:** `caos/server/engine/reported_cp1.py` → `_amount` (the `\b(?:from|by)\s*$` lookback), `_EBITDA_AMOUNT`, `_TOTAL_REVENUE_AMOUNT`.
- **Analyst impact (1 sentence):** on the keyless reported-disclosure lane (non-EDGAR issuers — the VMO2-class credits) the CP-1 claim text, the `adj_ebitda` MetricFact (headline, cross-issuer store), and the issuer profile all show a delta as the level; when the phrase carries an LTM/FY token ("LTM Adjusted EBITDA rose £12.3m to £963.4m") the mis-scaled figure also passes `latest_annual` into `capstructure._distressed_ev`, collapsing CP-3B's EV (5 × 12.3 ≈ £62M vs ≈ £4.8bn) and every tranche recovery percentage.
- **Blast radius:** `_amount` → `extract_reported_metrics` → `build_reported_cp1_payload` → runner CP-1 → `metrics.extract_facts` + CP-2E/2F/3B consumers (via `latest_annual`, annual-labeled periods only). Bare-period captures ("Reported") stop at the store/claims; annual-labeled ones reach the EV path.
- **Novelty:** residual of CONFIDENCE_AUDIT_2026-07-10 **ENG-2** (recorded "partial-fix"). What is new: the fix's trigger set (`from|by`) is a proper subset of real earnings-release phrasing; "rose/grew/declined/up/fell £X to £Y" are routine UK-release constructions and all bypass the re-point.
- **Proof (executed this session):** `.venv311/bin/python -c "...reported_cp1 import..."` →
  `_amount(_EBITDA_AMOUNT, 'Adjusted EBITDA rose £12.3 million to £963.4 million …')` returned `(12.3, '£', 'Reported')`;
  the fixed "increased by" phrasing correctly returned `(963.4, …)`; "declined £9.2 million to £954.2 million" returned `(9.2, …)`.
  Fix shape: treat "<verb> £X … to £Y" like from/by (re-point on the `to`-amount signal alone), or require the anchored amount not be immediately followed by `to £Y` within the clause.

### [P2] Reported CP-1 — "total leverage" published as net leverage (basis lookbehind gap)
- **Finding (1 sentence):** the fallback leverage pattern's basis lookbehinds reject `gross/secured/senior/lien` but not **`total`**, so a chunk disclosing only "Total leverage ratio was 6.8x" publishes 6.8 into `net_leverage_adj_ltm`.
- **Files / blocks:** `caos/server/engine/reported_cp1.py` → `_LEVERAGE_PATTERNS` (second pattern's lookbehind set), `_leverage`.
- **Analyst impact (1 sentence):** a gross-basis (total) leverage renders as the issuer's net leverage — overstated for any cash-carrying issuer — in the CP-1 claim, the headline net_leverage MetricFact, and every downstream leverage consumer (CP-2B fragility, CP-4C headroom).
- **Blast radius:** same lane as P1 (reported-disclosure CP-1 → store → CP-2B/2F/4C). Mitigated when the same most-recent chunk also carries a "net (total) debt to EBITDA" phrasing — pattern 1 wins then; the exposure is a summary chunk stating only the total measure.
- **Novelty:** residual of CONFIDENCE_AUDIT_2026-07-10 **ENG-5** (whose fix added the gross/secured/senior/lien lookbehinds). New: `total` is missing from the exclusion set while being a common gross-basis label in sponsor/lender decks.
- **Proof (executed this session):** `_leverage('Total leverage ratio was 6.8x at quarter end.')` → `6.8`; `_leverage('Gross leverage ratio was 6.8x …')` → `None`. Fix: add `(?<!total\s)` (and arguably `(?<!first\s)`) or require an explicit `net` token when a basis qualifier is present.

### [P2] Scenario network — portfolio NAV-loss node applies the *unweighted mean of all tranche recoveries* to a single-tranche position
- **Finding (1 sentence):** `propagate`'s recovery node averages `recovery_pct` equally across every tranche in the stack and the portfolio node then computes `held_pct × (1 − that mean/100)`, so a CLO position that is in fact one specific tranche (loans-only book → the 1L term loan) is assigned the stack-average recovery — a $10M subordinated stub's 0% weighs the same as the $2bn first lien's 100%.
- **Files / blocks:** `caos/server/engine/scenario_network.py` → `propagate` (recovery node's `sum(finite_recoveries)/len(...)`, portfolio node), consumed by `caos/server/routes/scenario.py` → `propagate_scenario`.
- **Analyst impact (1 sentence):** the scenario lens's "X% NAV loss at stressed recovery" is systematically overstated for senior-held positions (and understated if the book ever held juniors) — e.g. 1L recovers 100% under the stress but a junior-dragged mean of 50% doubles the displayed NAV loss.
- **Blast radius (from `impact`):** one direct caller (`routes/scenario.py` handler) → Model Builder scenario UI. Leaf-adjacent; no store writes.
- **Novelty:** new — `scenario_network.py` post-dates every §3C audit (created in the `ed4ff867` wave; +211 lines, never reviewed).
- **Proof:** construct CP-3B tranches `[1L $2,000M, SUB $10M]` with stressed EV ≥ $2,010M → per-tranche recoveries 100%/100%… use EV $1,000M → 1L 50%, SUB 0% → node mean 25% vs position-correct 50% for a 1L holding; portfolio node then doubles the NAV-loss. The label ("average sized-tranche recovery") discloses the mean but the *portfolio* node's basis string ("held % NAV × (1 − stressed recovery)") does not say the recovery is not the position's. Fix shape: weight by claim size, or better, use the recovery of the tranche(s) the position actually holds (ranking is on the position rows).

### [P2] Textscan — `$` optional in the amount regex: £/€ figures recorded under `$M` fields
- **Finding (1 sentence):** `_AMOUNT` makes the currency symbol optional and captures only the number+scale, so `amount_musd("The £1,250 million revolving credit facility…")` returns `1250.0` into fields named/rendered `*_musd` — GBP/EUR magnitudes silently labeled as USD millions across the tranche register, liquidity sources, and sponsor scans.
- **Files / blocks:** `caos/server/engine/textscan.py` → `_AMOUNT`, `amount_musd`; consumers `capstructure.scan_tranches`, `liquidity.scan_liquidity` (also the covenant/sponsor scanners that reuse `amount_musd`).
- **Analyst impact (1 sentence):** for a non-USD issuer every absolute figure in CP-3B/CP-2E ("$963M EBITDA-based EV", "disclosed liquidity $1,250M") displays the right number under the wrong currency; ratios (recovery %, % of structure, runway months) cancel the error, so this is a **label** defect on absolute magnitudes, not a ratio defect.
- **Blast radius (from `impact`):** 9 impacted symbols (capstructure/liquidity/sponsor scan paths → module payloads → UI).
- **Novelty:** new. Adjacent-but-distinct from the accepted-by-design "two $M-conversion points" note (EC inv-G, which is about *where* scale conversion happens) and from ENG-14's "currency-first-match" (reported_cp1 lane). `reported_cp1` itself handles currency correctly (captures the symbol, stamps `runtime_output["currency"]`, and `metrics.extract_facts` re-labels the unit `GBPM` — the fix pattern already exists in-repo); textscan never adopted it.
- **Proof (executed this session):** `amount_musd('The £1,250 million revolving credit facility remains undrawn.', rcf_pattern)` → `1250.0`. Fix shape: capture the symbol, either propagate a currency alongside the value (reported_cp1 pattern) or reject non-`$` amounts into the qualitative-hit path with a limitation flag.

### [P2] Query graph — head-to-head renders every money fact under the catalog's `$M`, discarding the fact's stored currency unit
- **Finding (1 sentence):** `_collapse_headline` keeps only `fact.value` (dropping `MetricFact.unit`) and `_h2h_metric_sub` formats with `CATALOG_BY_KEY[key].unit` — `$M` for revenue/adj_ebitda — so a fact minted `GBPM`/`EURM` (exactly what `metrics.extract_facts` produces for a non-USD reported-disclosure CP-1, per its own #AA4 fix) renders as dollars in the two-issuer comparison.
- **Files / blocks:** `caos/server/engine/querygraph.py` → `_collapse_headline`, `_h2h_metric_sub`, `_fmt_metric`, `_head_to_head`.
- **Analyst impact (1 sentence):** "Revenue: $1,000M vs $963M" for a USD-vs-GBP pair reads as near-parity when £963M ≈ $1,220M — a wrong relative-size read in the exact surface built for comparing two names; the H2H caveat discloses reported-vs-modeled **basis** mixing but never currency.
- **Blast radius:** `_head_to_head` (Ask/Query graph C7 walk) and `_trend` (same catalog-unit override on the period series, single-issuer). Rankings are unaffected — every cross-issuer *ranking* lane (`peers._BENCH`, `metricengine._KPI_KEYS`, anomaly `_KPI_KEYS`) ranks ratios/scores only (verified this session), so the mislabel is display-side.
- **Novelty:** new. The unit-minting side was fixed (#AA4: `money_unit = f"{cur}M"`); the read side never adopted it — the stored unit dies in `_collapse_headline`.
- **Proof:** seed two issuers, one with a `GBPM` revenue fact (reported-disclosure CP-1 for a UK filer), ask the head-to-head question, and read the sub-labels: both render `$…M`. Fix shape: collapse to `(value, unit)` and format with the fact's unit, falling back to catalog only when absent.

### [P3] Query graph — trend node labels carry the same catalog-unit override
- **Finding:** `_trend` renders each period node `sub=f"{v:g}{md.unit}"` with the catalog unit (also yielding the malformed "963.4$M" ordering), so a GBP series renders as dollars.
- **Files / blocks:** `caos/server/engine/querygraph.py` → `_trend`.
- **Analyst impact:** single-issuer trend mislabels currency (magnitudes/shape correct).
- **Blast radius:** trend walk only. **Novelty:** new (same class as the H2H finding). **Proof:** same seeding, trend question on the GBP issuer.

### [P3] Metric extraction — energy-cost % misattribution by chunk-level co-occurrence
- **Finding:** `derive_energy_cost_pct` accepts the first chunk that merely *contains* an energy keyword anywhere and a "N% of cost of goods sold" anywhere else in the same chunk, so "raw materials represent 40% of cost of goods sold… fuel surcharges…" lands `energy_cost_pct = 40` (headline MetricFact).
- **Files / blocks:** `caos/server/engine/metrics.py` → `derive_energy_cost_pct` (`_ENERGY_CHECK` + `_COST_PCT_RE` independence).
- **Analyst impact:** the cost-exposure metric can carry a non-energy cost share; feeds CP-2 cost structure and cross-issuer energy-exposure ranking.
- **Blast radius:** `coststructure` CP-2 lane → `extract_cost_facts` MetricFact.
- **Novelty:** new (ENG-14/S1 covered only the missing 0–100 clamp, which is now present).
- **Proof:** call `derive_energy_cost_pct([("c1","doc","Raw materials represent 40% of cost of goods sold. Fuel surcharges apply to freight.")])` → returns `(40.0, "c1", "doc")`. Fix: require the % match and the energy keyword within the same sentence/clause (textscan's `_clause_bounds` already exists for exactly this).

### [P3] Refinancing — the one CP-1 consumer without the None/non-dict interior guard
- **Finding:** `synthesize_refinancing` reads `(cp1.runtime_output or {}).get("normalized_financials", {}).get(...)` — the `{}` default does not apply when the key is present with `null`, and a narrative-string value raises `AttributeError` on the chained `.get`.
- **Files / blocks:** `caos/server/engine/refinancing.py` → `synthesize_refinancing`.
- **Analyst impact:** on a live-LLM CP-1 emitting a null/narrative `normalized_financials` (an anticipated shape — `test_extract_facts_tolerates_narrative_normalized_financials` exists precisely for it), CP-4B blocks with "unexpected synth error" instead of degrading to its no-leverage Insufficient path.
- **Blast radius:** contained — `runner._attempt_synth`'s broad except converts the raise to a per-module Blocked gate; the run survives (this is why it is P3, not the BE3-class P1 it resembles).
- **Novelty:** new — the BE3-family sweep hardened `adjusted`/`metrics`/`covenants`/`earnings`/`peers`/`planner` but never touched `refinancing.py` (not in the BE3-6 list).
- **Proof:** `synthesize_refinancing` with `cp1.runtime_output = {"normalized_financials": "not disclosed"}` raises AttributeError (module → Blocked). Fix: `_as_dict`/`or {}` like every sibling.

### [P3] Scenario network — waterfall input ordering assumed, not enforced
- **Finding:** `recovery_waterfall` (itertools.groupby) requires rank-sorted rows; `capstructure.scan_tranches` sorts, but `scenario_network._validated_tranches` re-validates persisted payload rows without re-sorting — a future producer or a hand-edited payload with ranks out of order silently mis-runs the waterfall (a rank-0 group after rank-1 receives leftover EV as if junior).
- **Files / blocks:** `caos/server/engine/scenario_network.py` → `_validated_tranches`; `caos/server/engine/capstructure.py` → `recovery_waterfall` (the groupby contract).
- **Analyst impact:** none today (the only producer sorts); wrong recovery percentages if the input contract is ever broken — the failure is silent.
- **Blast radius:** scenario route only. **Novelty:** new (file post-dates audits).
- **Proof:** `recovery_waterfall([{rank1...},{rank0...}], ev)` distributes EV to the rank-1 group first. Fix: one `sorted(..., key=seniority_rank)` in `_validated_tranches`.

### Group verdict — the rest of G1 is clean

Verified-fixed (live code read this session, not trusted from the matrices): ENG-3
(`earnings._yoy` divides by `abs(prev)` + output-inf safe_div), ENG-6
(`latest_annual` gating in `capstructure._distressed_ev`, `macro`, `liquidity`),
ENG-7 (narrow current-debt tags + `_net_debt_composition_flags`), ENG-8 (`eb > 0`),
ENG-9/10 (clause-bounded `amount_musd` binding), ENG-11 (1.0–12.0 clamp on both
covenant lanes + per-chunk `all_grounded`), ENG-12 (net-basis disclosure), ENG-13
(`lev <= 0` → Insufficient), ENG-15-adjacent executor lease work, ENG-16 (defensive
`_as_dict`/`str()` hardening at every projection call site), BE1-1/BE2-x/BE3-x
(all named sites), QA-4 (`_persist_cp5c` empty-council path), output-inf class
(`safe_div/safe_mul/safe_add` re-check their *results*; `leverage_plausibility_finding`
deliberately fires-on-overflow). `portfolio.py` (+582 lines, the largest post-audit
delta) is disciplined throughout — checked_* wrappers, per-position degrade notes,
distribution caps, and a runnable `__main__` self-check. `model_engine_v2.py` is
rigorous (Decimal core, bounded inputs, PIK trapezoid algebra self-consistent, tie-out
gaps). `anomaly.py`, `metricengine.py`, `metricfactlane.py`, `peers.py`, `relval.py`,
`portfoliofit.py`, `coststructure.py`, `budget.py` — clean (each function-checked for
the finite-gate/None-vs-0 invariants). LLM lanes (`synth.py`, `llm_safety`,
`covenants` LLM path, `adjusted` LLM path) all fail closed with per-chunk numeric
grounding. Query lanes (`querygraph`, `queryanswer`, `queryinsights`, `queryoverlay`,
`bindings`, `packer`, `rerank`, `entailment`, `graphexpansion`, `lineage`,
`provenance`) — read in full (delegated + key blocks re-verified by this reviewer):
clean apart from the two currency-label findings above; the sentence/number gate
(`all_grounded`) is applied fail-closed on both AI lanes, and provenance collapse uses
the one canonical `better_fact` everywhere. Not fully excavated in G1: `catalysts.py`,
`eval.py`, `readiness.py`, `sentinel.py`, `reporter.py`, `analyst.py` (small non-money
orchestration files — swept only).

## Group: G2 Routes (`caos/server/routes/` — 32 files)

**Outcome first:** the route layer is clean on the money invariants — it consistently
delegates arithmetic to the guarded engine helpers and validates at the trust
boundary. Deep-read set (in full): `sector.py`, `reports.py`, `portfolios.py`,
`models.py`, `runs.py`, `query.py`, `issuers.py`, `rv.py`, `scenario.py`,
`committee.py` (freeze path). The two real defects found in route-served numbers
live in G3's parser/bucketing helpers (filed there); one P2 sits in `rv.py` (filed in
G3 alongside its sibling since the defect is in the route file's own helper), and one
P3 monitoring-signal inconsistency below.

### [P3] Sector review — early-warning threshold compares a 0–0.99 score against 75
- **Finding (1 sentence):** `_build_review_payload` renders `current_state = f"{score:.0f} / {severity}"` and computes `warning_status = "breached" if severity == "critical" or score >= 75` — but `sector_materiality_score` is capped at **0.99**, so the score clause is dead (score-based breach can never fire) and the panel renders "0 / medium" or "1 / high" against a threshold string that advertises "Materiality score >= 75 or severity critical".
- **Files / blocks:** `caos/server/routes/sector.py` → `_build_review_payload` (early-warning block); `caos/server/sector_logic.py` → `sector_materiality_score` (the 0.99 cap).
- **Analyst impact (1 sentence):** the sector early-warning register shows a meaningless "0 / …" or "1 / …" score (a low-severity 0.28 renders "0", anything ≥ 0.5 renders "1") and only ever breaches on `critical` severity — a high-materiality (0.95) non-critical signal reads "watch" beside a threshold string that claims it was measured against 75.
- **Blast radius:** sector review payload (CP-SR V2 surface) only; no money math.
- **Novelty:** new — the CP-SR V2 review payload post-dates the audits.
- **Proof:** `sector_materiality_score("high", "supply", 5, "primary")` ≤ 0.99 by construction (`min(0.99, …)`); `0.99 >= 75` is False; `f"{0.95:.0f}"` → `"1"`. Fix: compare against `0.75` (or scale the score ×100 in both the render and the threshold text).

### Group verdict — the rest of G2 is clean

Verified during the sweep (each with the specific guard located): `reports.py`
round-trips every stored/served composition through `_bounded_composition(...,
allow_nan=False)` (NaN/inf → 422, never persisted) and gates publish/export on
`origin == "live"` + committee-export policy with SHA-verified payloads;
`portfolios.py` delegates all math to `engine/portfolio.py`'s checked helpers,
bounds stress inputs at the boundary, and its `.limit(200)` caps the portfolio *list*
(not a money roll-up); `issuers.py` collapses headline facts with the canonical
`engine.metrics.better_fact` (no re-implementation), preserves `None` in the
cross-default domino map, and its lexicographic period ordering is re-sorted
client-side by `issuer-profile-charts.buildSeries` before display; `runs.py` /
`query.py` / `models.py` perform no inline money arithmetic (a NaN smuggled into a
saved model-grid payload is rejected at report publication by `_bounded_composition`);
`sector.py`'s money-free salience scores are finite-validated. Blocked facts cannot be
served because the runner never writes them (write-skip verified in G1). Swept, not
excavated: `alerts.py`, `analysis.py`, `analysis_insights.py`, `autonomy.py`,
`chat.py`, `decisions.py`, `digest.py` (BE6-3 known-deferred stands), `edgar.py`,
`health.py`, `ingestion.py`, `market_import.py`, `model_v2.py`/`model_workbook.py`
(route shells over the G3-verified engines), `notifications.py`, `portfolio.py`,
`qa.py`, `research.py`, `settings.py`, `sponsors.py`, `thesis.py` — these are
auth/persistence shells or prior-audited surfaces; no money arithmetic was found in
them by targeted grep that was not already delegated to audited engine helpers.

## Group: G3 Server core

**Outcome first:** one P1 — the constraint-limit parser turns a **word-form minimum
into a maximum**, so a breached hard floor renders as compliant (and the deeper the
breach, the greener the status). The new Model Builder v2 / workbook / market-import
stack is otherwise notably disciplined (tie-outs, finite gates, strict-import blocks).
Deep-read set: `model_engine_v2.py`, `model_workbook.py`, `report_exports.py`,
`market_xlsx.py`, `ratings.py`, `freshness.py`, `portfolio_ingest.py`, `scenario.py`,
`nlquery.py` (unit sourcing), `committee.py` (freeze path), runner-adjacent executor
files by prior-audit reliance.

### [P1] Portfolio ingest — a word-form minimum constraint is parsed as a maximum, so a floor breach renders compliant
- **Finding (1 sentence):** `_parse_limit` recognizes only glyph operators (`≤ ≥ < > <= >=`) and defaults every bare number to `"<="` ("bare number → treat as a max"), so a constraint whose limit text states a minimum in words — `Min 90.0% 1st lien`, `at least 90%`, `minimum 90% senior secured` — is stored with `limit_op = "<="` and evaluated as a ceiling.
- **Files / blocks:** `caos/server/portfolio_ingest.py` → `_parse_limit`, `_LIMIT_RE`, `_OP`; consumed by `caos/server/engine/portfolio.py` → `_status`, `check_constraints` (compliance table + headroom), and frozen into the committee record by `routes/committee.py` → `_freeze_portfolio_snapshot`.
- **Analyst impact (1 sentence):** a portfolio holding 85% first-lien against a real 90% *floor* renders **Watch, headroom +5.00** — and at 75% (a 15-point breach) it renders **Pass** with +15.00 headroom, because under the inverted operator a deeper breach reads as *more* room; the compliance monitor, the Portfolio Lab risk-budget panel, and the frozen committee snapshot all repeat it.
- **Blast radius:** every consumer of `check_constraints`: `compute_portfolio_analytics` (`risk_budget.headroom`, status counts), `routes/portfolios.py` compliance endpoints, `routes/committee.py` frozen analytics. (`assess_issuer_fit`'s caps are *not* affected — `_limit_for` reads only `limit_value`, ignoring the operator.) The seed/self-check rows all use the `≥` glyph, which is why nothing trips today.
- **Novelty:** new — `portfolio_ingest.py` (created 2026-07-05) post-dates the backend matrix (last touched 07-03); no prior-audit item covers constraint-operator parsing.
- **Proof (executed this session, then independently re-executed by the fresh-context verifier):** `_parse_limit('Min 90.0% 1st lien')` → `(90.0, '%', '<=')`; `engine.portfolio._status(85.0, 90.0, '<=')` → `"Watch"` (true answer: Breach); `_status(75.0, 90.0, '<=')` → `"Pass"`. Glyph form `'≥ 90%'` parses correctly → `Breach` at 85. **The verifier also proved a second trigger that defeats the "real inputs use glyphs" defense entirely: a cp1252/Excel-legacy CSV degrades `≥` to `?`, and `_parse_limit('? 90.0% NAV')` → `(90.0, '%', '<=')` — a glyph-authored monitor inverts the moment the upload isn't UTF-8.** Fix shape: add word-operator detection (`min|minimum|at least|no less than|floor` → `>=`; `max|maximum|at most|no more than|cap` → `<=`) before the bare-number default, treat a bare `?`-prefixed number as un-inferable, and flag un-inferable rows `Info` rather than guessing a direction.

### [P2] RV screening — S&P modifier ratings mis-bucketed one notch senior by substring order
- **Finding (1 sentence):** `_rating_bucket`'s S&P token map iterates `"BB+" → "BB" → "BB-"`, so `"BB-"` matches the `"BB"` substring first and returns **Ba2** (true: Ba3), and `"CCC-"` returns **Caa2** (true: Caa3).
- **Files / blocks:** `caos/server/routes/rv.py` → `_rating_bucket`, `_cohort_key`, `create_rv_screen` (cohort median / DM pickup).
- **Analyst impact (1 sentence):** a BB−/CCC− name is compared against the wrong (one-notch-senior) rating cohort, so its `cohort_median_dm_bps` and `dm_pickup_bps` — the screen's ranking signal — are computed against tighter-spread peers, systematically overstating the apparent pickup for exactly the weakest modifier ratings.
- **Blast radius:** RV screen candidates' pitch numbers and rank order (`create_rv_screen` → `RVCandidate.pitch.market_relative_value`); screen-only/actionable classification unaffected (identity/freshness gates dominate).
- **Novelty:** new — `routes/rv.py` post-dates all §3C audits (the prior FL-005 RV item concerned the frontend prototype's `rvdata.ts`, a different file and defect).
- **Proof (executed this session):** `_rating_bucket('BB-')` → `'Ba2'`; `_rating_bucket('CCC-')` → `'Caa2'`; dual-source `'Ba3/BB-'` → `'Ba3'` (Moody's loop wins, correct). Fix: check longer tokens first (`BB-`/`BB+` before `BB`; `CCC-` before `CCC`) or regex with modifier captured.

### [P3] Portfolio ingest — a genuine zero bid with no ask drops the price to a dash (and a zero price never prices NAV anyway)
- **Finding:** `parse_holdings_xlsx` computes `price = (bid + ask) / 2 if … else (bid or ask)` — for `bid = 0.0, ask = None` the truthiness fallback yields `None`, so a fully distressed zero-bid quote is stored as "no price" instead of `0.0` (the mirror case `ask = 0.0` survives).
- **Files / blocks:** `caos/server/portfolio_ingest.py` → `parse_holdings_xlsx`; **and** `caos/server/engine/portfolio.py` → `position_market_value` (its `price > 0` gate).
- **Analyst impact:** display-side, the position shows no price; NAV-side the par fallback applies **either way** — `position_market_value` gates `price > 0`, so even a correctly-stored `0.0` price falls back to par (verified: `position_market_value({'par_usd': 1e6, 'price': 0.0})` → `1000000.0`). Marking a defaulted zero-quote at par is the substantive overstatement, and fixing the ingest truthiness alone does not change NAV.
- **Blast radius:** holdings ingest → every exposure/NAV consumer. **Novelty:** new. **Proof (executed, incl. by the verifier):** `0.0 or None` → `None`; the `position_market_value` call above. Fix: `bid if bid is not None else ask` at ingest **plus** a deliberate decision at the `price > 0` gate (treat `0.0` as a real mark → MV 0, with a limitation flag) — the two sites must move together.

### [P3] RV screening — route-local `_number` omits the finite check
- **Finding:** `routes/rv.py` → `_number` is `isinstance`-only, so a NaN `mid3yDm`/`midYtm` would pass into `pickup`/`score` (scrambling the ranking sort and emitting NaN JSON) — today unreachable because both producers filter (`market_xlsx.py` rejects non-finite at parse; the reference JSON is curated), so this is a defense-in-depth gap against the house convention, not a live defect.
- **Files / blocks:** `caos/server/routes/rv.py` → `_number`, `create_rv_screen`.
- **Analyst impact:** none today; a future snapshot producer that skips the finite filter scrambles RV ranks silently.
- **Blast radius:** RV screen only. **Novelty:** new instance of a *recorded* pattern class — CONFIDENCE_AUDIT_2026-07-10 banned the bare-`isinstance` numeric gate (its instances in `debate.py`/`portfoliofit.py` were fixed); `routes/rv.py` post-dates that sweep and reintroduces it. **Proof (executed):** `_number(float('nan'))` → `nan`. Fix: mirror `engine.periods.is_finite_number`.

### [P3] Model engine v2 — per-instrument `hedge_effect` masked while `cash_interest` includes it
- **Finding:** `DebtInstrumentCalculation` is built with `hedge_effect=_number(hedge_effect) if opening is not None and closing is not None else None` — the only component field gated on unrelated balance availability — so a workbook row can display `benchmark+margin+coupon+fees+fx` components that do not sum to the displayed `cash_interest` (which does include the hedge).
- **Files / blocks:** `caos/server/model_engine_v2.py` → `ModelEngineV2.calculate` (instrument_results construction).
- **Analyst impact:** a hand-reconciling analyst sees components ≠ total on a debt-schedule row (display/reconciliation gap, not a wrong total).
- **Blast radius:** Model Builder v2 API consumers (workbook render tie-out excludes the masked field). Reachability caveat: with no overrides, a missing opening/closing usually nulls `cash_interest` too — the visible components≠total row materializes when an analyst override (e.g. `average_balance`) fills the chain while a balance stays null. **Novelty:** new (file post-dates audits). **Proof:** supply `hedge_effect` with `opening_balance` absent and an `average_balance` override → row shows hedge null while `cash_interest` includes it. Fix: report `_number(hedge_effect)` unconditionally.

### Group verdict — the rest of G3's money stack is clean

`model_engine_v2.py` is rigorous (Decimal core, `1e250` input bound, PIK trapezoid
roll-forward algebraically self-consistent, explicit gaps on zero/negative EBITDA and
non-positive PIK denominators, override audit trail); `model_workbook.py` re-derives
every rendered value and reconciles at `1e-9` relative tolerance, so cell/formula
divergence is structurally prevented; `market_xlsx.py` rejects junk to `None` (never
0) and blocks mixed `as_of` snapshots; `ratings.py` scales verified index-aligned
against the Moody's idealized WARF table; `freshness.py` and `scenario.py` clean
(NaN→0-then-clamp on driver deltas is deliberate and pre-clamped);
`report_exports.py` clean (one display nit: the accounting `number_format` renders a
genuine `0.0` as `"-"`, visually identical to the `None` dash — data intact, noted in
Not-findings). `committee.py`'s freeze path finite-guards every money field and
hmac-verifies the stress fingerprint before attaching stress output to frozen
holdings (stale → explicit `"stale"` diagnostic, never silently attached).
`nlquery.py` result cells carry the *fact's* stored unit (only the `querygraph`
surfaces override it — filed in G1). Not deep-read in G3: `research_report*.py`,
`deepresearch.py`, `retrieval.py`, `ingest.py`, `database.py` beyond targeted reads,
`main.py`/auth/identity/tenancy (trust boundary — extensively covered by the standing
security audits; nothing re-derived here).

## Group: G4 Frontend data layer (`caos/frontend/src/lib/` — 155 files, medium depth)

**Outcome first: one P3** (an export-only ±Infinity leak) — otherwise the data layer
holds the dash-vs-zero discipline everywhere it was probed, including the two places
that *look* like percent-vs-fraction bugs and are in fact correct. Deep-read set:
`engine/adapt.ts`, `engine/numbers.ts`, `reports/{live-builder,builders,model,assumptions}.ts`,
`analysis-workbench.ts`, `model/{scenarios,useModelHistory}.ts`,
`issuer-profile-charts.ts`, `command/{stats,rvdata}.ts`, `query/{format,viz}.ts`,
plus the load-bearing formatters `format.ts`, `model-format.ts`, `cell-style.ts`.
**`lib/api.ts` and `lib/api-auth-loss.test.ts` were deliberately not reviewed — they
are the user's uncommitted work-in-progress** (per the brief's WIP boundary); their
review belongs to whatever lands them.

### [P3] Model export — `round3` passes ±Infinity into the committee `.xlsx`
- **Finding (1 sentence):** `buildModelSheet`'s cell formatter `round3` guards `v == null || Number.isNaN(v)` but not `±Infinity`, while `lib/reports/model.ts` stores unguarded raw divides for the ratio rows (`adjm = adj / rev`, `sga = (opex − da) / rev`, `dapc = da / rev`) — so overriding a quarter's revenue to `0` puts `Infinity` in those columns, which the on-screen grid blanks (its `fmt` uses `Number.isFinite`) but the exported workbook carries as a numeric `Infinity` cell with a `"0.0%"` number format (the fresh-context verifier traced the `0` override through all five hops — `OV_SIGN.rev`/`isEditCol`/`parseNum`/`commitEdit`/`buildModel` — none rejects it: live, not latent).
- **Files / blocks:** `caos/frontend/src/components/model/export.ts` → `buildModelSheet` (inner `round3`); `caos/frontend/src/lib/reports/model.ts` → `finishBalances` (the `/ c.rev` ratio block).
- **Analyst impact (1 sentence):** a grid/export divergence on a committee deliverable — the screen shows a blank margin cell, the exported spreadsheet shows a non-finite value.
- **Blast radius:** Model-appendix export sheet only; every sibling formatter (`model-format.fmt`, `buildScenariosSheet`, `live-builder.modelCell`) already uses `Number.isFinite` — `round3` is the lone divergent guard.
- **Novelty:** new (export path post-dates the frontend matrix findings).
- **Proof:** set an editable first-quarter revenue override to `0`; `adj / rev` → `Infinity`; `Math.round(Infinity * 1000) / 1000` → `Infinity`; `typeof Infinity === "number"` so the numFmt applies. Fix: `Number.isFinite(v) ? Math.round(v * 1000) / 1000 : ""`.

### Group verdict — the rest of G4 is clean

Highlights the reader should not mistake for bugs (all verified against the backend
contract): `adapt.ts` multiplies `addback_cap_pct` by 100 but not `utilization_pct` —
correct, the backend emits the former as a 0–1 fraction and the latter in percent
magnitude; `musd()` hardcodes `$` over `*_musd` keys whose producers are USD-asserted;
`reports/model.ts` nulls every zero-denominator KPI and back-solves anchored cash to
`NaN`-renders-blank rather than fabricating; `rvdata.ts` fences junk marks
(`credibleDm`, the FL-005 fix — verified still present) and null-guards every
benchmark; `query/format.ts` falls through to a bare number exactly like the server's
`_fmt_metric`. `numbers.finiteNumber`, `format.ts`, `model-format.ts`, and
`cell-style.ts` all reject NaN/±Infinity.

## Group: G5 Frontend rendering (405 files — swept)

**Outcome first: no new finding at the probed depth.** The rendering layer's money
cells sit on the G4 formatters (NaN/Infinity → "—") and the recorded frontend-matrix
findings (FE-2/4/5/6/7/10/11 etc.) remain the authoritative inventory for this
surface — none was found regressed in the components read (`AssumptionsPanel.tsx`,
`ReportDoc.tsx`, `export.ts`, `cell-style.ts`, `SectorReviewPanels.tsx` via the G2
verifier). Not excavated: the full component tree (deep-dive/command/RV tables,
chart renderers, `ProfileContent.tsx` beyond its formatter usage and the
addback/utilization contract check) — coverage here is honestly *swept*, weighted by
the fact that two full prior review matrices already own this ground and the money
values themselves are produced server-side (G1–G3, where this review spent its
depth). One watch-item handed to the owners of the RV/command tables: `rvdata.ts`
delta averages skip null rows while the cohort `n` counts all rows — if a consuming
table ever prints that `n` beside the Δ average, label it "of reporting rows".

## Group: G6 Tests & golden (203 files — swept, golden lane deep)

**Outcome first:** one structural finding, already folded into the P0 — **the test
suite actively pins the Altman defect** (`test_distress.py::test_zones` pins the
2.6/1.1 zones against the +3.25 score; `test_golden_cp1.py` pins both `altman_z` and
`zone` for VSAT/FUN; `caos/docs/VIASAT_VALIDATION.md` blesses "4.47 safe" as
human-validated). Anyone fixing the P0 must treat these as characterization tests of
the bug, not as counter-evidence. Beyond that the golden lane is healthy: the VMO2
reported-lane golden honestly pins the quirky-but-harmless captured phrase
(`"o would be: Total Net Debt…"`) and a *quarterly* (`Q1`) EBITDA period — which the
engine correctly refuses to annualize downstream (verified via `latest_annual`
consumers in G1). The full offline suite was executed this session on a scratch copy
of the tree: **1906 passed, 15 skipped in 85.8s** — matching the state the last
commit message reports, so the suite blesses the current behavior set, including the
defects filed above (none of the new P1/P2 findings has a failing test today; each
finding's Proof line states the test that *would* fail).

## Group: G7 Corpus (`Modular OS/` — 483 files, swept)

**Outcome first: no finding.** The corpus is methodology prose consumed by (a) the
live synthesizer (per-module `*_ACTIVE_PROMPT.md` + the CP-4D/CP-2G verified
bundles, fingerprint-governed — the governance was verified in code at
`synth.prompt_corpus_fingerprint`/`load_prompt_bundle`) and (b) M365 Copilot. Two
targeted checks: **no Altman reference exists anywhere in the corpus** (so the P0's
wrong pairing is engine-invented, not corpus-mandated), and the CP-2B corpus
deliberately pins **no default shock magnitude** (REF_CP-2B_06's reproducibility
note) — so the engine's 10/20/30% ladder and 7.0x breach marker are engine-chosen
parameters disclosed in payload text, not corpus contradictions. The prose
methodology itself (27 modules) was not re-derived line-by-line against finance
literature — out of scope for a code review; the engine-vs-corpus *numeric parity*
dimension is the part that was checked.

## Group: G8 Ops (73 files — swept)

**Outcome first: no new finding.** `check_complexity_delta.py`, `check_lock_sync.py`,
CI workflows, seed scripts (`seed_qa_scale.py` is QA-env synthetic data, not
analyst-facing), and the deploy stack were swept. The deploy/security posture is
owned by the standing audits (edge auth defense-in-depth, ClamAV-before-parse,
fail-closed boot guards — all previously verified); the known-open items recorded
there (CA/DEP-1 pgvector:pg18 volume path, CA/DEP-3 signup-code placeholder) remain
open per those audits and are **not re-filed here** (nothing new to add to their
records).

## Group: G9 Docs & meta (1,154 files — swept)

**Outcome first: no finding**, one record-keeping observation that matters to future
reviews: the QA matrices' status columns can drift optimistic — this run found ENG-1
carried as remediated in session-note lineage while never landing in git (see P0).
The `.agents`/`.claude`/`.cursor`/`.codex`/`.gemini` skill mirrors (≈700 files) are
tooling config, no analyst-facing numbers. `caos/docs/` planning documents are
aspirational by convention (recorded repo-wide) and were used only as the novelty
filter, never as evidence of code state.

## Adversarial Rewrite Tournaments

Selection: triage surfaced ~10 rewrite-worthy candidates (complex, hot, contract-heavy
functions with real verification harnesses). Within the §4C budget, **4 tournaments
ran** (this section); candidates deferred without a tournament are listed at the end.
Semantic *defects* (the P0/P1/P2 findings) were deliberately **not** tournament
targets — §2B disqualifies any rewrite that changes analytical output, so a tournament
must preserve even known-buggy behavior; fixes are recommended in the findings
themselves.

### Tournament 1: `compute_exposure` (`caos/server/engine/portfolio.py`)

- **Impact set (binding):** direct callers `compute_portfolio_analytics` and `assess_issuer_fit` (same file — both bracket-index the result and depend on the None-poisoning of `total_nav`), `querygraph._portfolio_exposure` → `_concentration` → `build_graph` (depends on `sectors` mv-desc ordering and slices `[:20]`), `portfoliofit._live_concentration` → `synthesize_portfolio_fit`, `routes/portfolios.py` (four call sites serializing the dict to the API), `routes/committee.py` (frozen analytics via `compute_portfolio_analytics`). The eleven `missing_dependencies` strings are user-visible UI text (`PortfolioLabWorkbench.tsx` renders them verbatim; `Ask.tsx` joins them into prose). Tie ordering (stable sort, `None` → `-inf`) is contractual committee-facing output.
- **Bracket:** Speed (A: inlined guards + rating memo, self-measured 3.3×, C901 stays 21) vs Memory (B: defaultdict/islice/nlargest, self-measured −18.4% peak alloc, C901 stays 21) → **B** (A abandons the `checked_*` money-math canon for a parallel open-coded discipline and duplicates `position_market_value`/`_obligor_key` semantics inside the loop). B vs Readability (C: nine accumulate-ladders folded into `_add_or_note` + `_WeightedSum` + two focused helpers, C901 21→9) → **C** (B preserves all nine ladders and swaps the selection algorithm on contractual tie order; C removes the actual duplication with a smaller, mechanically-checkable equivalence surface). **C vs Incumbent → C** (keeps every `checked_*` flow, cuts the abstraction at the genuine seam — the market-value poison-and-continue path stays inline — and retires the C901-21 baseline debt the CI gate encodes).
- **Winner:** Snippet C (Readability challenger), replacing `caos/server/engine/portfolio.py` → `compute_exposure` (lines 445–629 of the file at HEAD `50d615d4`), plus four new private helpers immediately above it.
- **Justification (Arbiter):** (1) the only candidate that removes the nine-fold repetition instead of preserving or re-encoding it — the poison/re-note policy is stated once, in docstrings, at the two helpers; (2) equivalence surface is a mechanical fold — no algorithm, sort, convention, or string changes, every `checked_*`/`_pct`/`_rounded`/`_obligor_key` call preserved; (3) C901 21→9 retires baseline debt (the incumbent taxes every future editor at the delta gate), largest new helper complexity 4.
- **Final code:** the full winning block (helpers + function) —

```python
def _add_or_note(
    total: Optional[float], amount: Any, note: str, missing: List[str]
) -> Optional[float]:
    """``checked_add`` that appends *note* to *missing* when the sum is (or already
    was) None. A poisoned total stays None and re-notes on every later add;
    ``_bounded_missing`` dedupes, so only the note's first position survives."""
    result = checked_add(total, amount)
    if result is None:
        missing.append(note)
    return result


class _WeightedSum:
    """Σ(value × weight) / Σ(weight) accumulator with overflow poisoning.

    Either sum overflowing degrades it to None and appends *note* once per
    affected add; ``mean`` then degrades to None — as it also does when nothing
    was ever weighted (zero denominator)."""

    def __init__(self, note: str, missing: List[str]) -> None:
        self.num: Optional[float] = 0.0
        self.den: Optional[float] = 0.0
        self._note = note
        self._missing = missing

    def add(self, value: Any, weight: Any) -> None:
        self.num = checked_add(self.num, checked_multiply(value, weight))
        self.den = checked_add(self.den, weight)
        if self.num is None or self.den is None:
            self._missing.append(self._note)

    def mean(self, digits: int) -> Optional[float]:
        return _rounded(checked_divide(self.num, self.den), digits)


def _by_mv_desc(mv_by_key: Dict[str, Optional[float]]) -> list[tuple[str, Optional[float]]]:
    """(key, mv) pairs by MV descending; None (overflowed) sinks to the bottom.
    The stable sort keeps first-seen insertion order for exact-MV ties."""
    return sorted(
        mv_by_key.items(),
        key=lambda item: item[1] if is_finite_number(item[1]) else float("-inf"),
        reverse=True,
    )


def _sector_rows(
    sector_mv: Dict[str, Optional[float]],
    sector_obl: Dict[str, set],
    total_nav: Optional[float],
    missing: List[str],
) -> List[Dict[str, Any]]:
    """Sector distribution (MV desc), capped at ``_DISTRIBUTION_LIMIT`` with one
    aggregate "Other" row for the tail. The tail sums via plain ``checked_add`` —
    one overflow note for the whole aggregate, not one per sector."""
    ordered = _by_mv_desc(sector_mv)
    rows = [
        {"sector": sector, "mv": _rounded(value), "pct_nav": _pct(value, total_nav),
         "n_obligors": len(sector_obl[sector])}
        for sector, value in ordered[:_DISTRIBUTION_LIMIT]
    ]
    if len(ordered) > _DISTRIBUTION_LIMIT:
        other_mv: Optional[float] = 0.0
        other_obligors: set = set()
        for sector, value in ordered[_DISTRIBUTION_LIMIT:]:
            other_mv = checked_add(other_mv, value)
            other_obligors.update(sector_obl[sector])
        if other_mv is None:
            missing.append("overflow other-sector exposure")
        rows.append({"sector": "Other", "mv": _rounded(other_mv),
                     "pct_nav": _pct(other_mv, total_nav),
                     "n_obligors": len(other_obligors)})
    return rows


def compute_exposure(positions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Portfolio exposure report from CLO positions — NAV/par, counts, sector +
    rating distribution, WA rating/margin/price, 1st-lien %, single-name max,
    top-10. All %s are of NAV (market value). Positions with a non-finite/≤0 par
    are dropped (they carry no exposure)."""
    valid = [
        p
        for p in positions
        if is_finite_number(p.get("par_usd")) and p["par_usd"] > 0
    ]
    if not valid:
        return {"n_positions": 0, "n_obligors": 0, "n_sectors": 0, "total_par": 0.0,
                "total_nav": 0.0, "sectors": [], "rating_dist": [], "top10": [],
                "wa_rating": None, "warf": None, "wa_margin": None, "wa_price": None,
                "first_lien_pct": None, "single_name_max": None,
                "missing_dependencies": []}

    missing: List[str] = []
    total_par: Optional[float] = 0.0
    total_nav: Optional[float] = 0.0
    first_lien_mv: Optional[float] = 0.0
    warf_sum = _WeightedSum("overflow WARF aggregation", missing)
    margin_sum = _WeightedSum("overflow margin aggregation", missing)
    price_sum = _WeightedSum("overflow price aggregation", missing)
    obligor_mv: Dict[str, Optional[float]] = {}
    obligor_name: Dict[str, str] = {}
    sector_mv: Dict[str, Optional[float]] = {}
    sector_obl: Dict[str, set] = {}
    bucket_mv: Dict[str, Optional[float]] = {}
    bucket_obl: Dict[str, set] = {}

    for p in valid:
        total_par = _add_or_note(total_par, p["par_usd"], "overflow total par", missing)
        mv = position_market_value(p)
        if mv is None:  # unpriceable → NAV unknowable; counts in par/positions only
            total_nav = None
            missing.append(
                f"overflow market value:{p.get('id') or p.get('borrower_name') or 'unknown'}"
            )
            continue
        total_nav = _add_or_note(total_nav, mv, "overflow total NAV", missing)

        obligor = _obligor_key(p)
        obligor_mv[obligor] = _add_or_note(
            obligor_mv.get(obligor, 0.0), mv, f"overflow obligor exposure:{obligor}", missing
        )
        obligor_name.setdefault(obligor, str(p.get("borrower_name") or p.get("ticker") or obligor))

        sector = str(p.get("sector") or "Unclassified")
        sector_mv[sector] = _add_or_note(
            sector_mv.get(sector, 0.0), mv, f"overflow sector exposure:{sector}", missing
        )
        sector_obl.setdefault(sector, set()).add(obligor)

        idx = rating_index(p.get("rating_moody"), p.get("rating_sp"), p.get("rating_fitch"))
        bucket = rating_bucket(idx)
        bucket_mv[bucket] = _add_or_note(
            bucket_mv.get(bucket, 0.0), mv, f"overflow rating bucket:{bucket}", missing
        )
        bucket_obl.setdefault(bucket, set()).add(obligor)

        if idx is not None:
            warf_sum.add(FACTORS[idx], mv)
        if is_finite_number(p.get("margin_bps")):
            margin_sum.add(p["margin_bps"], mv)
        if is_finite_number(p.get("price")):
            price_sum.add(p["price"], mv)
        if _is_first_lien(p.get("ranking")):
            first_lien_mv = _add_or_note(first_lien_mv, mv, "overflow first-lien exposure", missing)

    sectors = _sector_rows(sector_mv, sector_obl, total_nav, missing)
    rating_dist = [
        {"bucket": b, "mv": _rounded(bucket_mv[b]), "pct_nav": _pct(bucket_mv[b], total_nav),
         "n_obligors": len(bucket_obl[b])}
        for b in _BUCKET_ORDER if b in bucket_mv
    ]

    top_obl = _by_mv_desc(obligor_mv)[:10]
    top10_total: Optional[float] = 0.0
    for _key, value in top_obl:  # no note on overflow: only top10_pct_nav blanks
        top10_total = checked_add(top10_total, value)

    warf = warf_sum.mean(0)
    return {
        "n_positions": len(valid),
        "n_obligors": len(obligor_mv),
        "n_sectors": len(sector_mv),
        "total_par": _rounded(total_par),
        "total_nav": _rounded(total_nav),
        "sectors": sectors,
        "rating_dist": rating_dist,
        "top10": [{"obligor": obligor_name[k], "mv": _rounded(v), "pct_nav": _pct(v, total_nav)}
                  for k, v in top_obl],
        "top10_pct_nav": _pct(top10_total, total_nav),
        "wa_rating": rating_bucket(_nearest_rating_idx(warf)) if warf is not None else None,
        "warf": warf,
        "wa_margin": margin_sum.mean(3),
        "wa_price": price_sum.mean(3),
        "first_lien_pct": _pct(first_lien_mv, total_nav),
        "single_name_max": ({"obligor": obligor_name[top_obl[0][0]],
                             "pct_nav": _pct(top_obl[0][1], total_nav)}
                            if top_obl else None),
        "missing_dependencies": _bounded_missing(missing),
    }
```

- **Verification (run by the Orchestrator on the scratch copy — actual outputs):**
  - Splice applied to the scratch copy only; the real file's hash and content verified unchanged afterward (`md5` differs scratch-vs-real; helper names absent from the real file; diff recorded at `scratchpad/t1_winner.diff`, −123/+116 lines confined to the `compute_exposure` region).
  - `PYTHONPATH=. .venv311/bin/python engine/portfolio.py` → `engine/portfolio.py self-check OK`.
  - `pytest caos/tests/server/test_portfolio.py test_portfolio_lab_backend.py test_portfolio_run.py test_portfolios.py golden/test_golden_portfolio.py -q` → **`38 passed, 1 warning in 4.26s`** (includes the golden 381-position book — golden numbers unmoved).
  - Differential fuzz (adversarial harness inspected before use; 412 cases: 25-way exact-MV ties, ties at the top-10 cut, 60 tied sectors at the 50-cap, MV/par/aggregation overflow chains, >100-note `_bounded_missing` cap, identity fallbacks, the golden book, 400 randomized hostile books; repr-exact oracle) → **`OK: 412 cases, 0 mismatches`** against the pristine original.
  - `ruff check` (repo config) → `All checks passed!`; explicit C901 probe: winner build lists **only** the two pre-existing violations (`compute_stress_snapshot` 21, `compute_portfolio_analytics` 16) — `compute_exposure` is **removed** from the violation list (was 21 at baseline).
  - Caller re-check: `import engine.portfolio, engine.querygraph, engine.portfoliofit, routes.portfolios, routes.committee` → OK; the passing portfolio-lab/portfolios suites exercise the route callers end-to-end.

### Tournament 2: `_amount` (`caos/server/engine/reported_cp1.py`)

- **Impact set (binding):** callers `extract_reported_metrics` / `_pick_for_disclosure` / `_pick_recent` via the three anchored patterns (`_EBITDA_AMOUNT`, `_TOTAL_REVENUE_AMOUNT`, `_REVENUE_AMOUNT`); output tuples flow into the reported CP-1 payload (`adj_ebitda`/`revenue` slots + claim text) and the VMO2 golden pins exact outputs (`{Q1: 901.7}`, `{Reported: 2390.1}`). **Special constraint: the filed P1 (verb-only delta-as-level) is current semantics — every candidate was required to preserve the bug byte-for-byte; fixing it was disqualification.**
- **Bracket:** Speed (A: hoisted lookbehind regexes + single `m.group(1,2,3)` read; author's own verdict "hygiene, not a win — µs-scale behind retrieval I/O") vs Memory (B: same code-motion, no module additions, plus a load-bearing comment that the ≤6/≤5-char windows must stay *slices* — `\b` under `pos/endpos` consults `text[pos-1]`, so the slice truncation is observable behavior) → **B** (A's only distinct contribution is inert; B's is real knowledge). B vs Readability (C: extracts `_scale_to_millions` + `_period_near`, kills the dead dual group-binding, fixes the objectively wrong docstring — the function returns *millions rounded to 1dp*, not "value_in_units" — and preserves the ENG-2/ENG-4 audit anchors plus an explicit "known residual, filed separately" marker on the P1's landing site) → **C**. **C vs Incumbent → C**: the Arbiter verified the lineage survives (ENG-2 verbatim on the re-point conditional; ENG-4 with its grep anchors inside the new helper's docstring), independently re-derived the complexity arithmetic (incumbent 12 — a *measured* standing violation of the ≤10 gate — vs 7), and inverted the incumbent's best argument: the moment the filed P1 fix touches this file, the C901-12 baseline taxes the fix author; a behavior-identical change is the cheap moment to retire it.
- **Winner:** Snippet C (Readability challenger), replacing `caos/server/engine/reported_cp1.py` → `_amount` (lines 111–159 of the file at HEAD `50d615d4`), adding `_scale_to_millions` and `_period_near` immediately above it. Recommended graft from the runner-up (not part of the verified winner): B's slice-vs-`pos/endpos` warning comment.
- **Justification (Arbiter):** (1) collapses the triple-duplicated `safe_*`/None-check ladder into one pure None-propagating helper at a natural seam; (2) the only candidate that moves the tournament's one measured quantity — C901 12 → 7, retiring a baseline gate violation; (3) fixes a docstring that misstates the return unit in an engine whose documented failure mode (ENG-4) is exactly a 10³/10⁶ mis-scale, while extending the audit lineage (group-alignment invariant, window semantics, residual-bug marker) rather than destroying it.
- **Final code:** —

```python
def _scale_to_millions(val: float, scale: str) -> Optional[float]:
    """Normalise a parsed amount to millions given its lowercased scale token.
    'billion'/'bn' ×1000; 'thousand'/'k' ÷1000 (UK/IFRS statutory "£963,400
    thousand" — audit 2026-07-10 ENG-4); a SCALE-LESS figure ≥1e7 is written in
    full units ("£1,562,300,000") and is ÷1e6 — passed through as-is it would be
    a 10^6 mis-scale poisoning leverage, EV and reconciliation downstream.
    Everything else — 'million'/'m', and smaller scale-less "in millions" table
    rows ("Total Revenue £ 2,390.1", golden-pinned for VMO2) — is already in
    millions and passes through unchanged. None-propagating: a non-finite
    product/quotient from safe_mul/safe_div comes back as None."""
    if scale.startswith("b"):
        return safe_mul(val, 1000.0)  # billion → million
    if scale in ("thousand", "k"):
        return safe_div(val, 1000.0)  # thousands → million
    if not scale and val >= 1e7:
        return safe_div(val, 1e6)  # full units → millions
    return val


def _period_near(text: str, start: int, end: int) -> str:
    """First period token near the [start:end) match — 40-char lookback plus
    10-char lookahead — uppercased; "Reported" when none is found."""
    m = _PERIOD.search(text[max(0, start - 40): end + 10])
    return m.group(1).upper() if m else "Reported"


def _amount(pat: re.Pattern, text: str) -> Optional[Tuple[float, str, str]]:
    """(value in millions rounded to 1dp, currency symbol, period token or
    "Reported") for the disclosed CURRENT amount, or None."""
    m = pat.search(text)
    if not m:
        return None
    # "revenue increased from £392m to £415m" / "grew by £12.3m to £963.4m": the
    # metric-anchored match lands on the PRIOR value or the CHANGE (right after
    # 'from'/'by'); the actual level is the '... to £B' figure. Re-point to the
    # next amount when this one is a from/by comparative — without the 'by' case
    # the delta was published as the level, understating EBITDA/revenue 10-60x
    # and silently collapsing the CP-3B recovery EV (audit 2026-07-10 ENG-2).
    # Windows: 'from'/'by' must end within the 6 chars before the currency
    # symbol; the level must start within 12 chars after this match, with 'to'
    # in the 5 chars before it. Known residual, filed separately and
    # deliberately NOT handled here: a verb-only comparative ("rose £X to £Y")
    # still yields the delta/prior X.
    if re.search(r"\b(?:from|by)\s*$", text[max(0, m.start(1) - 6): m.start(1)], re.IGNORECASE):
        nxt = _AMOUNT_RE.search(text, m.end())
        if (
            nxt
            and nxt.start() - m.end() <= 12
            and re.search(r"\bto\s*$", text[max(0, nxt.start() - 5): nxt.start()], re.IGNORECASE)
        ):
            # Safe to re-bind: every _*_AMOUNT pattern is a non-capturing metric
            # prefix + _AMOUNT, so groups 1-3 mean the same in nxt as in m.
            m = nxt
    cur, scale = m.group(1), (m.group(3) or "").lower()
    try:
        val = float(m.group(2).replace(",", ""))
    except ValueError:
        return None
    if not is_finite_number(val):
        return None
    scaled = _scale_to_millions(val, scale)
    if scaled is None:
        return None
    return round(scaled, 1), cur, _period_near(text, m.start(), m.end())
```

- **Verification (Orchestrator, scratch copy — actual outputs):**
  - Differential harness (written by the Orchestrator, not a role: 22 adversarial sentences × 3 anchored patterns + 4 whole-`extract_reported_metrics` chunk-set comparisons, repr-exact — including every preserved-bug case: "rose £12.3 million…" → 12.3 both sides, the boundary-truncation "Xfrom £392m…" case, thousand/k, bare 1e7 threshold, `to£` no-space, gap->12 restated case) → **`OK: 70 comparisons, 0 mismatches`**.
  - `pytest caos/tests/server/test_reported_cp1.py caos/tests/server/golden/test_golden_cp1.py -q` → **`25 passed in 0.15s`** (VMO2 golden numbers unmoved).
  - `ruff check` (repo config) → `All checks passed!`; explicit C901 ≤10 probe on the winner build → `All checks passed!` (the baseline `_amount` measures **12** on the real file — violation retired); measured winner complexities: `_amount` 7, `_scale_to_millions` 4.
  - Scratch restored to pristine afterward; real file hash re-verified untouched; diff recorded at `scratchpad/t2_winner.diff` (108 diff lines).

### Tournament 3: `propagate` (`caos/server/engine/scenario_network.py`) — **Incumbent holds**

- **Impact set (binding):** sole caller `routes/scenario.py` (QA-gated module outputs in, `PropagationResult` out); 8 `test_scenario_network.py` tests + `test_scenario.py` pin node order/labels/statuses/roundings; **two filed findings live in this function** (unweighted mean recovery; no tranche re-sort) and had to be preserved byte-identically by every candidate.
- **Baseline facts:** C901 measured **8** — under the ≤10 gate; no debt to retire. The function is a linear eight-node narrative in the UI's exact render order.
- **Bracket:** Speed (A: drops the `_node` shim, one-pass walrus recovery; ~3% µs-scale by its own measurement, own verdict "nothing here matters") vs Memory (B: free cuts only — node-list literal, one-pass recovery — plus an API-contract comment and a filed-findings marker; own verdict "honest optimization budget is zero") → **B**, decisively: the Arbiter found, grounded in the snippet, that **A had silently rewritten all seven trust-boundary guards** (`payload.get(...) or {}` dropped everywhere) — an *undeclared* strict-equivalence deviation shipped under a "full equivalence" banner; B's guard sites are character-identical to the incumbent. B vs Readability (C: `_section` + `_metric_node` helpers, per-lane comments; C901 8→8, module +18 lines; carries a *declared* strict-equivalence deviation — `_section`'s isinstance-only guard reads a falsy-dict-subclass's keys where `or {}` blanks them, unreachable via JSON payloads) → **B**: C's deduplication pays with a semantics change on exactly the repetition the incumbent defends as a locally-verifiable trust check, its `_metric_node` hides the review-critical status ternary behind six positional arguments for one caller, and it retires zero gate debt. **B vs Incumbent → INCUMBENT**: stripped to what survives scrutiny, B's durable payload is two good comments (portable as a 3-line comment-only diff), and its whole-function churn would force both incoming filed-fix diffs to rebase across a cosmetic rewrite — negative maintainability at the wrong moment. "A tie ships nothing."
- **Verdict:** the original is kept. Recommended follow-up (not a tournament outcome): cherry-pick B's two comments (node-order API-contract note; filed-findings marker on the recovery lane) when the filed fixes land.
- **Verification:** none required — no change is proposed; the scratch copy's `scenario_network.py` was confirmed byte-identical to the real file throughout (`diff -q` pass recorded mid-tournament).

### Tournament 4: `_annual_series` (`caos/server/engine/edgar_cp1.py`)

- **Impact set (binding):** callers `_series` (every XBRL concept series: revenue/op-income/D&A/interest/impairment/CFO/capex), `_da_series`, `_recent_instant`, `_altman_distress._inst_at` — all feeding `build_cp1_payload` → the EDGAR CP-1 payload; `test_edgar_cp1.py` + the VSAT/FUN goldens pin exact output dicts on real captured XBRL. The incumbent carries `# noqa: C901 — flat XBRL point filter; splitting would obscure the form/fp/span guards` (measured complexity 12).
- **Bracket:** Speed (A: hoisted C-func lookups + cached filed string; self-measured 1.04–1.08×, own verdict "~0.01% of build wall-time"; keeps the noqa) vs Memory (B: winner-triple instead of entry-dict references, honestly labeled "hygiene, not memory"; keeps the noqa) → **B** (A's only distinct payload is a speedup its own author disclaims, and its `finite(...)` aliasing detaches the CLAUDE.md-invariant comment from the canonical spelling at the call site). B vs Readability (C: extracts `_annual_point` — a per-entry projection carrying **all seven guards together, in the incumbent's order**, under a docstring that finally states each guard's threat model: 10-Ks tag Q4-stub/cumulative durations under `fp FY`; 350–380 covers 52/53-week fiscal calendars; the JSON decoder really parses NaN/Infinity — and retires the noqa with measured complexities `_annual_series` 4 + `_annual_point` 9) → **C**. **C vs Incumbent → C:** the Arbiter's decisive finding — *"the noqa's alibi attacks a split nobody has to make"*: the comment argues splitting would obscure the guards, but C's seam separates projection from reduction while keeping every guard contiguous; under the repo's own policy ("noqa = accepted escape. Extract only at natural seams"), filter/project-vs-reduce is the textbook natural seam, so C is the sanctioned end-state rather than a workaround. The Arbiter recorded a dissent: a strict golden-conservatism reading favors B (zero structural drift); the policy text decided it for C.
- **Winner:** Snippet C (Readability challenger), replacing `caos/server/engine/edgar_cp1.py` → `_annual_series` (lines 90–132 at HEAD `50d615d4`) with `_annual_point` + a nine-line `_annual_series`.
- **Justification (Arbiter):** (1) the reduction (latest-`filed`-wins per year, keep last `max_years`) becomes legible in nine lines instead of being buried under ~25 guard lines; (2) the two previously-tribal assumptions (the 350–380 window's why; "ISO `filed` strings compare chronologically") are now written where they protect future editors from "fixing" them; (3) the noqa retires legitimately — both new complexities clear the ≤10 gate with headroom, and `_annual_point` is independently unit-testable.
- **Final code:** —

```python
# ── Pure XBRL parsing (unit-tested, no network) ──────────────────────────────
def _annual_point(e: dict, kind: str) -> Optional[Tuple[int, str, float, str]]:
    """One XBRL fact → ``(end_year, filed, value, accession)``, or None if it
    is not a usable annual point. Guards, in order:

    - annual report only: form ``10-K*`` (amendments included), fp ``FY`` —
      companyfacts mixes 10-Q points into every concept;
    - a parseable ``end`` date (its year keys the series);
    - flow points need a ~full-year span (350–380 days covers 52/53-week
      fiscal calendars): a 10-K also carries Q4-stub and cumulative durations
      under fp FY, and those must never pose as a fiscal year. Instant facts
      carry only ``end`` — any point with a ``start`` is a duration, skip it;
    - a finite value, via ``is_finite_number`` (not a bare isinstance):
      edgar._get_json uses the default json decoder, which parses NaN/Infinity
      tokens — a plain isinstance passes them (and ``bool(NaN)`` is True),
      leaking a non-finite value into every CP-1 series and on into e.g.
      interest_coverage_ltm. Reject at the parse boundary per the CLAUDE.md
      invariant. (confidence-review 2026-07-01)
    """
    if not str(e.get("form", "")).startswith("10-K") or str(e.get("fp", "")) != "FY":
        return None
    start, end = e.get("start"), e.get("end")
    if not end:
        return None
    try:
        end_d = date.fromisoformat(end)
    except ValueError:
        return None
    if kind == "flow":
        try:
            span = (end_d - date.fromisoformat(start or "")).days
        except ValueError:  # missing or malformed start
            return None
        if not (350 <= span <= 380):
            return None
    elif start:  # instant facts carry only `end`
        return None
    val = e.get("val")
    if not is_finite_number(val):
        return None
    return end_d.year, str(e.get("filed", "")), float(val), str(e.get("accn", ""))


def _annual_series(units: Sequence[dict], kind: str, max_years: int = 5) -> Dict[int, Tuple[float, str]]:
    """Annual values keyed by the period's **end year** → (value, accession).

    Annual-report points only (form 10-K*, fp FY); full-year spans for flow
    items, fiscal year-end balances for instants — ``_annual_point`` owns those
    guards. Keys by the value's own period end (not the filing ``fy``, which
    would collapse a 10-K's comparative years). Restatements supersede:
    latest-filed wins per year (ISO ``filed`` strings compare chronologically).
    """
    best: Dict[int, Tuple[str, float, str]] = {}
    for e in units:
        point = _annual_point(e, kind)
        if point is None:
            continue
        year, filed, val, accn = point
        prior = best.get(year)
        if prior is None or filed > prior[0]:
            best[year] = (filed, val, accn)
    return {year: (val, accn) for year, (_filed, val, accn) in sorted(best.items())[-max_years:]}
```

- **Verification (Orchestrator, scratch copy — actual outputs):**
  - Differential harness (written by the Orchestrator: 17 directed cases — span 349/350/380/382 boundaries, instant-with-start, NaN/inf/bool/str vals, bad ISO dates, missing end, 7-year trims, filed races incl. equal and missing filed — plus 400 seeded random unit-lists, × flow/instant × max_years {5,4,2}, repr-exact) → **`OK: 2502 comparisons, 0 mismatches`** against the pristine original.
  - `pytest caos/tests/server/test_edgar_cp1.py caos/tests/server/golden/test_golden_cp1.py caos/tests/server/test_distress.py -q` → **`36 passed, 1 warning in 2.03s`** (VSAT `4.47` / FUN `1.23` golden values and zones unmoved).
  - `ruff check` (repo config) → `All checks passed!`; C901 ≤10 probe → `All checks passed!`; measured: `_annual_point` **9**, `_annual_series` **4**; `grep -c "noqa: C901"` on the winner build → **0** (the marker is retired, not relocated).
  - Scratch restored to pristine afterward; diff recorded at `scratchpad/t4_winner.diff` (109 diff lines).

### Tournament budget accounting

Four tournaments ran (the §4C floor of the 4–8 budget), producing three verified
winners and one reasoned Incumbent hold. Candidates that earned consideration but
were **deferred without a tournament** (findings stand on their own): 
`covenants.derive_covenant_terms` (noqa C901 — same retirement pattern as T4 would
likely apply), `querygraph._trend`/`_head_to_head` (better addressed by the filed
currency-unit fix than by a form rewrite), `model_engine_v2.ModelEngineV2.calculate`
(an ~800-line method whose verification surface exceeds what a scratch-copy
tournament can responsibly prove), `runner.execute_run` (session-object entangled),
and `compute_stress_snapshot`/`compute_portfolio_analytics` (C901 21/16 baseline
debt — natural next targets for the T1 pattern).

## Not findings

- **RV screening's "actionable" classification is currently unreachable** (`routes/rv.py` → `create_rv_screen` always appends `"risk-budget consumption"` to `missing_gates`, and `classify_candidate` returns "screen-only" whenever gates are missing) — this reads like a bug but is the documented decision-safety design ("every other unresolved dependency is screen-only, never actionable"); ratification 409s until the risk-budget lane exists, which is fail-closed, not wrong.
- **`report_exports` accounting number-format renders a genuine `0.0` as `"-"`** — visually identical to the None-dash, but the stored cell value stays `0.0` and `None` stays blank; data intact, display-only, flagged in the G3 verdict for visibility.
- **`adapt.ts` multiplies `addback_cap_pct` by 100 but not `utilization_pct`** — looks like a percent/fraction bug; verified correct against the backend contract (the former is emitted as a 0–1 fraction, the latter in percent magnitude).
- **Portfolio stress overflow asymmetry** (`engine/portfolio.py` → `compute_stress_snapshot`): a per-position combined-shock overflow skips the position out of stressed NAV while base NAV keeps it (loss overstated) — but both shock inputs are bounded to [−100, 100] and finite-validated at the route boundary (`routes/portfolios.py` → `StressInput.finite_book_shock`/`finite_sector_shocks`), so the operands cap at |200| and the overflow arm is unreachable. Engine-side inconsistency exists but no input can exercise it.
- **`periods.latest()` passes NaN through** — by design (documented; REVIEW_MATRIX_BACKEND BE-1 register): every consumer found this session re-gates with `is_finite_number` (metrics, synth grounding, capstructure via `latest_annual`+guards, liquidity, macro, adjusted).
- **RCF participates in the recovery waterfall at rank 0 and pari-passu is pro-rata within rank** — documented limitation flag in the CP-3B payload; recorded accepted-by-design (WATERFALL-IC).
- **Negative net debt improves coverage under rate shock** (`macro.compute_rate_sensitivity`) — intentional and documented in the docstring ("Symmetric and intentionally UNGUARDED").
- **Golden FUN leverage 8.09x exceeds the 8.0x sanity band** — by design; `leverage_magnitude_finding` is lane-aware (MINOR on deterministic lanes) precisely for this.
- **`interest_coverage_ltm == 0` echoes as `base_interest_coverage` 0 while `base_interest_musd` is None** (`macro`) — documented asymmetry ("coverage 0 is a real disclosed read").
- **`_ebitda_proxy` impairment add-back only when operating income is negative** — deliberate, documented gate (#26/#27), matches the Six Flags case.
- **textscan `_AMOUNT` does not recognize "thousand"** — unlike the old ENG-4 bug this *degrades* (no amount captured → qualitative hit, quantum null), never mis-scales; acceptable by the "degrade, never guess" convention.

---

*Checkpoint log and per-group verifier results tracked in `caos/docs/.triage-notes.md`.*
