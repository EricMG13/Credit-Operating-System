# CAOS — Information Architecture & Concept Review

**Date:** 2026-06-14
**Scope:** The analyst UI's top-level structure — the five concepts (A–E) plus
the directory / upload / landing routes — assessed for sections that are
embedded inside one concept but would function better as their own standalone
concept. Component-level polish, backend, and the `Modular OS/` corpus are out
of scope.

> Companion to [AUDIT.md](AUDIT.md) (codebase health) — this doc is about
> *structure / navigation*, not code quality. Impact legend:
> **High** = changes the product's mental model · **Med** = clarifies a real but
> contained overload · **Low** = local tidy-up. Effort is rough build cost.

---

## Verdict

The five-concept model (Command · Pipeline · Deep-Dive · Model · Report) is a
strong spine, and **B/C/D/E are each one coherent job done well.** The structural
debt is concentrated in **one place: Command Center is carrying three jobs behind
a view toggle** (portfolio posture, research/QA governance, and sector relative
value) while also pinning a fourth, continuously-live surface (CP-MON monitoring)
as a side column. Two more items sit slightly wrong in the map: the **NL query**
is a cross-cutting capability nailed to one Command view, and **Document Intake
(`/upload`)** is a real stage that isn't in the nav at all.

Net recommendation: **promote exactly one new destination — Monitoring (CP-MON) —
and make the NL query a global launcher rather than a page.** Resolve the
`/upload` orphan and decide Sector RV's home. Resist promoting anything in
Deep-Dive: its value *is* the co-located evidence context. Growing past ~6
destinations dilutes the "five-concept" identity faster than it helps.

---

## Evaluation lens

A section earns its own concept when it scores high on these, and the coupling
cost of extracting it is low:

| Test | Question |
|------|----------|
| **Distinct job/persona** | Different user goal, or a different one of the three personas (analyst / PM-CIO / Head-of-Research)? |
| **Distinct cadence** | Snapshot you *open*, vs. a live surface you *watch*, vs. a tool you *invoke*? Mismatched cadences shouldn't share a frame. |
| **Cross-cutting vs. contextual** | Used across many issuers/concepts (wants to be reachable everywhere), or only meaningful inside one context (wants to stay there)? |
| **Surface weight** | Enough content + state to justify a destination, or a panel? |
| **Coupling cost** | Does extraction sever a valuable shared context (evidence sync, issuer-in-focus, the D→E model handoff)? |
| **Discoverability** | Is it currently buried where its user won't look? |

**The standing tradeoff for *every* promotion:** a clearer, deep-linkable,
room-to-grow destination that matches a persona — bought at the price of one more
nav target, an extra context switch, more chrome/state to maintain, and erosion
of the "five concepts, A–E, SPACE+←/→" narrative that is part of the product's
identity. Promote only when the job is genuinely distinct *and* doesn't lose
context by leaving home.

---

## Current IA map

```
/  ──redirect──▶  /issuers              ← de-facto home (hub), NOT in the A–E nav
/issuers (Directory)                    ← different chrome (CREDIT OS logo, no back-link)
  ├─▶ /upload   (CP-0 Document Intake)  ← a route, but NOT in ConceptNav (orphan)
  └─▶ /deepdive

ConceptNav (shown in every concept header):
  A /command   ── Posture Summary + NL Query + full-width Coverage (sample sleeve/live coverage)
  A2 /sector   ── standalone Sector Review (CP-SR daily intelligence; seed/demo until API-backed)
  A3 /sector-rv── standalone Sector RV
  B /pipeline  ── DAG / swimlanes + inspector + lineage + event log         (one job ✓)
  C /deepdive  ── SourceRail · module analysis (Debate/Recovery/Covenants + generic) · DecisionRail · Ask-ATLF slide-over   (one job, dense ✓)
  D /model     ── sheet grid + Scenario & Sensitivity panel                 (one job ✓)
  E /reports   ── deliverable publishing desk (reads D's model via localStorage)   (one job ✓)
```

Two observations fall straight out of the map:

1. **"Command Center" is the name of Concept A, but it is not the home** — the
   root redirects to the Directory. The cockpit you'd expect to land in is a tab
   you have to navigate to, and once there it is three different cockpits.
2. **B, C, D, E each pass the "one job" test cleanly.** All the structural
   pressure is in A and in the two orphaned/misplaced capabilities.

---

## Findings register

| # | Section (today's home) | Recommendation | Impact | Effort |
|---|------------------------|----------------|--------|--------|
| IA-1 | **CP-MON Monitoring** — Email Intel + Alert Routing (side column of Command A) | **Promote** to its own concept ("Signals" / "Monitor") | High | Med |
| IA-2 | **NL Query** (panel in Command·PORTFOLIO) + **Ask ATLF** (slide-over in Deep-Dive) | **Unify as a global launcher**, not a page | High | Med–High |
| IA-3 | **Document Intake** `/upload` (orphan route) | **Resolve orphan**: fold into Pipeline as L0 *or* add to nav | Med | Low |
| IA-4 | **Sector RV** (third Command view) | **Conditional promote** — own concept only if RV deepens; else keep | Med | Med |
| IA-5 | **Research / Coverage + QA** (second Command view) | **Keep as a lens**, but it's the next split if the Head-of-Research persona grows | Med | Med |
| IA-6 | **Deep-Dive bespoke tabs** — Debate / Recovery / Covenants | **Keep embedded** — do not promote | — | — |
| IA-7 | **Directory `/issuers`** vs. "Command Center" naming/home | **Reconcile** home + naming | Low | Low |

