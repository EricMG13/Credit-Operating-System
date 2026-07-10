# CAOS Confidence Audit — 2026-07-10

_Full-depth confidence audit of the shipped system: every FastAPI route, every
implemented engine module (CP-0 … CP-6E + QA phase), the five UI concepts plus
Monitor and Ask, the Modular OS corpus cross-check, and the Docker deploy path.
Method: outward edges read first (endpoints, pages) and traced back through
engine → period/data model → corpus spec; eight parallel subsystem readers
enumerated low-confidence points; every load-bearing claim was then re-verified
against the cited source lines (and, for the extractor findings, reproduced by
executing the extraction code read-only against realistic filing text). This
audit follows and builds on `CONFIDENCE_AUDIT_2026-06-26.md`; §12 reconciles
that audit's 36 findings against today's code._

_Deviation note: CLAUDE.md mandates GitNexus `impact`/`detect_changes` for all
work in this repo, but no `.gitnexus/` index exists in the tree and no GitNexus
MCP tools are registered — the mandated tooling cannot run here (see META-1).
Call-graph tracing was done by exhaustive grep + reading instead. This audit
changes no code; the only tree change is this document._

**Verdicts** — every item was pushed to one of:
`CONFIRMED BUG` (exact failing input/state + user-visible consequence stated) ·
`CONFIRMED CORRECT` (specifically why) ·
`UNDERDETERMINED` (a product decision was never made; stated which).
**Severity** — CRITICAL / MATERIAL / MINOR, judged for money-critical analyst
tooling. **[NEW]** = not in the 2026-06-26 audit.

---

## Executive summary — what I would fix before trusting a committee read

| # | Finding | Verdict · Severity |
|---|---------|--------------------|
| ENG-1 | Altman Z″ adds the EM-Score +3.25 constant but zones on the no-constant 1.1/2.6 cutoffs — every issuer scores ~3.25 too safe; most stressed LBO balance sheets read "safe" | BUG · **CRITICAL** |
| ENG-2 | Reported-CP1 extractor captures "increased by £X to £Y" as the *level* — EBITDA/revenue understated 10–60×, silently poisoning CP-3B recovery EV | BUG · **CRITICAL** |
| FE-1 | No UI path creates a run (`createRun` has zero call sites) while the upload wizard tells the analyst a "run queued" — the platform's core loop dead-ends | BUG · **CRITICAL** |
| FE-8 | Anchored Model Builder renders live EBITDA ÷ Atlas-Forge fixture interest as "Interest Coverage" under a green "CP-1 LIVE" badge (the plumbed live coverage figure is never consumed) | BUG · **CRITICAL** |
| ENG-3 | YoY delta divides by signed prior — a doubling loss prints "+100% grew" and the deterioration monitoring signal is suppressed (reachable on the deterministic EDGAR path) | BUG · MATERIAL→CRIT for loss-makers |
| QA-1 | The graceful citation-downgrade path emits `lineage_class="Inferred"` (not in the 8-value enum) → schema validation hard-blocks the module — for CP-1, effectively the whole live run | BUG · MATERIAL (availability) |
| DEP-1 | `postgres:18-alpine` + volume mounted at the pre-18 path — the PG18 entrypoint detects the legacy mount and **aborts on first boot**: the flagship compose stack is dead-on-arrival | BUG · MATERIAL (launch blocker) |
| SPEC-1 | Live CP-2 (FundamentalCreditSynthesizer) is dependency-layered beside CP-1A/1B/1C, so it synthesizes with only CP-1 upstream — starved of 3 of its 4 spec-declared feeds | BUG · MATERIAL |
| LLM-2 | A fabricated-but-internally-consistent live figure whose citation can't resolve draws only a MINOR CP-5B finding → lands as a **Passed**, `provenance="run"` MetricFact ranked in cross-issuer query | BUG/UNDERDET · MATERIAL |
| FE-2..7 | Command Center research lens, Monitor, sector review and coverage "RE-RUN" simulate liveness over canned data without the sample label the CIO lens carries; the one genuinely live board mis-colors Restricted runs, never refreshes, and has no evidence path | BUG cluster · MATERIAL |

The trust boundary (Caddy → oauth2-proxy → edge-secret → identity) **held**
under adversarial review — no CRITICAL/MATERIAL auth or tenancy finding. The
`is_finite_number` convention is applied with impressive consistency: **zero
NaN/±inf poisoning paths were found**. The confirmed engine bugs are one level
up — *semantically wrong finite values* (wrong operand picked by a regex, wrong
sign admitted by a truthiness gate, wrong scale/period/basis assumed) that the
finiteness discipline cannot catch.

---

## §1 Deterministic engine — CP-1 ingestion and foundation

**ENG-1 · CONFIRMED BUG · CRITICAL · [NEW]** — `engine/distress.py:88` vs `:26-27` (verified directly).
The implemented score is `3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4` — the
EM-Score variant — but `SAFE_CUTOFF/DISTRESS_CUTOFF` are 2.6/1.1, the published
zones for the Z″ **without** the constant (the docstring pairs them on adjacent
lines). Everything downstream repeats the wrong legend: the metric catalog
(`engine/metrics.py:53-55`) and the profile UI coloring
(`ProfileContent.tsx:148`, `v < 1.1 → critical, < 2.6 → warning`). Failing
input: CA=CL=500, TA=2000, RE=−100, EBIT=100, TL=1800, BE=200 → shown Z=3.54
"safe"; correct Z″=0.29 "distress". Any issuer whose weighted-ratio sum lies in
(−0.65, 1.1) — most stressed LBO balance sheets, the platform's core universe —
reads "safe"; "distress" requires a sum below −2.15. No corpus spec authorizes
either pairing (no Altman reference exists anywhere in `Modular OS/`), so the
standard published definitions govern. Consequence: a systematically optimistic
headline distress signal on every scored issuer, silent.

**ENG-2 · CONFIRMED BUG · CRITICAL · [NEW]** — `engine/reported_cp1.py:50-53` (verified directly; reproduced by execution in the sub-audit).
`_EBITDA_AMOUNT`/`_REVENUE_AMOUNT` bind the **first** currency amount within
40–80 chars after the keyword. Ubiquitous earnings-release phrasing —
"Total revenue increased by £46.9 million to £2,770.5 million", "Adjusted
EBITDA grew by £12.3 million to £963.4 million" — captures the *change*
(46.9 / 12.3) as the disclosed *level*. The wrong value is finite and
plausible-looking, so the finiteness guards pass it into: headline MetricFacts
(basis `reported_disclosure`), the CP-1 claim text, and — worst —
`capstructure._distressed_ev` (EV = 5 × 12.3 = $61.5M instead of ~$4.8bn),
collapsing every CP-3B tranche recovery toward 0% at High confidence. The
leverage plausibility cross-check cannot catch it (reported CP-1 carries no
`net_debt_ltm`, so it is skipped by design).

**ENG-4 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/reported_cp1.py:50,94-95` (verified directly).
An amount with **no scale token** is taken as-is and labelled $M ("Adjusted
EBITDA of £963,400,000" → 963,400,000 "million"); `thousand`/`'000` (routine in
UK/IFRS statutory accounts) is not a recognized scale (→ £963bn-as-millions).
Silent into CP-3B EV and the metric store; the absurd magnitude is visible only
if an analyst reads the claim text.

