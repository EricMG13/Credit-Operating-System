# Brief — Improve CAOS Codebase Architecture

> **Plan with `claude-fable-5`. Execute with `claude-opus-4-8`.**
> Fable 5 reads this brief, walks the codebase, and produces the exploration
> plan + candidate shortlist. Opus 4.8 executes the plan: writes the HTML report,
> runs the grilling loop on the chosen candidate, and lands any refactor.

This is an **expanded, CAOS-grounded port** of the open-source
`improve-codebase-architecture` skill
([mattpocock/skills](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md)).
The upstream skill assumes companion tooling that **does not exist in this repo**
(`/codebase-design`, `/grilling`, `/domain-modeling`, a root `CONTEXT.md`, a
`docs/adr/` tree). The substitutions that make it run against CAOS are spelled
out in [§4](#4-dependency-substitutions--upstream-vs-caos). Read the whole brief
before planning.

---

## 1. Mission

Surface **architectural friction** in CAOS and propose **deepening
opportunities** — refactors that turn *shallow* modules into *deep* ones. The
payoff we optimise for is **testability** and **AI-navigability** (a coding agent
can hold a concept without bouncing across a dozen files). This is a *review and
proposal* exercise first, not a refactor sprint: nothing gets edited until a
human picks a candidate and it survives the grilling loop.

Deliverable of the run:
1. A self-contained **HTML architecture review** (scratch artifact, not committed).
2. A **grilling session** on the one candidate the human selects.
3. Any lazily-created **domain/decision records** the conversation earns
   (`CONTEXT.md`, an ADR) — and, only if a refactor is greenlit and lands, the
   refactor itself behind the usual CAOS gates.

## 2. Intent — why this, why CAOS

CAOS is an institutional leveraged-finance credit platform: a Next.js 15 analyst
UI over a FastAPI service, with the analytical core in `caos/server/engine/`. The
engine has grown into a **flat directory of ~45 single-concept modules**
(`adjusted.py`, `capstructure.py`, `covenants.py`, `distress.py`, `liquidity.py`,
`metricengine.py`, `metricfactlane.py`, `periods.py`, `packer.py`, `grounding.py`,
`lineage.py`, `council.py`, `debate.py`, …). That sprawl is exactly the shape the
deletion test is built to interrogate: many of these are candidates for being
*shallow* — a thin interface wrapping a thin implementation, extracted for
testability but leaving the real bug surface (how they're *called* and *composed*)
untested. Money is behind a wrong read here; a NaN slipping through a leverage
divide is a silent wrong number in front of an investment committee. Deep,
locally-reasoned modules are how we keep the analytical seams honest.

The goal is **not** to relitigate settled design or churn for its own sake. It is
to find the two or three seams where deepening genuinely concentrates complexity
into one testable place, and to argue each one on the evidence.

## 3. Vocabulary you MUST use (non-negotiable)

The upstream `/codebase-design` glossary skill is not vendored here, so its
terms are embedded below. Use these words **exactly** in every candidate,
diagram label, and grilling turn. Do **not** drift into "component," "service,"
"API," "boundary," "layer," or "helper."

| Term | Meaning in this brief |
|---|---|
| **Module** | A unit of code with an interface and a hidden implementation. |
| **Interface** | Everything a caller must understand to use a module — its surface. |
| **Depth** | Ratio of hidden implementation to exposed interface. **Deep** = small interface over substantial implementation. **Shallow** = interface nearly as complex as what it hides. |
| **Seam** | A place two modules meet — where responsibility and knowledge hand off. |
| **Adapter** | A module that translates across a seam. |
| **Leverage** | How much a small interface change buys you downstream. |
| **Locality** | Whether the code you must read to understand one behaviour sits together. Extracting a pure function *away* from its call site trades testability for lost locality — a common shallowing move. |

**Principles to apply as tests, not slogans:**
- **The deletion test.** For anything you suspect is shallow, ask: would deleting
  this module *concentrate* complexity (good — signal of a real deepening
  opportunity) or just *move* it elsewhere (no win)? "Concentrates" is the signal.
- **The interface is the test surface.** If a module is hard to test through its
  current interface, that is an interface problem, not a test-coverage problem.
- **One adapter = a hypothetical seam; two = a real one.** Don't propose a seam
  because it's conceivable. Propose it when two real call sites already prove it.

## 4. Dependency substitutions — upstream vs CAOS

The upstream skill's process references tooling this repo doesn't have. Here is
what to use instead. **Do not go hunting for the upstream files; use these.**

| Upstream expects | CAOS reality | What to do |
|---|---|---|
| `/codebase-design` vocabulary skill | absent | Use the embedded glossary in [§3](#3-vocabulary-you-must-use-non-negotiable). |
| Root `CONTEXT.md` domain glossary | **absent** | Source domain names from `CLAUDE.md` ("Design Context"), the `.goal/` concept directory (`altman-z`, `recovery-waterfall`, `interest-runway-months`, `rate-sensitivity`, `score-vuln`, …), `PRODUCT.md`, and the `Modular OS/` CP-module corpus. **Lazily create `CONTEXT.md` at repo root** the first time the grilling loop names a domain concept that deserves a canonical definition — don't pre-build it. |
| `docs/adr/` decision records | **absent** (`docs/` holds plan/handoff docs, not ADRs) | There are no ADRs to relitigate yet. If a candidate is rejected for a load-bearing reason during grilling, **create `docs/adr/` lazily** and record it (see [§7](#7-phase-3--grilling-loop)). |
| Agent tool `subagent_type=Explore` | available | Use it — **and** lead with **GitNexus MCP** (see below), which is CAOS's code-intelligence layer and the faster path to seams and blast radius. |
| `/grilling` skill | absent | Run the grilling loop inline per [§7](#7-phase-3--grilling-loop). |
| `/domain-modeling` skill | absent | Keep the domain model current inline: edit `CONTEXT.md` as terms crystallise. |

**GitNexus is your primary exploration instrument.** This repo is indexed
(`Credit-Operating-System`, ~10.8k symbols, ~19k relationships, 300 flows). Per
`CLAUDE.md` this is mandatory, not optional:
- `query({search_query: "concept"})` to find execution flows instead of grepping.
- `context({name: "symbolName"})` for a symbol's callers, callees, and flows —
  this is how you *measure* depth and locality objectively rather than by feel.
- `impact({target, direction: "upstream"})` for blast radius **before proposing
  or touching any symbol**. Report HIGH/CRITICAL risk in the candidate card.
- `explain({target})` for taint/seam-leak findings.

## 5. Phase 1 — Explore

Read the domain grounding first (`CLAUDE.md` Design Context, `PRODUCT.md`,
`.goal/`, relevant `Modular OS/` CP modules for the area you're circling).

Then walk the codebase **organically** — no rigid checklist. Use GitNexus
`query`/`context` and the `Explore` subagent. Note where *you* feel friction:

- Where does understanding one concept require bouncing between many small
  modules? (The flat `caos/server/engine/` directory is the first place to look —
  e.g. how `metrics.py` / `metricengine.py` / `metricfactlane.py` / `adjusted.py`
  compose to produce one CP-1 figure; how `council.py` / `debate.py` /
  `analyst.py` / `autonomy.py` relate.)
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where were pure functions extracted purely for testability, but the real bugs
  hide in *how they're called* (lost **locality**)?
- Where do tightly-coupled modules leak across their **seam**?
- Which parts are untested, or hard to test through their current **interface**?
  (Cross-reference the engine convention in `CLAUDE.md`: every CP-1 divide/multiply
  must gate through `engine.periods.is_finite_number` — a seam where the guard is
  *implicit* rather than enforced by the interface is a live deepening candidate.)

Apply the **deletion test** to each suspect. Keep only "yes, concentrates."

**Boundary for this phase:** explore and measure only. **Do not edit code, do not
propose concrete interfaces yet.** Interface design is deferred to grilling.

## 6. Phase 2 — Present candidates as an HTML report

Write a **self-contained HTML file to the OS temp dir** (resolve `$TMPDIR` →
`/tmp` fallback; or the session scratchpad) as
`<tmpdir>/caos-architecture-review-<timestamp>.html`. **Nothing lands in the
repo.** Tell the human the absolute path and open it (`xdg-open` on this Linux
host).

Stack: **Tailwind via CDN** for layout, **Mermaid via CDN** for graph-shaped
diagrams (call graphs, dependency flows, sequences), and hand-built CSS/SVG for
editorial visuals (mass diagrams showing interface breadth vs implementation
depth, before/after collapse). **Be visual; vary the diagrams — sameness defeats
the point.** Lean into CAOS's own aesthetic where it helps legibility (dark
workspace `#0a0a0f`→`#11131d`, hairline borders `#34384a`, accent `#63a1ff`,
JetBrains Mono for symbols, small uppercase labels) — it's a scratch artifact, so
polish is optional, but a committee-ready look never hurts.

Each candidate is a **card** with:
- **Files** — the modules/files involved (monospaced).
- **Problem** — why the current architecture causes friction (one sentence).
- **Solution** — plain-English description of what would change (one sentence).
- **Benefits** — bullets (≤6 words each) framed in **locality** and **leverage**,
  and how tests improve. Use glossary terms, not "maintainability."
- **Before / After diagram** — side-by-side, custom-drawn, showing the
  shallowness and the deepening.
- **Blast radius** — the GitNexus `impact` result; flag HIGH/CRITICAL.
- **Recommendation strength** — badge: `Strong` · `Worth exploring` · `Speculative`.

Use **`CONTEXT.md`/`.goal`/`CLAUDE.md` vocabulary for the domain** and the **§3
glossary for the architecture**. If the domain calls it an "Issuer," write "the
Issuer intake module," never "the FooHandler" and never "the Issuer service."

**ADR conflicts:** there are no ADRs yet, so this is unlikely — but if a candidate
contradicts a decision recorded in `docs/` or `.agent-reviews/redteam.md`, surface
it only when friction is real enough to warrant reopening, with a clear warning
callout. Don't enumerate every theoretical refactor a doc forbids.

End with a **Top recommendation** section: which candidate you'd tackle first and
why. Then **stop and ask the human: "Which of these would you like to explore?"**
Do **not** propose interfaces before they answer.

## 7. Phase 3 — Grilling loop

Once the human picks a candidate, walk the design tree **with them** — constraints,
dependencies, the shape of the deepened module, what sits behind the **seam**,
which tests survive. One question at a time; follow the friction; use `context`
and `impact` to keep claims grounded, not asserted.

Side effects happen **inline** as decisions crystallise:
- **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term
  to `CONTEXT.md` (create the file lazily at repo root if absent).
- **Sharpening a fuzzy domain term mid-conversation?** Update `CONTEXT.md` there
  and then.
- **Human rejects the candidate with a load-bearing reason?** Offer an ADR:
  *"Want me to record this as an ADR so future architecture reviews don't
  re-suggest it?"* Create `docs/adr/` lazily. Only offer when the reason would
  actually be needed by a future explorer to avoid re-suggesting the same thing —
  skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Exploring alternative interfaces for the deepened module?** Design it twice:
  spin up parallel sub-agents on two independent interface shapes and compare,
  rather than committing to the first idea.

## 8. Guardrails & boundaries (CAOS-specific)

These override convenience. Honour them.

- **GitNexus impact before any edit.** Never modify a function/class/method
  without first running `impact({target, direction:"upstream"})` and reporting the
  blast radius. Warn on HIGH/CRITICAL before proceeding. Never rename by
  find-and-replace — use GitNexus `rename`.
- **Red-team gate before committing to an architecture.** Per `CLAUDE.md`, record
  a critic pass in `.agent-reviews/redteam.md` before committing to an interface
  or rollout. Fix and verify each high-impact objection, or document why the risk
  is accepted. This applies the moment a refactor is greenlit — not before.
- **Engine convention holds.** Any CP-1-derived divide/multiply introduced or
  moved must gate through `engine.periods.is_finite_number` (a plain `isinstance`
  check lets `NaN` through and poisons the read). If a candidate *is* "make this
  guard part of the interface," say so explicitly.
- **Parallel-WIP staging.** If anything is committed, stage explicit paths only —
  never `git add -A`/`.` — to preserve the user's parallel work-in-progress.
- **Compare against `origin/main`**, not local `main`, for any diff/change
  detection. Run GitNexus `detect_changes({scope:"compare", base_ref:"main"})`
  before committing.
- **This brief itself is the only thing committed by default.** The HTML report is
  scratch; `CONTEXT.md`/ADRs are created only when the grilling loop earns them;
  the refactor lands only on explicit human go-ahead.

## 9. Definition of done

- Phase 1: friction walked; each surviving candidate passes the deletion test and
  carries a GitNexus-measured depth/locality/blast-radius claim (not a vibe).
- Phase 2: a self-contained HTML report exists in the temp dir, opened, with a
  clear Top recommendation; the human has been asked which to explore.
- Phase 3 (if a candidate is picked): a grilling transcript that lands on a
  concrete deepened-module shape *or* a recorded reason not to; `CONTEXT.md`/ADRs
  updated iff earned.
- Any code change (only if greenlit): red-team pass recorded, impact reported,
  `is_finite_number` guards intact, `detect_changes` clean against `origin/main`,
  explicit-path commit.

## 10. What Fable 5 should hand off to Opus 4.8

Produce a plan, not prose. It should contain:
1. The **exploration map** — which engine/frontend seams to interrogate, in
   priority order, with the GitNexus queries to run.
2. A **ranked candidate shortlist** (2–4) with the one-line problem/solution and
   the deletion-test verdict for each.
3. The **HTML report outline** — card set + the Top recommendation you'd argue.
4. **Open questions** for the grilling loop, per candidate.
5. **Risk flags** — any candidate whose blast radius is HIGH/CRITICAL, and the
   guardrails ([§8](#8-guardrails--boundaries-caos-specific)) that will bind
   execution.

Opus 4.8 then executes phases 2–3 against that plan.