---

## Detailed findings

### IA-1 · Promote CP-MON Monitoring out of Command Center  — *High / Med*

**What it is.** `EmailIntel` + `AlertFeed` (CP-MON / CP-MON-H) run off their own
`useSimRun`, show a live "LIVE/PAUSED · 105 msgs today" pulse and route alerts in
real time. Today they're pinned as a 624px right column in the PORTFOLIO and
RESEARCH views and *vanish* in SECTOR RV.

**Why it wants out.** It fails to share a cadence with everything around it.
Posture/coverage are **snapshots you open and read**; monitoring is a **stream
you watch**. The design brief explicitly calls out "trading-desk alertness — live
state and *what changed* feel immediate" as a core brand pillar — that pillar
currently has no home of its own and is instead a sidecar that one of three views
deletes. It's also the most persona-clean cut: the PM/CIO "what changed today"
scan is a different sitting than the analyst's deep work.

**Tradeoffs.**
- *For:* gives the live/alert pillar a real surface with room to grow (triage,
  rules, history); lets Command Center become a clean posture snapshot; removes
  the "column that disappears in one view" inconsistency; deep-linkable from an
  alert in an email/Slack.
- *Against:* Command Center loses its heartbeat — mitigate with a compact
  "ALERTS today · N" badge in the header (already present) that deep-links to the
  new concept. One more nav target. The sim-run currently shared with Command's
  header counters would need to move or be lifted to a shared hook.