**ENG-5 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/reported_cp1.py:45-47` (verified directly).
The fallback leverage pattern makes `net` optional, so "Gross leverage was
6.8x …; net leverage was 5.7x" publishes **6.8 as "net leverage"** (first match
in document order wins) into `net_leverage_adj_ltm` → CP-4C headroom and the
store. Basis mislabeling with a concrete reproducer.

**ENG-6 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/reported_cp1.py:54,96-98` + `engine/capstructure.py:123-126`.
A quarterly disclosed EBITDA is stored under a `"Q1"` key and then consumed by
CP-3B as **LTM** EBITDA for the 5.0× distressed-EV multiple ("5x LTM EBITDA" in
the printed waterfall basis while the operand is one quarter → EV and every
recovery % understated ~4×, silently). The `_PERIOD` proximity window is also
noise-prone (a neighboring "ANNUALISED" token can become the period label of an
unrelated series).

**ENG-7 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/edgar_cp1.py:225-229`.
Net debt sums only the recognized concept lists; a filer that tags current debt
as `NotesPayableCurrent`/`CommercialPaper`/finance-lease concepts (all outside
`_DEBT_CURRENT`) contributes **$0 silently** — leverage understated (repro:
6.51x shown vs 7.67x true) with **no limitation flag** (staleness of *present*
legs is flagged; absence of a leg is not). The `.get`-default-0 class the audit
brief targets. Overstates covenant cushion downstream — the non-conservative
direction.

**ENG-8 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/capstructure.py:123-126,152-156` (gate verified directly).
`_distressed_ev` gates EBITDA by `is_finite_number(eb) and eb` — truthiness,
not `> 0`. A **negative** latest EBITDA (legitimately produced by the EDGAR
proxy for loss-makers: op income + D&A can be negative) yields
`distressed_ev_musd: -4821.5`, an all-0% recovery ranking, `confidence:
"High"`, and **no limitation flag** — precisely the distressed case where the
recovery read matters most. The zero-EBITDA degrade path exists and works;
negative skips it.

**ENG-3 · CONFIRMED BUG · MATERIAL (CRITICAL for loss-making names) · [NEW]** — `engine/earnings.py:33-35` (verified directly).
`_yoy` divides by the signed prior with only a zero-guard. Negative-base cases
invert: EBITDA {FY24: −100, FY25: −200} → "**grew 100%** YoY" and the
deterioration branch (`ebitda_yoy < 0` → monitoring signal → CP-1B finding →
CP-2C catalyst) is **suppressed**; an improving loss reads "declined". This is
CP-1B — the "what changed" module — and it is reachable on the fully
deterministic EDGAR path. Additionally (MATERIAL): `_yoy` takes the last two
value-bearing rows, so the shipped fixture series (…FY25, LTM_Q1_26) computes a
3-month roll between two windows sharing nine months and labels it "YoY"
(~4× understated growth); with sparse series the printed period labels can
match neither delta (MINOR).

**ENG-9 · CONFIRMED BUG · MATERIAL (borderline CRITICAL) · [NEW]** — `engine/liquidity.py:119-122` + `engine/textscan.py:45-72` (clause logic verified directly).
On the canonical 10-K liquidity sentence — "we had $200.0 million of cash and
cash equivalents and $500.0 million of availability under our revolving credit
facility" — forward-preference binds **cash = $500M** (the revolver's figure;
the true $200M precedes the keyword) and the revolver keyword back-binds the
same $500M: disclosed liquidity $1,000M vs true $700M, runway inflated pro
rata, at High confidence. Separately, the `revolv` pattern records a **fully
drawn** facility as "Undrawn revolving credit facility" — expressly prohibited
by CP-2E ACTIVE_PROMPT Prohibited Behavior #9. (This is the *successor* defect
to prior-audit [02]: the clause-bounding fix genuinely repaired the multi-
tranche paragraph case, but the after-first preference creates this new
misbinding on amount-before-keyword phrasing.)

**ENG-10 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/covenants.py:46-54` (regex verified directly).
The incremental-facility extractor's own comment claims an interposed figure
"degrades to None … rather than a wrong number" — false: the non-greedy
first-amount pattern returns a figure sitting between keyword and basket
("incremental term loans, subject to an arrangement fee of **$2.5 million**, in
an aggregate principal amount not to exceed $250 million" → basket = $2.5M,
`exact=True`, Directly-Sourced/High). Same structure in the RP-basket and
cross-default patterns. Committee-facing capacity claims and pro-forma leverage
can carry the wrong quantum with strong provenance.

**ENG-11 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/covenants.py:250-256` vs `:160-167`.
The **LLM** covenant-extraction path applies no domain clamp to
`leverage_covenant_x` (only `> 0`), while the deterministic path clamps to
1.0–12.0. A model misreading "5.75:1.00" as `575` flows into headroom/cushion
math → "leaves 569.32 turns of headroom". The add-back-cap field in the same
function demonstrates the intended clamp discipline; the threshold and
$-baskets lack it. (`llm_safety.py`'s "clamped downstream" claim is false for
these fields.)

**ENG-12 · CONFIRMED BUG · MATERIAL · (prior [19] adjacent, distinct) · [NEW]** — `engine/macro.py:87` vs `Modular OS/CP-2F` REF-05.
The +100bps shock is applied to **net debt**; the spec formula is **unhedged
floating-rate debt** × 1.00%. For a cash-heavy issuer (gross 2,000, cash 1,500)
the impact is understated 4× while the payload asserts "Assumes 100%
floating-rate and unhedged" — a conservatism claim that is false in exactly
that case. Root cause is a data gap (CP-1 carries no gross-debt figure);
resolving it is a product/data decision, but today's label misstates the math.

**ENG-13 · CONFIRMED BUG (live-LLM path) · MATERIAL · [NEW]** — `engine/downside.py:75-95`.
Negative leverage (only producible by a live LLM CP-1; deterministic paths
gate/bound it) always lands **fragility = LOW** at High confidence
(−10/(1−s) < 7.0 for every shock), and cascades into CP-3D (leverage driver
silently dropped → LME risk LOW/MODERATE). The held-flat-debt algebra has no
valid meaning for non-positive EBITDA; it should degrade to Insufficient.

**ENG-14 · UNDERDETERMINED · MINOR (set)** — remaining slice items, each with an
exact location in the sub-audit record: per-payload `currency` taken from
whichever series matched first (`reported_cp1.py:196-209`); FY-derived EDGAR
figures published under `*_ltm` contract keys and projected with
`period="LTM"` (`edgar_cp1.py:254-257`, `metrics.py:186-187`); negative
`InterestExpense` sign errors passing the truthiness gate into a negative
coverage headline; >100% cushion text for net-cash leverage
(`covenants.py:368-370`); no-debt-tags EDGAR case gets no "leverage not
derived" limitation (`edgar_cp1.py:379-388` — MINOR CONFIRMED BUG);
`derive_energy_cost_pct` unclamped (0,100] (`metrics.py:274-276`); unguarded
sibling-field interpolation in `reconciliation_finding` text
(`adjusted.py:230-238`); `budget.record_usage` sits outside the "never break
the call path" guard its docstring promises (`budget.py:107-116`).

---

## §2 Engine — cross-cutting numeric-core items

**ENG-15 · CONFIRMED BUG · MATERIAL · [NEW]** — `run_executor.py:201-231` (verified directly).
The QueueWorker lease is a fixed 600s with **no heartbeat**, and `_claim_one`
selects on DB state alone — it does not exclude the worker's own in-flight
runs. A run legitimately exceeding 10 minutes (MAX mode: ~6–7 dependency
layers × 120s LLM timeout × SDK retries, plus council) is re-claimed **by the
same worker** and executed twice concurrently: races on the
`uq_run_module` unique inserts, double token spend, and the loser's
`_mark_run_failed` can flip an already-completed run to `failed`. The code
comment ("lease … longer than any plausible run") is an unenforced assumption.

