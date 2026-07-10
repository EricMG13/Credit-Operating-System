# CAOS — Feature & Concept Expansion Ideation

**Date:** 2026-07-03 · **Status:** ideation report, no code. Grounded against
branch `feat/query-route-fast-lane` by code inspection (routes, data model,
engine registry), not against tracker docs.

**Method.** Ask *"what features, concepts and use cases would I expect an
application like this to have?"* — an institutional buy-side leveraged-loan
credit-analysis platform — then hold every candidate against (a) what already
exists, (b) what the operative roadmap ([PRE_DEPLOYMENT_PLAN.md](PRE_DEPLOYMENT_PLAN.md),
phases A–H) already covers, and (c) whether it genuinely advances the app's
collective goal. This report is the **product-capability** complement to
PRE_DEPLOYMENT_PLAN §12, which maps *platform/ops* expectations (auth, backups,
SBOM…) and is deliberately not repeated here.

---

## 1. The assessment anchor

**Collective goal** (from CLAUDE.md design context): the buy-side credit
analyst builds a **defensible, committee-ready credit view** — every number one
click from its source — with the PM/CIO scanning posture and "what changed",
and Head of Research owning coverage health and the QA gate.

**Binding constraints** (recorded decisions — candidates that violate these are
rejected regardless of appeal):

| Constraint | Consequence for ideation |
|---|---|
| No paid services Phase-1; Bloomberg only, Phase-2 | anything needing vendor market/news data is Phase-2+ by definition |
| Loans-only; DM is the canonical spread metric | no bond-analytics surface area |
| Single team per deployment, no multi-tenancy | collaboration features stay lightweight |
| No LLM lane has tools or writes (safety property) | new LLM features are text-in/text-out lanes with fault isolation |
| Provenance invariant ("show your work") | any new surface must carry click-to-source or it doesn't ship |
| Phases A–H are the operative roadmap | new items **slot after their dependency phase**; nothing here justifies derailing the plan |

---

## 2. Current state — what exists and what is already planned

### Built (evidence in code)

| Capability | Where |
|---|---|
| 19-module analytical engine incl. **recovery** (CP-3B), **refinancing/LME risk** (CP-3D), **covenant capacity** (CP-4C), **adversarial IC debate** (CP-6A) and **portfolio debate** (CP-6E), CP-5 QA gate | `server/engine/registry.py` |
| Ingestion: document/memo/pricing-sheet upload, EDGAR fetch, URL exhibits, clamav, vault | `routes/ingestion.py`, `edgar.py` |
| Cross-issuer primitives: `metric_facts` NL scan, portfolio rollup endpoint, Query graph/walks (4 registered: defend, exposure, position, watch), fast lane | `nlquery.py`, `routes/portfolio.py`, `routes/query.py` |
| Covenant register (RP baskets, cross-default dominoes), sponsor track record, manual ratings, daily WARF digest | `routes/sponsors.py`, `routes/digest.py`, migrations 0014/0018 |
| Concepts wired live: Deep-Dive, Pipeline (CP-X DAG visualizer), Model Builder (+ SavedModel persistence), Report Studio, Issuer Profile, Query, Research | `frontend/src/app/*` |
| Cross-model council review (reviewer on opposite provider from synthesizer) | model-modes work, #78 |

### Already planned — do not re-propose (phase letter = PRE_DEPLOYMENT_PLAN)

Monitor engine: watch rules, alert inbox, `AlertSink`/`EmailSink` (C3) ·
Command board live + run-delta "what changed" (C2) · market-data seam +
`ManualQuoteProvider`/CSV quotes (C5) · OCR (D1) · RAG answer lane in Query
(D2) · upload robustness (D3) · roles-lite authz (E2) · audit trail (E3) ·
portfolio sleeve membership + posture heuristic ([PHASE2_SCOPE.md](PHASE2_SCOPE.md)) ·
inbound email/news classification (PHASE2_SCOPE, external-feed-bound).

### Notably absent from the data model (the genuine white space)

`database.py` has **no** table for: analyst notes/meetings, IC decisions or
recommendation history, calendars (earnings/covenant dates), positions/holdings,
document diffs, term-precedent baselines. That absence, not analytics depth, is
where expansion value lives.

---

## 3. Expectation scan — the analyst-workflow lifecycle