**Recommendation:** promote. This is the single highest-value split and the one
with the cleanest seam (it's already a self-contained column with its own run).

### IA-2 · Make conversational query a global launcher, not a destination  — *High / Med–High*

**What it is.** Two separate conversational surfaces with different scopes:
`NlQuery` (cross-issuer, structured-metric + semantic evidence, gate-aware) is a
panel at the top of Command·PORTFOLIO; `IssuerChat` / "Ask ATLF" (issuer-scoped)
is a slide-over in Deep-Dive. Same fundamental affordance — *ask a question, get
an evidence-cited answer* — implemented twice, reachable in two unrelated places,
with no shared entry point.

**Why it's mis-placed.** Query is **cross-cutting**, so by the lens it should be
reachable *everywhere* — but Ask ATLF is **contextual** (it's good precisely
because Deep-Dive supplies the issuer). A static "Query" page would solve
discoverability for the first and *break* the second by stripping context. The
right shape isn't a sibling concept; it's a **global launcher** (e.g. ⌘K / a
persistent ask-bar in the shared header) that scopes itself: portfolio-wide from
Command/Directory, issuer-scoped inside Deep-Dive/Model, with the answer surface
rendered inline or as an overlay.

**Tradeoffs.**
- *For:* one mental model for "ask CAOS"; available from any concept;
  context-aware scoping; frees the top of the PORTFOLIO view; matches the
  evidence-cited, gate-aware promise as a first-class verb.
- *Against:* more engineering than a page move — needs shared state, a scope
  resolver, and a consistent overlay; risk of two answer renderers drifting.
  A keyboard-launcher is also less *discoverable* than a nav chip, so it needs a
  visible affordance, not only the shortcut.

**Recommendation:** unify behind one launcher; keep the inline Command panel as
one *entry point* into it, not a separate engine. Do **not** add a "Query"
concept to the A–E nav.

### IA-3 · Resolve the Document Intake orphan  — *Med / Low*

**What it is.** `/upload` (CP-0 source readiness / ingestion) is a full route in
the design language, but it isn't in `ConceptNav` — you reach it only from the
Directory header or a per-row "+ UPLOAD". It's the literal front door of the data
pipeline, yet invisible in the concept map.

**Why it matters.** Ingestion *is* the L0 stage of the very DAG that Concept B
visualizes. Right now the pipeline's first step lives outside the pipeline. A
user building a mental model from the nav never sees where data enters.

**Tradeoffs.**
- *Fold into Pipeline (preferred):* CP-0 becomes the L0 entry of the execution
  graph it already belongs to — no new top-level target, and the "data enters
  here → flows through CP-X" story becomes literal. Cost: Pipeline gains an
  intake mode/panel.
- *Add to nav as its own chip:* cheapest, most discoverable, but spends a
  precious top-level slot on what is really one pipeline stage.
- *Status quo:* leaves a real capability undiscoverable.

**Recommendation:** fold into Pipeline as the L0 intake step; at minimum, stop
leaving it out of the nav.

### IA-4 · Sector Review / Sector RV — standalone split  — *Med / Med*

**What it is.** `/sector` owns CP-SR daily intelligence and `/sector-rv` owns
relative-value tables. Command keeps posture, NL Query, and Coverage. Sector
Review no longer lives as a Command panel or modal.

**Why it's a clean cut.** The daily intelligence job needs feed settings,
timeframes, source chips, issuer chips, and topic ASK. Sector RV needs dense
market tables. Keeping either inside Command overloads the PM/CIO posture page
with work that belongs to a deeper sector workflow.

**Tradeoffs.**
- *For:* the split gives CP-SR and Sector RV enough room for their own controls
  and source/provenance language without stealing Command's posture scan.
- *Against:* shared nav is more crowded and must be smoke-tested whenever concept
  chrome changes.

**Recommendation:** keep the standalone split. Cross-link back to Command only
when analyst usage proves a specific workflow need.

### IA-5 · Research / Coverage + QA — keep as a lens (for now)  — *Med / Med*

**What it is.** Coverage Matrix (L1–L6 freshness) + QA Queue (CP-5) + Source Gaps
(CP-0): the Head-of-Research / QA persona's view, the second Command toggle.

**Why it's defensible where it is — and where it isn't.** Both PORTFOLIO and
RESEARCH are "scan the book from above" jobs, so a persona toggle inside one
Command Center is a reasonable read. *But* QA/governance is genuinely
cross-cutting and already appears in three places — CP-5 clearance in Pipeline,
the CP-5 watermark gate in Report Studio, and this queue — with no single owner's
home. If the Head-of-Research becomes a first-class persona, a **Coverage &
Governance** concept consolidating the QA gate, coverage SLAs, and source gaps is
the next promotion after CP-MON.

**Tradeoffs.** Promoting now risks a thin concept and a second nav split out of
Command in one round; keeping it co-located preserves the "one place to survey
the portfolio" value but leaves QA's ownership diffuse.

**Recommendation:** keep as a lens this round; revisit once CP-MON is out and the
Head-of-Research workflow is real. Flag it as the #2 split candidate.

### IA-6 · Deep-Dive bespoke tabs — keep embedded  — *do not promote*

**What they are.** CP-6A Adversarial Debate, CP-3B Recovery Waterfall, CP-4
Legal & Covenants — heavyweight analyses rendered as tabs in the module launcher,
flanked by the Source/Decision rails and the cross-pane Evidence Sync.

**Why they must stay.** These are textbook "looks promotable, isn't" cases. Each
is weighty enough to be its own tool, but their value is the **co-located
evidence context**: the left SourceRail, the E-xx click-to-source, the shared
selection, the right-hand IC decision. Promote them and you fragment the
deep-dive and sever exactly the "show your work" interaction the product is built
around. Recovery and Covenants are common standalone analyst tools elsewhere, but
here they're correctly subordinate to the issuer-in-focus.

**Recommendation:** leave as tabs. (If anything, the move is the opposite of
promotion — keep consolidating analysis *into* the evidence-synced frame.)

### IA-7 · Reconcile the home + the "Command Center" name  — *Low / Low*

The root redirects to the **Directory**, which has different chrome (CREDIT OS
logo, no back-link) and isn't an A–E concept — yet it's the actual home. Mean-
while "Command Center" (Concept A) carries the name you'd expect the home/cockpit
to own. This isn't broken, but the naming oversells A and the Directory's hub
role is invisible in the concept story.

**Recommendation:** decide deliberately — either make the Directory the explicit
"Home" (and rename A to what it actually is, e.g. "Portfolio"), or land users in
Command Center. Cheap; pays off in mental-model clarity.

---

## Recommended target IA

**Conservative (recommended this round) — six destinations + a global verb:**

```
Home/Directory  ·  A Command (Portfolio + Research lenses)  ·  B Pipeline (incl. L0 Intake)
·  C Deep-Dive  ·  D Model  ·  E Report   ·  NEW: Monitor (CP-MON)
                                            ⌘K Ask — global, context-scoped (NlQuery ⊕ Ask ATLF)
```
- Splits out **Monitor** (IA-1), **Sector Review**, and **Sector RV**, folds
  **Intake** into Pipeline (IA-3), and turns **Ask** into a global launcher
  (IA-2). Command keeps the posture/coverage job.
- Net top-level count moves beyond the original A–E model; icon+label concept
  chips are the durable pattern.

**Bold (only if Governance is on the roadmap):**
add **Coverage & Governance** (IA-5). That's justified only if the QA persona
gets a real workflow, not just a renamed table.

---

## What this is really about

The instinct "Command Center should be split" is correct, but the fix isn't to
shatter it into four tabs-as-concepts. It's to recognize that **one true new job
is hiding in there (live monitoring), one capability is mis-shaped (query should
be a verb, not a place), one stage is missing from the map (intake), and the rest
is persona *lenses* that are fine to toggle.** Make those four moves and every
concept passes the "one job" test — without breaking the five-concept story more
than the +1 that Monitoring genuinely earns.

The discipline to hold: a new concept must be a distinct **job that doesn't lose
context by leaving home.** Monitoring passes. Debate/Recovery/Covenants fail
(context is the point). Query is neither — it's an everywhere-verb. Keeping that
distinction is what stops the nav from sprawling.
```