**ENG-16 · CONFIRMED BUG · MATERIAL · [NEW]** — `runner.py:419,471-484` + `engine/metrics.py:194-214` (verified directly).
Module synthesis is per-module fault-isolated; the post-QA phase is not.
`extract_cost_facts` converts with `float(val)` guarded only by `is None`
(violating the repo's own `is_finite_number` convention — contrast the
exemplary `add()` guard at `metrics.py:140-152`), and
`leverage_plausibility_finding`/`extract_facts` assume `normalized_financials`
is a dict of dicts. One malformed live payload shape (`energy_cost_pct:
"12%"`, or `normalized_financials` as an array) throws inside `execute_run`'s
outer try → the **entire completed run** is rolled back and marked failed at
the final step. Low likelihood (pinned tool schemas steer the model), whole-run
blast radius, fail-closed direction.

**ENG-17 · CONFIRMED BUG · MINOR · [NEW]** — `engine/llm_safety.py:38-56` (reproduced).
`loads_finite` rejects `NaN`/`Infinity` **literals** but not overflow numerals:
`json.loads('1e999')` → `inf` without invoking `parse_constant`. The forced-
tool path is safe by accident (`dumps(inf)` re-emits the literal, which is then
rejected); the exposed lane is synth's rare text-JSON fallback, after which an
`inf` would pass `validate_payload`, persist, break strict-JSON API responses,
and reach `debate._leverage`'s bare-isinstance read ("high at infx net"). The
docstring's guarantee ("a non-finite literal can never reach a financial
field") overstates the implementation. Related MINOR: `catalysts.py:39`,
`debate.py:87`, `portfoliofit.py:56` use the banned bare-`isinstance` pattern —
unreachable today only because every producer path was traced clean.