What a specialist would expect an app like this to have, stage by stage.
✅ built · 🔵 planned (phase) · ⬜ gap (assessed in §4) · ❌ rejected (§5).

| Stage | Expectation | Status |
|---|---|---|
| **Source / screen** | Cross-universe metric screener (lev, coverage, QA state) | 🔵 C2 board + fold-in (§4.7) |
| | New-issue / primary deal calendar | ❌ §5.1 |
| **Analyse** | Fundamental spreading, adjustments, peers, liquidity | ✅ CP-1x/2x |
| | Recovery / instrument preference | ✅ CP-3B |
| | Refinancing / maturity / LME risk (per issuer) | ✅ CP-3D |
| | **Portfolio-level maturity wall** | ⬜ §4.4 |
| | Covenant extraction, capacity, cross-default | ✅ CP-4/4C + register |
| | **Amendment / credit-agreement diffing** | ⬜ §4.5 |
| | **Terms-vs-precedent benchmarking** ("is this basket loose?") | ⬜ §4.6 |
| **Model** | Scenario grid, downside fragility, saved cases | ✅ CP-2B + SavedModel |
| | **Excel export of the model/committee pack** | ⬜ §4.2 |
| **Decide** | Adversarial challenge of the thesis | ✅ CP-6A/6E + cross-model council — *already exceeds expectation* |
| | Committee tear-sheet | ✅ Report Studio |
| | **Decision record / recommendation lifecycle** | ⬜ §4.1 |
| | Analyst hit-rate / call tracking | ⬜ §4.8 (deferred) |
| **Monitor** | Watch rules, alerts, filings poll | 🔵 C3 |
| | Live marks / DM moves | 🔵 C5 seam; Bloomberg = allowed-outstanding #2 |
| | **Earnings / filing calendar** | ⬜ fold into C3 (§4.9) |
| | **Covenant compliance calendar** | ⬜ §4.6b (deferred) |
| **Compare** | Peer percentile RV | ✅ CP-3/1C |
| | **Head-to-head issuer comparison exhibit** | ⬜ §4.3 |
| | Sector dashboards | 🔵 CP-SR spec-only; post-transfer (§4.10) |
| **Knowledge** | Vault, provenance, memo upload | ✅ |
| | Queryable meeting/analyst notes | ⬜ fold into vault + D2 (§4.9) |
| **Distribute** | Print-ready tear-sheet | ✅ |
| | Scheduled digest by email | 🔵 C3 `EmailSink` consumer (§4.9) |
| **Positions** | Holdings / P&L / order flow | ❌ §5.2 by design |

Read of the scan: **the analytical core meets or exceeds what a specialist
would expect** (an adversarial debate layer is rare even in commercial tools).
The expectation gaps cluster in four themes: (1) the decision lifecycle stops
at the tear-sheet, (2) cross-issuer read-models are thinner than per-issuer
depth, (3) document intelligence stops at extraction (no diff, no calendar,
no precedent), (4) no bridge to Excel, where committees actually live.

---

## 4. Candidates assessed