**ENG-18 · CONFIRMED BUG · MINOR · [NEW]** — `engine/periods.py:38-64` (verified directly).
Two "most recent" semantics coexist: `latest()` ranks a year-less label (bare
`"LTM"`) as **oldest** (year −1) while `_headline_period()` prefers it. Only a
live-LLM CP-1 emits such labels; consequence is a wrong-period EBITDA inside
the leverage plausibility cross-check (spurious or masked MATERIAL finding).
`_intra_year_rank` also has no `H1`/`H2` case — "H1 2025" ranks 4.0, above
"Q3 2025" (H-labels are reachable: `reported_cp1._PERIOD` recognizes them, LLM
labels are free-form; today's reported series are single-key so it is latent).

**ENG-19 · CONFIRMED CORRECT (cleared set)** — verified directly or by executed
repro in the sub-audits, listed so the clean bill is auditable:
`is_finite_number` semantics and TypeGuard; `year()` width normalization (prior
[01] fix present and correct); every `latest()` consumer re-gates finiteness
(adjusted, capstructure, metrics, macro, liquidity); Altman input guards +
positive-denominator gates; `recovery_waterfall` claim-sized guards and
unsized-senior latch; `pct_of_structure` zero-total degrade; EDGAR XBRL parse
boundary rejects non-finite; EDGAR leverage gate (zero/negative EBITDA, net
cash, stale legs); `adjusted.py` reconciliation guards (`0<pct<1` NaN-safe,
`ebitda_excl<=0` degrade — the "pct→1" convention done right) and its
reported-basis skip in the runner (prior [00]/[10] fix present); covenant
utilization divides; `cp1_leverage`; liquidity runway guards (b)/(c); macro
`_finite` chain; peers percentile/margin guards and polarity flags; relval
non-empty-ranked divide; refinancing finite gates (exemplary); earnings
non-finite coercion; council severity normalization (unknown → MINOR,
escalate-only peer round); registry import-time validation; runner layer
fault-isolation (prior [05] fixed) and cumulative re-claim budget (H-1).

---

## §3 QA gate, lineage and committee integrity

**QA-1 · CONFIRMED BUG · MATERIAL (availability, fail-closed) · [NEW]** — `engine/adjusted.py:202`, `engine/covenants.py:348,399,420,433,483` vs `engine/schemas.py:34-37` (verified directly).
All six citation-downgrade sites emit `lineage_class="Inferred"` — not in the
8-value `LINEAGE_CLASSES` enum (the intended value is `"Analyst Inference"`).
`validate_payload` rejects it and `_persist_synth_result` marks the module
**Blocked** with a CRITICAL lane-7 finding. The branch fires exactly when
designed to *degrade gracefully*: live mode, extractor model returns a term
whose chunk id doesn't verify (`safe_chunk_id` → `exact=False`). For CP-4C the
module blocks (then CP-6A/6E input-gate); for `adjusted.py` the claim is
appended to **CP-1** before validation, so the whole run effectively blocks.
`tests/server/test_covenants.py:311` asserts the invalid value, pinning the bug
in isolation from `validate_payload`. No wrong numbers (fail-closed), but the
flagship live path dies on a vocabulary error its own design intended to
survive.

**QA-2 · CONFIRMED BUG · MATERIAL · [NEW]** — `runner.py:634-654` + `engine/lineage.py:36`.
The live-path auto-anchor suppression covers only
`{sourced_fact, quoted_text, table_value}` — 3 of 13 extraction types. A live
model emitting `documentary_fact` + `"Directly Sourced"` (a combination the
codebase itself uses legitimately) gets its evidence back-filled with the top
BM25 hit **for the claim text** (locator never reconciled) and passes CP-5B
with no finding — the model's *choice of extraction_type* decides whether the
anti-fabrication check applies. Click-to-source then presents a real but
possibly unrelated chunk as the direct source, certified by the audit lane.

**QA-3 · CONFIRMED silent drift · MATERIAL · [NEW]** — `engine/lineage.py:26-34` vs `Modular OS/CP-5B` REF-06 / SYSTEM_REFERENCE.
Spec severity is **impact-conditional** ("Critical if the conclusion affects
economics, legal meaning, recommendation, sizing, PD/LGD/recovery…"); the
engine maps severity as a **fixed function of lineage class**
(Untraced/Weak/Conflicting → always MATERIAL; Assumption-Based/Inference/II →
always MINOR). An untraced claim that changes the recommendation must be
Critical → Blocked under spec; the engine yields Restricted. The orphan-claim
trigger set also differs from spec VE-015, and an unresolved *sourced* citation
is capped at MINOR (interacts with LLM-2). Unlike CP-5, CP-5B carries no
"as-shipped" simplification note — this drift is undocumented.

**QA-4 · CONFIRMED BUG (disclosure) · MATERIAL · [NEW]** — `runner.py:699-731` + `engine/council.py:105-130`.
`_persist_cp5c` always writes a `qa_status="Passed" / committee_status=
"Committee Ready" / confidence="High"` SemanticCommitteeReview record. With the
council **enabled**, a budget-exhausted review (`return []`) or an all-seats-
failed review (exceptions swallowed per-seat) persists `enabled: true, seats:
N, findings: all-zero` — indistinguishable from "reviewed and clean". The CP-5
corpus note's own standard ("not assessed, not passed") is violated by this
record. The disabled-by-default zero-seat pass is a documented product
decision (UNDERDETERMINED whether "Committee Ready" should be reachable with
zero semantic review at all). Related MINORs: peer-round electorate shrink can
let a single reject drop a CRITICAL finding; unknown seat `module_id` drops the
finding with only a log line.

**QA-5 · CONFIRMED doc/code mismatch · MATERIAL · [NEW]** — CP-5 lane inventory.
The corpus "as shipped" note claims deterministic lanes = {2,5,6} and
council-only = {1,3,4,7,8}. Actual code: deterministic emits lanes 1,2,3,6,7;
**no deterministic lane-5 (cross-module) check exists**; the council covers
2,3,4,5; **lane 8 (Export) is assessed by nothing under any configuration**;
council seat lane numbers don't match spec lane semantics, so persisted
`QAFinding.lane` values misdescribe which audit lane fired.

**QA-6 · MINOR set · [NEW]** — CP-5 clearance strings `PASSED/CONDITIONAL/
BLOCKED` are off-taxonomy (spec: Pass / Pass with Remediation / Fail);
`_persist_blocked`'s CRITICAL GATE findings bypass the `findings` list, so a
CP-5 payload can read `clearance: PASSED, CRITICAL: 0` while the run is
Blocked (the QAFinding table and `/qa` route stay consistent — the module
payload is the contradiction); `report._NON_CONTENT` excludes CP-5/CP-5B/CP-X
but **not CP-5C**, so the committee pack includes the review process record as
a content section; `committee_status_from` maps Low confidence → "Committee
Ready" and the taxonomy's "Requires More Work" is never produced by any rule
(UNDERDETERMINED — no assignment rule was ever specified).

**QA-7 · UNDERDETERMINED (product decision, documented in code) · MATERIAL** —
fabricated-for-this-issuer fixture financials (keyless run, non-demo issuer)
are graded MATERIAL → **Restricted**; the corpus escalation rule for
"fabricated … claim in committee-facing output" is Critical → **Blocked**. The
#10 flagging chain (finding + limitation + `demo_fixture` provenance +
`model_id="fixture"`) is real and loud — but the gate outcome contradicts the
corpus severity trigger and deserves an explicit ruling.

---

## §4 Orchestration and Modular-OS spec drift

**SPEC-1 · CONFIRMED BUG · MATERIAL · [NEW]** — `engine/registry.py:100-102` + `runner.py:101-127,362-365` vs `Modular OS/CP-2/SYSTEM_REFERENCE.md:7` (mechanism verified directly).
Spec: CP-2 `UP: CP-1, CP-1A, CP-1B, CP-1C` ("the L2 hub … four upstream
feeds"). Registry: `depends_on=("CP-1",)` — so `_dependency_layers` co-schedules
CP-2 **beside** CP-1A/1B/1C, and `upstream` is populated only after a layer
completes: live CP-2 synthesizes with **only CP-1** in its UPSTREAM OUTPUTS.
The registry's own comments prove the mechanism was understood and fixed for
CP-2C, CP-3D and CP-6A — but not applied to CP-2. Every live run silently
degrades the core fundamental synthesis; nothing in the payload flags it.

**SPEC-2 · CONFIRMED silent drift · MATERIAL · [NEW]** — `engine/registry.py:92-94` vs `Modular OS/CP-1A/SYSTEM_REFERENCE.md:4` (verified directly).
The corpus line reads `UP: CP-0, CP-X | DOWN: CP-2, CP-2D | CP-1 NOT downstream
(M2 fix)` — the registry declares exactly the repudiated edge
(`depends_on=("CP-1",)`), so a Blocked CP-1 wrongly input-gates CP-1A, which by
spec needs only offering docs. Similarly CP-2B: spec hard-stop is "CP-1 **and**
CP-2 both unavailable" (`CP_CANONICAL_STATE_RULES.txt` SEC4); the engine input
gate blocks on **any** missing dep — spec AND became engine OR.

**SPEC-3 · CONFIRMED drift · MATERIAL · [NEW]** — CP-3B vs `engine/capstructure.py`.
Spec input gates ("Gate 1: CP-3 RV must be available … qa_status = Blocked,
UPSTREAM_DEPENDENCY_MISSING, STOP") are not implemented — CP-3B takes no CP-3
input at all (registry dep: CP-1) and a no-tranche scan returns a gateable
payload, not Blocked. The recovery method is swapped (computed absolute-
priority waterfall off an assumed flat 5.0× EV vs the spec's sensitivity/
preference labels and "do not infer recovery values"); the assumption basis is
disclosed in the payload, **but** the "~X% expected recovery" claim is
evidenced as `quoted_text / Directly Sourced / High` — the module grades its
own 5.0× assumption as a source-quoted fact, so CP-5B sees nothing
(self-favorable lineage on assumption-derived numbers).

**SPEC-4 · CONFIRMED drift · MATERIAL(-leaning) · [NEW]** — registry dependency
edges diverge from the corpus `UP:` lines across most of L2/L3/L4 (verified for
the load-bearing rows): CP-2C (spec UP: CP-2 → engine CP-1/1B/1C), CP-2D (spec
CP-1A+CP-2 → engine CP-1, and `sponsor.py` reads no upstream), CP-2E/2F/3/3D/4
each drop spec feeds, CP-4C drops the CP-4 → CP-4C edge entirely (the capacity
calculator never consumes the covenant interpreter — it re-derives terms from
chunks), CP-6E declares only CP-6A (QA gate X5 "CP-6E depends on CP-3C"
violated in the declared graph). Some are engine-documented simplifications;
none carry a corpus-side "as shipped" note. Also: **CP-DB** (a corpus
route-graph node) is silently absent from the registry — contradicting the
registry docstring's "reflects the full corpus mesh"; **CP-5C** is an invented
module id outside the corpus routing index, persisted on every run (MINOR); the
registry docstring misnames it a corpus module.

**SPEC-5 · CONFIRMED drift · MATERIAL · [NEW]** — `engine/relval.py:56-64` vs `Modular OS/CP-3` REF-05.
Spec: "RV conclusions require dated market evidence. If absent, RV = Unclear."
The engine assigns OVERWEIGHT/UNDERWEIGHT purely from fundamentals percentiles
(no market data exists in the system), and the label propagates into CP-3C
sizing. Deliberate per docstring — but the output label asserts what the
corpus's prohibited-behavior rule forbids, without an "Unclear"/no-market-data
qualifier on the recommendation itself.

**SPEC-6 · MINOR set · [NEW]** — CP-2's registered identity
(`CostStructure`/`cost_structure`) contradicts the corpus payload schema consts
(`FundamentalCreditSynthesizer`/`fundamental_credit_synthesis`) *and* varies by
execution mode (live persists whatever the model types — `validate_payload`
never pins `module_name`/`owned_object`, so the registry's "one-owner check
validates real output" claim is false for payloads); `database.py`'s "maps 1:1
onto 02_SCHEMA" comment overstates (required `validation_warnings` absent
everywhere; envelope fields `period_end_date`/`schema_version` unpersisted;
QAFinding adds fields the canonical `additionalProperties:false` item forbids);
`Run.prompt_version` fingerprints the active prompts honestly but nothing
enforces/pins an approved corpus hash (TOCTOU on mid-run edits; UNDERDETERMINED
whether runs should refuse on an unapproved corpus); CP-SR's registry dep
(CP-2) is not the corpus's upstream set (display-only); `metrics.py` module
docstring still claims energy/fcf metrics are "seed-only" while
`extract_facts`/`extract_cost_facts` project both from runs.

---

## §5 LLM boundary

**LLM-1 · CONFIRMED CORRECT (hardened) — cleared** — malformed-output handling:
forced tool calls with closed enums; `loads_finite` round-trip on the tool path
(closes the OpenRouter plain-`json.loads` hole); truncation detected; exactly
one budget-gated repair then SynthesisError → Blocked with CRITICAL finding;
extract lanes degrade to regex; council/nlquery/scenario parse defensively.
Secrets: keys never logged/echoed/sent to the frontend (verified). Injection
posture: `UNTRUSTED_RULE`/`wrap_untrusted` on every document-grounded lane;
`safe_chunk_id` blocks citation-pointer fabrication; residual honestly
documented in-module ("blast radius … a wrong-but-in-range figure").

**LLM-2 · CONFIRMED BUG / UNDERDETERMINED · MATERIAL · [NEW]** — the residual
that matters: a live CP-1 emitting a fabricated but internally-consistent
figure whose citation can't resolve draws only the **MINOR** "unresolved
sourced citation" CP-5B finding (`lineage.py:9`) → module **Passed** → the
figure lands as a `provenance="run"` MetricFact ranked in cross-issuer NL
query. No numeric reconciliation against source text exists for anything
except leverage (±5%). Combined with QA-2/QA-3, the anti-fabrication net has
MINOR-sized holes on exactly the committee-facing path. Whether instructional
defenses + spot cross-checks are the accepted posture is a product decision;
the severity cap is not documented anywhere.

**LLM-3 · CONFIRMED BUG · MATERIAL (ops) · documented-but-foot-gun** —
live-vs-fixture gates solely on `ANTHROPIC_API_KEY` (`synth.py:622-625` et
al.). A deployment configured with only OpenRouter/Gemini keys — which the
tier defaults actively point at — runs the **entire engine on fixtures and
demo replies** (flagged per the #10 chain, so loud in output, but the operator
intent is silently inverted). Config comment documents it; the deploy runbook
does not. Related MATERIAL (DEP-2): `google-genai` is in `requirements.txt`
but **absent from `requirements.lock`** — the shipped image cannot import the
Gemini adapter at all; CI installs requirements.txt (not the lock), so
`test_gemini.py` passes against packages the image doesn't contain.

**LLM-4 · CONFIRMED BUG · MINOR · [NEW]** — `nlquery.py:460-476`: the caveat
branch tests a **nonexistent provenance** (`provs == {"derived"}` — facts carry
run/seed/fixture/demo_fixture), so it is dead code, and no caveat fires when a
ranking's values are all fixture/demo_fixture (per-row provenance fields do
travel). Frontend counterpart under FE-13.

**LLM-5 · MINOR set** — budget-exhausted extract lanes fall back to regex
silently (payload doesn't record which path produced the figure);
debate narration substitutes deterministic prose on live failure with no
narrator provenance field; `run.model_id` stamps the heavy-lane model even when
CP-1 actually came from the deterministic EDGAR path (reproducibility metadata
overclaims).

---

## §6 Frontend — live-state and showcase surfaces (Command Center, Pipeline, Monitor, directory)

_Framing: PHASE2_SCOPE.md documents the "Sample portfolio — not live" posture
for the CIO lens; market-data fields are declared Phase-2. The findings below
are where the showcase leaks past its own label — on exactly the surfaces the
secondary personas (PM/CIO, Head of Research) scan._

**FE-1 · CONFIRMED BUG · CRITICAL (workflow) · [NEW]** — no UI path creates a run (verified directly: `lib/api.ts:197-200` `createRun` is annotated "kept ahead of its UI consumer" and has zero call sites), while the upload wizard's completion panel asserts "`{mode} run queued`" (`components/upload/steps.tsx:331-332`, verified). The analyst's core loop — upload → analyze → review — dead-ends: Pipeline says "Start a run from Document Intake"; Document Intake has no run-start control and its claim of a queued run is false. Every live surface stays empty for every new issuer unless someone POSTs `/api/runs` by hand.

**FE-2 · CONFIRMED BUG · MATERIAL · [NEW]** — the one genuinely live board mis-renders QA status: `LiveCoverage.tsx:24-27` colors key on `Pass`/`Ready with Limitations`/`Blocked`, but the server vocabulary is `Passed`/`Restricted`/`Blocked` (verified both sides) — a **Restricted** run (MATERIAL findings) renders in the same muted default as a clean pass; the unit test hardcodes the wrong vocabulary, pinning the bug. Words travel (not color-alone), but the severity encoding on the flagship live panel is wrong.

**FE-3 · CONFIRMED BUG · MATERIAL · [NEW]** — "● LIVE" is a mount-time snapshot: `usePortfolio` fetches once, no polling/revalidation/visibility handling anywhere in the app (`useLatestRun`-family likewise; the only real poll in the codebase is Deep Research's job loop). A run completing while any page is open never appears without a manual reload — including on the pipeline page whose in-flight copy promises "the route graph populates once it completes". The LIVE rows render no `as_of`, no run id, and no click-through to evidence (both fields are fetched and unused). Errors silently collapse to the sample board with no signal (the issuers directory has exactly the designed degraded-banner for this; Command Center does not).

**FE-4 · CONFIRMED BUG · MATERIAL · [NEW]** — Head-of-Research lens simulates governance state: the coverage matrix / QA queue / source gaps are 100% canned, and the lens note says only "Research QA lens" (accent color) — the explicit "Sample … not live" disclaimer exists on the CIO and RV lenses but not here. The "RE-RUN" control flips an issuer's L1–L6 freshness to all-green via a 2-second `setTimeout` with **no API call**, silently reverting on reload (`views.tsx:737-767`) — fabricated QA-owner state on the persona that owns the CP-5 gate.

**FE-5 · CONFIRMED BUG · MATERIAL · [NEW]** — Monitor is an unlabeled simulation presenting as the live alerting surface: alert counters are functions of a demo sim tick, header KPIs are hardcoded ("Msgs today 105"), timestamps are a fake 09:30-based "ET" clock, and two pages disagree about "Alerts today" because each runs its own sim. The Command-Center chrome links to it titled "**live** CP-MON email intelligence" — CP-MON is spec-only and never executes. No demo/sample label anywhere on the page (its alert issuers are at least fictional names).

**FE-6 · CONFIRMED BUG · MATERIAL · [NEW]** — real borrowers with fabricated credit stats: all 382 PORTFOLIO rows (real FIGIs/borrowers) carry `lev: 0, cov: 0, qa: "clear"` and render as "0.0x" leverage/coverage with green clear QA tags (missing encoded as 0, `toFixed` formatting — against the house missing→"—" rule), plus a fabricated senior-leverage fallback (`lev − 1.1`) and synthetic bid/ask. The "Sample portfolio" label says positions aren't live; it does not license wrong per-name credit stats for real companies. Same class: an **empty-but-healthy** registry silently swaps in this 382-name demo universe with no banner (`issuers/page.tsx:66-68`, verified — the trust banner fires only on fetch *failure*, making the designed "No issuers yet" empty state unreachable).

**FE-7 · MATERIAL/MINOR set · [NEW]** — Sector Review "UPDATE KNOWLEDGE" fabricates a completed research trace (650ms-stepped fake CP-0/CP-MON scan ending "knowledge updated · N sources searched · board stamped", no network call, stamp lost on reload while the board persists — screenshots can show a review that never happened); pipeline deep-links animate the fabricated ATLF RUN #2641 DAG (green PASS events) for the full load window of a *real* issuer's pipeline with no loading state or DEMO badge; live-mode inspector shows "registers inherit from the last full-committee run (#2641)" under a real run; Command Center row-expander is dead (switch-case variable shadowing — `onSelect(sel ? null : key)` passes the literal `"expand"`, so the issuer detail strip is unreachable); header KPIs contradict the table on the same screen ("Watch List 3" vs 38 flagged rows); Ask (⌘K) on real-issuer pages opens the ATLF fixture chat under the user's issuer workflow (header chip does say ATLF; transcript cached under one shared key); run-history dates shift to the UTC calendar day; Settings "Outlook: Not connected" is hardcoded (fetched flag ignored); 404 button mislabeled.

---

## §7 Frontend — analysis surfaces (Model Builder, Deep-Dive, Report Studio, Query/Ask)

**FE-8 · CONFIRMED BUG · CRITICAL · [NEW]** — anchored Model Builder is a live/fixture hybrid under a live badge (core claims verified directly). `applyAnchor` re-bases only revenue/EBITDA/net-debt; interest, tax, debt stack, all quarters and both forecasts remain Atlas Forge fixture data rendered under the real issuer's name with a green "CP-1 LIVE · RUN xxxx" chip. Concretely wrong (not just seeded padding): the grid recomputes **interest coverage = live adj. EBITDA ÷ ATLF's fixture interest** — while the *actual* live coverage figure is plumbed through `ModelAnchor.intCov` and consumed by **nothing** (verified: tests only). The YTD column copies pre-anchor seeded leverage (~5.68x) beside the anchored LTM column — two different "current" leverages adjacent, one real. Formula-bar provenance, tranche pricing, case notes and E-xx evidence chips all resolve to seeded ATLF artifacts rendered as VERIFIED for any issuer. The CSV export brands the artifact "Atlas Forge … RUN #2641" regardless of issuer (MATERIAL, FE-12).

**FE-9 · CONFIRMED BUG · MATERIAL · [NEW]** — committee print pipeline: `@media print` hides only `body > div`, but the app lives in `<main>` — the dark workspace prints alongside the tear-sheet, and Query's PRINT/PDF has no `.print-root` at all (raw dark UI is the print product). The server's gated `exportReport` (409 unless Committee Ready) is **never called by any UI** — the only export paths are `window.print()` and the deliberately-ungated vault export; the printed masthead hardcodes "RUN #2641 · JUN 10, 2026" even when live figures are injected (fetched `committeeStatus` unused); the "Reference template — Atlas Forge fixture" red stamp renders only on the unpaged path — the paged IC memo and Model Appendix print without it; only one of three deliverables carries the QA watermark; analyst-edited cells print indistinguishable from engine figures.

**FE-10 · CONFIRMED BUG · MATERIAL · [NEW]** — cross-issuer state bleed: manual cell overrides and assumptions are stored under issuer-agnostic localStorage keys (`caos-d-overrides`/`caos-d-assumptions`) — overrides typed on ATLF load unchanged on `/model?issuer=<other>` and flow into that issuer's displayed FFO/FCF/coverage; the saved-model load has no cancellation (fast issuer switch can commit A's model onto B's grid); Report Studio edits/omissions are keyed by section **index** with no schema guard (any builder reordering re-attaches an edited figure to a different line). DB-side scoping is correct (per analyst+issuer) — only the browser layer bleeds. Saved payloads are also restored without the sanitize/merge the localStorage path applies — a future assumptions field NaN-blanks the whole forecast (`version: 1` is written and never read).

**FE-11 · CONFIRMED BUG · MATERIAL (regression, commit-attributed) · [NEW]** — live CP-2B downside fragility is fetched, adapted, test-pinned — and **never rendered**: commit `ab4c07d` wired `downside={eng.downside}` into ScenarioPanel; `37c2118` removed it (verified: the sole production call site passes no `downside`). The engine's only issuer-specific stress read on /model is dropped on the floor.

**FE-12 · MATERIAL set · [NEW]** — fixture-corpus internal contradictions that sit in committee-visible tables: two irreconcilable capital structures (2,575 vs 3,270 gross) interleave across Deep-Dive/Model/Reports — a RecoveryTab prints "Total debt 3,270" beside "5.7x" (=7.77x on its own row), a CP-3B step claims its totals "tie to CP-1 net debt within rounding" (they don't, by $695M), CP-2E's liquidity table contradicts its own utilization figure, CP-2F's floating-rate share contradicts its register and its step-note (61% vs 88%); the Credit Snapshot mixes both stacks on one sheet. All fixture data — but these are the numbers the showcase asks a committee to trust, and the prior migration (#F2) was applied to one panel only.

**FE-13 · CONFIRMED BUG · MATERIAL · [NEW]** — `demo_fixture` provenance is unhandled across the NL-query surface: the TS type omits it, the badge logic tags only exact `"fixture"` (demo_fixture falls back to "SEEDED · Illustrative"), the chart color domain omits both, and the server emits no table-level caveat (LLM-4) — while the issuer-profile page marks the *same fact* "FAB / fabricated". Two surfaces disagree about the same number's trustworthiness; the fabricated one renders unmarked where ranking happens. Related MATERIAL (server, slice-C): `querygraph` peer/scatter/percentile/trend lanes select facts with no provenance filter or cue — a fresh keyless issuer renders Atlas Forge's 5.68x/$2.8bn as its own profile in the Query graph; the seed-vs-demo_fixture tie-break is also iteration-order nondeterministic. And the committee-readiness board groups **every historical run**, so one issuer appears under both "Blocked" and "Committee Ready" (MINOR).

**FE-14 · CONFIRMED BUG · MATERIAL (UX) · [NEW]** — LineageFlow (the "defend a number" provenance walk) draws its SVG connectors with percentage coordinates in a viewBox-less SVG — all edges collapse into the top-left ~100px; the default trace view of every provenance walk shows no meaningful lineage edges (the `// SVG percent scale placeholder` comment marks it unfinished).

**FE-15 · cleared set (verified by sub-audit; spot-checked)** — formatting layer is NaN/±Inf-safe (missing → "—" everywhere it's used); client adapters match server payload shapes field-for-field (incl. rv_percentile scale, EDGAR FY-label normalization, reported-CP1 degrade-to-fallback); "latest run" selection is genuinely newest-complete and cancel-safe; EvidenceModal live/fixture separation correct (test-pinned); recovery-tab waterfall math internally correct; static-export routing sound (no dynamic path segments; suspense-wrapped search params); auth gating distinguishes 401 from API-down; status meaning never rides on color alone (FE-2 is wrong-color, not color-alone).

---

## §8 Deployment and durability

**DEP-1 · CONFIRMED BUG · MATERIAL (launch blocker) · [NEW]** — `deploy/docker-compose.yml:14,26`: `postgres:18-alpine` with `db-data:/var/lib/postgresql/data`. Verified against the official image docs and entrypoint source: PG18 moved `PGDATA` to `/var/lib/postgresql/18/docker` (image volume `/var/lib/postgresql`), and the 18+ entrypoint **detects any mount at the legacy path — including a fresh empty named volume — appends it to `OLD_DATABASES` as "unused mount/volume", and aborts with guidance**. As shipped, `docker compose up -d --build` per the README/LAUNCH runbook leaves `db` crash-looping and the app (gated on `db` healthy) never starts: the flagship stack is dead-on-arrival, loudly. Fails safe (no silent data loss), but it also proves the runbook was never end-to-end boot-tested with this image pin — CI's postgres:18 service container has no legacy mount, so CI cannot catch it.

**DEP-2 · CONFIRMED BUG · MATERIAL · [NEW]** — `server/requirements.txt:18` declares `google-genai>=2.10,<3`; `server/requirements.lock` (the only thing the image installs, `--require-hashes`) contains **no google-genai** — the Gemini lane raises `ModuleNotFoundError` at call time in the shipped image if ever configured. CI installs `requirements.txt`, not the lock, so `test_gemini.py` passes in CI against packages the image doesn't ship, and the pinned set is never tested on the shipped interpreter (the lock header says it was compiled under Python 3.11; the image runs 3.14 — any ≥3.12-only dependency would have been omitted at compile time). Unreachable in the stock compose (no Gemini/OpenRouter keys passed — which itself silently reduces the documented DeepSeek/Gemini tier hybrid to Anthropic-only; UNDERDETERMINED operator decision).

**DEP-3 · CONFIRMED BUG · MATERIAL · [NEW]** — `deploy/.env.example:21` ships `ANALYST_SIGNUP_CODE=change-me-private-code` (verified). Compose `:?` rejects only unset/empty; the boot guard's deny-list is `("", "131113")` — the placeholder boots cleanly. Both fill-in checklists (`deploy/README.md`, `LAUNCH_PHASE1.md` §2.3) omit ANALYST_SIGNUP_CODE, so the documented quick-start produces a deploy whose analyst self-registration gate is a **repo-public string** — exactly the condition the guard's own comment says justifies refusing boot. (SSO + email-domain restriction + SSO-email binding keep this MATERIAL rather than CRITICAL.) Contrast: EDGE_PROXY_SECRET/SESSION_SECRET are empty in the example and fail loudly.

**DEP-4 · CONFIRMED BUG · MATERIAL · [NEW]** — the documented rollback (`LAUNCH_PHASE1.md` §7: `git checkout <last-good> && docker compose up -d --build`, "no data migration needed") wedges boot after any migration-bearing deploy: `alembic_version` holds a revision the old image's tree lacks → `upgrade head` raises "Can't locate revision" → lifespan crash-loop. Recovery needs a manual downgrade/stamp/restore, none documented.

**DEP-5 · CONFIRMED divergence · MATERIAL · [NEW]** — `LAUNCH_PHASE1.md` §8 claims the stack "already supports horizontal app replicas". Run claiming is replica-safe (SKIP LOCKED; advisory-locked migrations — both verified), but `research_executor.py:118-124` boot-sweeps **all** `running` research jobs to failed with no worker scoping — a second replica booting kills the first's live jobs — and `rate_limit.py` is per-process (limits multiply by replica count). The code comments admit both; the launch doc's scale posture doesn't.

**DEP-6 · MINOR set · [NEW]** — ops/doc drift, each verified by the deploy
sub-audit: `deploy/README.md` predates the backup service ("four services",
manual-cron backup instructions) and `backup.sh`'s header says postgres:16 vs
compose's 18; `SECURITY.md` is stale in four places (DATABRICKS_APP_PORT
predicate gone; demo-seed "warns" → actually refuses boot; `==production`
predicate → actually any-non-development; EDGE_PROXY_SECRET undocumented while
three files cite SECURITY.md §1 for it); LAUNCH §5's "oauth2-proxy healthy"
checkbox is unsatisfiable (no healthcheck exists); `down -v` also destroys the
`backups` volume (understated); POSTGRES_PASSWORD is interpolated raw into the
SQLAlchemy URL (an `@/#%` character crash-loops the app; no charset guidance);
vault backup tars live writes non-atomically (bounded by next cycle); clamd
ceilings are fixed at 300M while MAX_UPLOAD_MB is tunable past them;
Dockerfile comments name node:20/python:3.11 while pinning node:26/python:3.14.

**DEP-7 · cleared (verified)** — port exposure (only Caddy published; app/db
unreachable; edge-skippable surface is exactly `GET ^/api/health$`, matching
the app-side exemption); secret flow (Caddy strips inbound identity +
edge-auth headers, injects the secret; no WebSocket gap; `.dockerignore`
blocks `.env`/data; placeholders only); `ENVIRONMENT=production` hard-coded in
compose + Dockerfile with the strict any-non-development predicate; a dropped
`DATABASE_URL` cannot silently fall to ephemeral SQLite (read-only rootfs makes
the SQLite mkdir crash loudly); migrations serialize under a Postgres advisory
lock with in-lock re-read, single transaction, reversible chain; static-export
serving (trailingSlash, hashed-chunk immutable caching, no-cache HTML, JSON
404s for /api) — all verified correct.

---

## §9 Trust boundary and API

**API-1 · CONFIRMED CORRECT — the trust model holds (verified directly + route-by-route sub-audit).**
Boot guards fail closed on `is_deployed` (any `ENVIRONMENT != "development"`,
typo/unset included) for EDGE_PROXY_SECRET / SESSION_SECRET / ANALYST_SIGNUP_CODE
/ CAOS_DEMO_SEED. `edge_origin_guard` gates every `/api/*` except `/api/health`
at a single chokepoint (constant-time, bytes-compared), redundantly re-checked
in `get_identity`. Cookie identity: HMAC + mandatory `exp` + `token_version`
revocation + SSO-email cross-check; secure/httponly/samesite. Every data
endpoint authenticates (the only identity-free routes are health + the five
auth establishers). Private data is owner-scoped (ResearchJob, SavedModel,
settings, GDPR self-erasure); shared-desk reads are documented and test-pinned
as a deliberate single-team model. Upload: cap enforced streaming (413 before
buffering past limit), magic-byte sniffing (content-type never trusted), AV
fail-closed, traversal-safe storage keys, list-argv subprocess. EDGAR fetch:
scheme/host/path pinned to `https://www.sec.gov/Archives/`, post-redirect
re-check, size caps — no SSRF. NL-query: closed QuerySpec against the metric
catalog, fully parameterized — no SQLi. Login lanes: per-IP + un-spoofable
global throttle, scrypt with dummy-hash timing equalization on every miss path.
Secrets/PII: no key or credential reaches logs or responses.

**API-2 · UNDERDETERMINED / MINOR set** — `DELETE /api/query/links/{id}` lets
any analyst retract any analyst's ratified link (verified: no ownership check;
consistent with the shared-desk model but — unlike `runs.py` — not documented
or test-pinned as a decision); `create_profile` does not depend on
`get_identity`, so a proxy that failed to inject `X-Forwarded-Email` would
silently fall to the name-keyed branch (profile adoption; unreachable behind a
correct oauth2-proxy, and the proxy-less display-name takeover is the
documented single-team posture — but no independent assertion exists);
proxy-less `create_profile` race can 500 instead of 409 (no IntegrityError
catch on that branch); `Run.analyst_id` (an email for proxy identities) is
desk-wide-readable — fine single-team, PII the moment the trust model widens;
`/api/health` discloses llm configured/demo-fallback to an unauthenticated
prober (accepted, #33); xlsx decompression-bomb residual (compressed-size cap +
read-only streaming bound it); 250MB uploads buffer fully in memory (documented
trade-off); `edge_origin_guard`'s early 401 bypasses the inner
security-headers middleware (cosmetic).

**API-3 · MINOR · [NEW]** — SQLite runs without `PRAGMA foreign_keys=ON`
(`database.py:51-58` sets WAL + busy_timeout only): FK integrity is unenforced
in dev/tests while Postgres enforces it in production — a dev/prod behavioral
divergence that lets dangling-reference bugs pass the test environment.

---

## §10 Cleared areas — where confidence is now positive

- **NaN/±inf discipline:** zero poisoning paths found across the engine. Every
  divide/multiply on CP-1-derived values is either `is_finite_number`-gated or
  fed by producers proven finite at the boundary (XBRL parse gate, regex
  digits, `loads_finite`). The two residuals are documented above (ENG-17
  overflow lane; bare-isinstance sites unreachable today).
- **Auth/tenancy:** no CRITICAL or MATERIAL finding survived adversarial
  review (§9). The 2026-06-26 hardening wave (#22/#28/#31/#32/S-series) is
  real and present in code.
- **Gate determinism:** the CP-5 severity engine matches the corpus policy
  exactly; an LLM cannot declare its own output committee-ready, and council
  severities are normalized conservatively.
- **Committee export gate (server-side):** hard equality on "Committee Ready",
  409 with blocking findings otherwise; failed runs roll back atomically so no
  partial wreckage is traversable. (The *frontend* never calls it — FE-9.)
- **Static export + serving, migrations-on-boot, secret flow, port topology**
  (§8 DEP-7).
- **Run budget accounting** is cumulative across re-claims; per-call traces are
  tagged with run ids.

---

## §11 Meta / process

**META-1 · CONFIRMED divergence · MATERIAL (process)** — CLAUDE.md mandates
GitNexus (`impact` before any edit, `detect_changes` before any commit, claims
"8979 symbols indexed") but the repo contains no `.gitnexus/` and the session
exposes no GitNexus tools: the mandated safety workflow **cannot be executed**
by any agent or engineer following the instructions. Either re-index and commit
the index/config, or update CLAUDE.md — as written it demands the impossible
and trains readers to ignore it.

**META-2 · MINOR** — instruction/document drift: CLAUDE.md says "five-concept
UI" while README.md ships six concepts + Ask; `metrics.py` docstring
contradicts its own code (SPEC-6); Dockerfile comments name the wrong base
images; SECURITY.md/deploy README staleness (DEP-6); the prior audit's
remediation is traceable only through code comments — no closure log maps
findings → fixes (§12 below reconstructs it).

**META-3 · observation** — test-suite blind spots that let the confirmed bugs
through: extractor tests feed one tranche/amount per chunk (the misbinding
class); `LiveCoverage.test.tsx` hardcodes the wrong QA vocabulary;
`test_covenants.py` asserts the invalid "Inferred" value;
`ModelAnchor.intCov` is test-pinned but consumed by nothing (a test asserting
plumbing, not rendering); CI never runs the locked dependency set or boots the
compose stack; no migration-downgrade test; no Caddy↔oauth2-proxy↔app
integration test.

---

## §12 Prior audit (2026-06-26) — remediation status

_Each of the 36 findings re-checked against today's code (fix signatures read
directly where cited; otherwise established by this audit's subsystem sweeps)._

**FIXED (25):**
[00]/[10] adjusted-on-reported double-strip → basis guard `runner.py:167-174`.
[01] year() width mixing → normalization in `periods.py:20-32` (the audit's
exact recommended fix). [02] ±120-char amount window → clause-bounded rewrite
`textscan.py:31-72` (successor defect ENG-9 is new, narrower). [03]/[04]/[14]
same-layer upstream reads for CP-6A/CP-3D/CP-2C → registry deps declared with
fix comments (`registry.py:106-148`) — **but the same mechanism was never
applied to CP-2 (SPEC-1)**. [05] run-aborting module exceptions →
`_attempt_synth` isolates all exceptions (`runner.py:286-304`) — **but the
post-QA fact-projection phase is still unisolated (ENG-16)**. [06] XFF-keyed
throttle → un-spoofable global bucket (`auth.py:41-45`). [07] zero-chunk /
no-figure silence → "no extractable text" warning in the upload wizard
(`steps.tsx:334`) + the issuers degraded banner. [09] live evidence ids in
EvidenceModal → live/fixture separation now correct and test-pinned. [11]
fixture-as-run provenance → `is_fixture` → `fixture`/`demo_fixture` provenance
+ MATERIAL finding + limitation chain (`metrics.py:134-137`,
`runner.py:422-432`) — **but downstream consumers still don't quarantine it
(FE-13)**. [12] period-mismatched interest → `int_fresh` gate
(`edgar_cp1.py:244-256`). [13] impairment add-back double-count → conditional
add-back only when the impairment drove operating income negative
(`edgar_cp1.py:48,204-214`). [15] BM25 auto-anchor defeating CP-5B →
`suppress_sourced` on the live path (`runner.py:634-654`) — **but the
suppression set covers 3 of 13 types (QA-2)**. [18] cookie/SSO principal
desync → forwarded-email cross-check (`identity.py:174-186`, #22). [19] Altman
staleness → `_altman_distress` freshness gate (`edgar_cp1.py:266-309`). [21]
Report Studio ATLF-for-any-issuer → non-reference issuers now get an explicit
no-output state (test-pinned) — **fixture-stamp residuals live in FE-9**.
[24] unpinned markitdown tree → hashed `requirements.lock`
(`Dockerfile:43-44`) — **with the new google-genai lock omission (DEP-2)**.
[26] nd/lev basis reconstruction → disclosed adj-EBITDA preferred (#16,
`adjusted.py:163-172`). [28] login/logout edge-check bypass →
`edge_origin_guard` middleware chokepoint (`main.py:199-213`, #31). [29]
optional exp → exp mandatory (`identity.py:98-105`, #32). [30] xlsx parsed
before AV scan → scan-before-parse ordering (`ingestion.py:150-151`). [32]
hardcoded LTM anchor key → label-tolerant `latestPeriod` (#30). [33] no
unauthenticated health path → `skip_auth_routes` + edge exemption
(`oauth2-proxy.cfg:16`, `main.py:205`, #33). [34] demo-seed warn-only →
fail-closed boot refusal (`main.py:76-85`). [35] reported-disclosure basis
conflation → `reported_disclosure` basis mapping (`metrics.py:127-130`, #27).

**PARTIALLY FIXED (4):** [08] run-level vs module-level LIVE badge — module
surfaces now honor `allowSeededFallback`/`isReference` (test-pinned), but
seeded chrome still leaks on narrow screens and EvChip styling (FE-7 N3/N4).
[17] open runtime_output — CP-1/CP-2 tool schemas now pinned
(`synth.py:172-334`); other modules remain free-form (residuals ENG-16,
LLM-2). [20] BM25 memory/re-tokenization — per-run index built once
(`runner.py:257-262`, P4-2); whole-corpus-in-memory remains (accepted at pilot
scale). [23] backup restore-testing — automated daily backup service + a
documented scratch-restore drill now exist; restores are still never
*exercised* automatically. [31] Command Center mock — "Sample portfolio — not
live" + "Market-data file" labels shipped on two of three lenses and the live
NL-Query/LiveCoverage lanes exist; the Research lens and Monitor remain
unlabeled simulations (FE-4/FE-5).

**ACCEPTED/DOCUMENTED (1):** [27] flat 5.0× distressed-EV multiple and
net-debt-held-constant remain, disclosed in `waterfall_basis`/covenant notes
(new residual on the same line: the negative-EBITDA gate gap, ENG-8).

**NOT CONCLUSIVELY RE-CLASSIFIED (2):** [16] CP-X `gate_status` FULL_RUN vs
downstream limitations (planner behavior was re-read and found faithful to the
REF shape, but the specific reported combination was not reproduced); [22]
Deep-Dive live-caveat visibility below 1280px (not re-checked this pass; the
class of issue recurs in FE-7's DecisionRail note).

**Net assessment:** the 2026-06-26 remediation wave was real and largely
landed — 25 of 36 fixed outright, with fix-tagged comments that make the
lineage auditable. The recurring pattern in what remains: a fix applied at the
*site* of the prior finding but not to its *class* (layer-starvation fixed for
three modules, missed for CP-2; anchor suppression added for three extraction
types, not thirteen; provenance flagged at the store, not at consumers). New
CRITICALs in this audit (ENG-1, ENG-2, FE-1, FE-8) are all in surface area the
prior audit did not reach (distress scoring, reported-CP1 extraction, run
creation UX, model-anchor rendering).