Verdict scale: **BUILD** (clear value, slot into roadmap) · **DEFER**
(valuable, blocked on a dependency or data that doesn't exist yet) ·
**FOLD-IN** (real need, but belongs inside an already-planned item, not a new
concept).

### 4.1 IC Decision Record — recommendation lifecycle — **BUILD (top pick)**

**What.** A small persisted record per issuer: recommendation
(OW/N/UW or pass), conviction, thesis sentence, committee date, decision
(approved/declined/revisit-by), dissent notes, link to the run + report it was
based on. Surfaced on Issuer Profile and the Command board; history append-only.

**Why expected.** The app's stated goal is a *committee-ready* view — but
today the workflow terminates at the tear-sheet. Any institutional shop asks
"what did we decide, when, on what evidence, and who dissented?" That is the
natural terminus of the entire pipeline.

**Pros.** Closes the loop the whole product points at; tiny data model (one
table + CRUD, the `SavedModel` pattern); synergy with E3 audit trail (same
append-only discipline); **retroactively enables call-tracking** (§4.8) —
recommendations timestamped now become measurable when marks arrive via C5;
run/report linkage keeps the provenance invariant intact.

**Cons.** Scope-creep risk toward a workflow engine (approvals, stages,
notifications) — must stay a *record*, not a process tool; single-team means
no approval chains needed; one more mutating route to cover in E3's audit log.

**Value vs goal: HIGH.** Directly completes "defensible in front of a
committee" — the defence now has a durable artifact. Slot: **after C2**
(Command board live) so the record has a live surface; before F so the beta
cohort dogfoods it. Size M.

### 4.2 Committee-pack Excel export — **BUILD**

**What.** One-click `.xlsx` of the Model Builder scenario grid + assumptions +
headline `metric_facts` (and optionally the tear-sheet tables), each figure
annotated with its run id + as-of. Read-only export; openpyxl (free/OSS).

**Why expected.** Buy-side committees and PMs live in Excel; every commercial
credit tool exports to it. Today the only outputs are the on-screen UI and the
print tear-sheet.

**Pros.** Adoption/trust lever for the F beta cohort (analysts can reconcile
CAOS numbers in their own environment — transparency is a brand pillar);
small-M effort, no new safety surface (no LLM, no writes); complements, not
replaces, Report Studio.

**Cons.** Exported numbers leave the provenance click-through (mitigate:
stamp run id + "as of" on every sheet); a second output format to keep in
parity with the UI (tie it to the concept-link suite's "same number
everywhere" check, C6); risk of analysts treating the export as the model of
record — it must be labeled a snapshot.

**Value vs goal: HIGH.** Meets the committee where it actually sits. Slot:
**with/after C6** so parity is testable. Size S–M.

### 4.3 Head-to-head issuer comparison — a fifth Query walk — **BUILD**

**What.** "Compare X vs Y (vs Z)": side-by-side headline metrics, covenant
register rows, RV percentile, downside fragility, recovery preference — as a
registered Query walk (per the Query design mandates: register in
`questions.ts`/`views.ts`/`synthesis.ts`, synthesis sentence first, committee
exhibit = charts + narrative).

**Why expected.** "Why this credit and not that one" is the second question
every committee asks. The primitives (metric_facts, register, CP-3 outputs)
all exist; only the exhibit doesn't.

**Pros.** Cheap — pure read-model over existing facts, no schema change; fits
an established extension pattern (walks); strengthens Query, the concept the
vision doc says is half-built; natural committee exhibit.

**Cons.** Partial overlap with the exposure/position walks and CP-1C peer
percentile (must be a *comparison exhibit*, not a re-implementation of peers);
covenant-row alignment across issuers with different structures needs careful
empty-state design.

**Value vs goal: MEDIUM-HIGH.** Slot: anytime after A (independent); good
warm-up before D2 touches the same registration files. Size S.

### 4.4 Portfolio maturity wall — **BUILD**

**What.** Cross-issuer rollup of CP-3D refinancing outputs: stacked wall of
maturities by year × issuer (seniority-colored per the tranche ramp), worst
refinancing-risk names flagged; a panel on the Command Center, reusing the
`portfolio.py` one-pass aggregation pattern.

**Why expected.** "What's our wall?" is a table-stakes leveraged-loan
portfolio question; per-issuer refinancing analysis exists (refinancing.py)
but nothing aggregates it.

**Pros.** Engine data already computed and persisted per run — this is a
read-model + one chart; obvious PM/CIO value (the §1 secondary persona);
strengthens the thinnest layer (cross-issuer).

**Cons.** Only as good as coverage breadth (sparse until F builds the
registry — empty-state design mandatory); maturity data quality varies by
lane (EDGAR XBRL vs reported-disclosure scan) — needs the provenance tag
visible; belongs after C2 so it lands on a live board, not the sample one.

**Value vs goal: MEDIUM-HIGH.** Slot: **with C2** (same surface, same
pattern) or immediately after. Size S–M.

### 4.5 Credit-agreement amendment diff — **BUILD-LATER (after D1)**

**What.** Upload amendment → deterministic text diff against the vault's
prior agreement (difflib redline over chunk text) + re-run the register
extraction and diff the *structured* covenant terms (basket sizes, add-back
caps, cross-default triggers) — "what actually changed" in one exhibit.

**Why expected.** Amendment season is where analysts spend brutal manual
hours; terms drift (basket loosening) is exactly the risk the covenant
register exists to catch. No free tool does this well.

**Pros.** Highly differentiating vs terminals; both halves exist (vault doc
storage + register extraction) — the delta is orchestration + one exhibit;
deterministic core (diff) with the LLM only summarizing, so fault-isolation is
easy; directly serves the "defensible legal read" goal.

**Cons.** Blocked in practice on **D1 OCR** — real amendments are frequently
scanned PDFs (0 chunks today); needs a document-lineage link
(amendment→parent) the model lacks (small migration); register extraction
reliability on messy amendments will need F-phase gap-log feedback first.

**Value vs goal: HIGH, timing-gated.** Slot: **after D1 + F feedback**. Size
M–L (own plan at pickup).

### 4.6 Terms-vs-precedent benchmarking — **DEFER (data doesn't exist yet)**

**What.** "Is this RP basket loose?" — percentile the issuer's extracted
covenant terms against the register corpus (by sector/sponsor/vintage),
leaning on the sponsor track-record table.

**Pros.** Unique, defensible, exactly the committee's "vs market" question;
pure read-model once the corpus exists. **Cons.** The baseline *is* the
register corpus, and today it holds a handful of issuers — percentiles
against n<15 are noise dressed as signal (worse than nothing for a
committee); normalization across bespoke definitions is genuinely hard.

**Value vs goal: HIGH later, negative now.** Revisit at **F exit** (≥15
issuers built). Record now as a design note only.

**4.6b Covenant compliance calendar** (cert due dates, test dates from the
register) — same verdict for the same reason: the register doesn't extract
dates yet, and sparse/wrong dates on a compliance calendar are worse than no
calendar. Add date fields to the register extraction wish-list for F's gap
log; build only if F shows they extract reliably.

### 4.7 Universe screener — **FOLD-IN (C2)**

Threshold filters + sort + saved views on the live Command board (lev > 6×,
coverage < 2×, QA ≠ pass…). Real need, but a *feature of the board C2 already
builds*, not a new concept — a separate screener surface would duplicate the
board and violate "density with hierarchy". Add as a C2 acceptance item.
NL query already covers the ad-hoc version.

### 4.8 Analyst call tracking / hit rate — **DEFER (Phase-2, enabled by 4.1)**

Recommendation vs subsequent DM move needs marks — C5's seam ships with
`ManualQuoteProvider` only, and honest hit-rates need a real feed (Bloomberg,
allowed-outstanding #2). Do nothing now **except build 4.1**, which
timestamps the calls so the history exists retroactively. Revisit
post-transfer. (Also a culture decision — measuring analysts is a product-owner
call, not a default.)

### 4.9 Three folds into already-planned items (record, don't re-plan)

- **Earnings/filing calendar** → C3 already polls EDGAR for new filings;
  surface "next expected filing" per issuer on Profile/Monitor as a C3
  acceptance item. Trivially small there; a standalone calendar concept is
  overkill.
- **Analyst meeting notes** → memo-upload to vault already exists and D2 makes
  vault content answerable. A dedicated notes table adds a second knowledge
  store to govern (GDPR-delete, audit, retrieval) for marginal gain. Instead:
  a "log a note" quick-capture on Issuer Profile that writes a tagged memo
  *into the vault*. S-size UX, zero new schema.
- **Scheduled digest email** → the daily WARF digest endpoint becomes an
  `AlertSink` consumer when C3 lands; the enterprise send is exactly
  allowed-outstanding #1. Note it in C3's spec so the sink interface accounts
  for a scheduled (not just event-driven) producer.

### 4.10 Sector dashboards — implement CP-SR — **DEFER (post-transfer)**

The corpus methodology exists (spec-only module) and the planner already
routes to it as "Not Implemented" — honest. Real sector RV needs breadth
(F corpus) *and* marks (C5/Bloomberg) to say anything a committee can use.
L-sized. Natural first post-transfer roadmap item alongside Bloomberg cutover;
building it now would compete with C/D for the same weeks and render mostly
empty panels.

---

## 5. Rejected — considered and closed

| Candidate | Why rejected |
|---|---|
| **5.1 New-issue / primary-deal pipeline** (deal calendar, allocations, syndication tracker) | Requires paid LevFin deal data (violates no-paid-services); serves origination, not the analyst's credit view. Not the app's job. |
| **5.2 Positions / P&L / holdings** | Turns an analysis platform into a quasi-OMS: compliance-sensitive data, settlement mess, entitlement questions — all off-goal. Sleeve *membership* (grouping, no quantities) is already scoped in PHASE2_SCOPE and is the right ceiling. **By design.** |
| **5.3 Inbound news/RSS sentiment feed** | Already adjudicated external-feed-bound in PHASE2_SCOPE; free RSS + entity resolution yields noisy alerts that erode trust in Monitor exactly when C3 is trying to establish it. Revisit only with a vendor feed post-transfer. *Scope note (PM clarification, §7 pt 4): what's rejected is the automated **transport** + sentiment ticker — the extraction-to-action lane on pasted/uploaded intel is separate and specced as plan §14 X6.* |
| **5.4 Chat-style copilot with write actions** ("have the AI update the model") | Violates the recorded safety property — no LLM lane gets tools/writes. Query's read-only NL + D2 RAG is the sanctioned shape of this feature. |
| **5.5 Outbound webhooks / integration bus** | No consumer exists; H3's OpenAPI export is the integration surface until enterprise names one. YAGNI. |
| **5.6 Real-time collaboration** (co-editing, presence, comments) | Single-team, ~15 analysts, deep-work personas; the decision record (4.1) + audit trail (E3) carry the coordination load. Heavy infra for no persona demand. |
| **5.7 Bond analytics / STW / Z-spread surfaces** | Loans-only, DM-canonical — recorded decision. |
| **5.8 i18n / multi-language filings** | Single-desk English product, recorded in §12. The reported-disclosure lane already handles non-US *filers*; translating non-English *documents* is a different, unjustified project. |

---

## 6. Ranked shortlist and sequencing

Value = contribution to "defensible, committee-ready credit view" per §1.

| # | Item | Verdict | Size | Earliest slot |
|---|---|---|---|---|
| 1 | IC Decision Record (4.1) | BUILD | M | after C2, before F |
| 2 | Committee-pack Excel export (4.2) | BUILD | S–M | with/after C6 |
| 3 | Head-to-head comparison walk (4.3) | BUILD | S | after A |
| 4 | Portfolio maturity wall (4.4) | BUILD | S–M | with C2 |
| 5 | Amendment diff (4.5) | BUILD-LATER | M–L | after D1 + F |
| 6 | Terms-vs-precedent (4.6) + covenant calendar (4.6b) | DEFER | M | F exit |
| 7 | Call tracking (4.8) | DEFER | M | post-transfer (C5 real feed) |
| 8 | Sector dashboards / CP-SR (4.10) | DEFER | L | post-transfer |
| — | Screener, filing calendar, notes-to-vault, digest email (4.7/4.9) | FOLD-IN | S each | inside C2/C3/D2 |

**Sequencing principle:** nothing above justifies touching the A–H critical
path. Items 3 and 4 are small enough to ride alongside C; item 1 is the one
genuinely *new* concept and earns a slot before the F beta so real analysts
dogfood it; item 2 lands once C6 can hold it to "same number everywhere".
Everything deferred has a named unblocking event (D1, F exit, C5 feed), not a
vague "later".

**One-line read:** the engine already out-analyzes expectations (debate,
recovery, LME, covenant capacity); the highest-value expansion is not more
analytics but **finishing the decision loop** (record → export → compare) and
**aggregating what the engine already knows** (maturity wall) — small,
read-model-shaped work that compounds the existing depth instead of competing
with the deployment plan.

> **Update 2026-07-03 (owner instruction):** the shortlist is now tracked in
> [PRE_DEPLOYMENT_PLAN.md](PRE_DEPLOYMENT_PLAN.md) — BUILD items as C7/C8/C9 +
> D4 and C2/C3 sub-items; deferred items as §14 backlog X1–X6 with named
> unblocking events. Expansion items never block a phase exit gate (§14
> policy).

---

## 7. PM review — initial thoughts on the current state (2026-07-03)

Verbatim points from the PM's first read, assessed against code and plan.

**Pt 0 — "Think through the value add in phases."** Adopted. The PM's implied
ladder (junior analyst → qualitative overlay → price dynamics → news flow →
sector trend) maps onto the program almost 1:1; the mapping table now lives in
PRE_DEPLOYMENT_PLAN §14 so it stays visible at program altitude.

**Pt 1 — "So far, effectively mimics the role of a junior analyst."**
Fair as *perception*, understated as *fact*. The engine already runs
senior-layer analytics — CP-6A adversarial IC debate, CP-6E portfolio debate,
CP-3B recovery/instrument preference, CP-3D refinancing/LME risk, CP-4C
covenant capacity — depth most junior analysts don't produce. But it runs
**per-issuer, on-demand, from historical filings**, and is silent between
runs. Two absences create the junior-analyst feel: no continuous awareness
(Monitor is still mock) and no market context (no marks, by recorded
decision). Both are already the plan's spine (C3, C5). Expect the perceived
jump from junior→senior to come from **alerts + marks landing**, not from
more analytics. One genuinely missing junior→senior artifact was the analyst's
own recorded view — now C8.

**Pt 2 — "Next is qualitative overlay derived from the data set."** Two
halves. *Machine* half partially exists: CP-2C/2D/2F produce qualitative
reads per run, but they're buried inside module output; D2's RAG lane
(planned) is the vault-wide qualitative synthesis this asks for. *Human* half
did not exist — nothing captured the analyst's own conviction/thesis/dissent.
That is exactly C8 (IC Decision Record); the PM point independently validates
the ideation top pick. D4 (notes → vault) feeds meeting color into the same
data set D2 answers from.

**Pt 3 — "Price driven dynamic (Bloomberg API needed) to monitor price moves
and flag out-of-bounds jumps."** Exactly the recorded allowed-outstanding #2
— the plan's end state is "everything live except Bloomberg + email". The
seam (C5) ships pre-transfer with `ManualQuoteProvider` (analyst/CSV quotes)
so the flag logic is built and testable *before* the feed exists; the
out-of-bounds jump detector is now an explicit C3 watch-rule type (DM move vs
trailing band). Bloomberg itself stays post-transfer: procurement +
entitlements + parallel-run reconciliation are enterprise-side work
(DEVELOPMENT_PHASES Phase 5). Nothing structural changes from this point —
it confirms the priority already encoded.

**Pt 4 — "News flow (M&A announcement) tied instantly to the financials to
flag risks or upside."** *Clarified by the PM 2026-07-03: the intent is
extracting information from emails and news and making it **actionable** —
update the model, simulate a scenario — not a headline ticker.* That
clarification splits the ask into two very different halves:

- **The intelligence half is buildable feed-free** (§14 X6, M–L): every
  ingredient already exists. The vault upload path accepts a pasted/uploaded
  email or article today; an LLM extraction lane (same fault-isolation
  invariants as every other lane) parses it to a structured `CreditEvent`
  (issuer, event type, quantum, cited source chunk) and *proposes* actions
  the analyst confirms: **simulate** (a `scenario.py` pro-forma run — M&A →
  pro-forma leverage/coverage against current `metric_facts`, numeric and
  cited), **update model** (a proposed assumption delta on the issuer's
  `SavedModel`, applied by a deterministic endpoint only after confirmation,
  audit-logged), or **alert** (first producer of C3's reserved `news` signal
  type). The safety property survives intact: the LLM proposes, a
  deterministic endpoint behind an analyst click writes — no LLM lane ever
  gets tools or write access.
- **The transport half stays vendor-gated** (§14 X7): automated inbound mail
  gateway / news API + entity resolution is the external-feed project
  PHASE2_SCOPE §B recorded; free RSS remains rejected for trust reasons.

The proposal-vs-write boundary matters beyond this feature: it is the
sanctioned pattern for *any* future "AI acts on the data" request — extract →
propose → analyst confirms → deterministic apply with audit trail.

**Pt 5 — "How a company is performing in sector — flag out-of-trend
companies."** Mostly built already: CP-1C emits `peer_outlier_finding` per
run and CP-3 computes peer percentiles. What was missing is *promotion* —
findings died inside run output instead of flagging anyone. C3 now lists
CP-1B monitoring + CP-1C peer-outlier findings as alert signal sources, so
out-of-trend names surface in the inbox with provenance. The *continuous*
version (trend vs sector over time, full dashboards) is CP-SR — spec-only
module, deliberately post-transfer (§14 X5) because it needs F-phase breadth
and real marks to say anything a committee can use; on today's registry it
would render empty panels.

**Overall read:** the PM's staging validates the roadmap rather than
redirecting it. Three concrete deltas were worth code/plan changes: the
DM-jump watch rule named in C3, peer-outlier findings promoted to alert
signals in C3, and the `news` enum reservation. Plus one confirmation: C8
(decision record) is the "qualitative overlay" capture the PM is asking for
on the human side.
