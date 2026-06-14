# External Tooling Review

**Date:** 2026-06-14 · **Lens:** fit to CAOS's actual goals — ingest PDF/XLSX
deal docs → vault → chunks → CP-0 → BM25 retrieval → evidence-traced,
committee-defensible output, with an in-app assistant, the CP-5 QA gate, and the
CP-6A debate. Judged on fit to *that*, not general quality.

## Verdict at a glance

| Repo | License | Verdict | Why |
|---|---|---|---|
| [microsoft/markitdown](https://github.com/microsoft/markitdown) | MIT | **Adopt** | Structure/table-preserving document→Markdown; directly upgrades the ingestion→evidence pipeline. **Spike landed** (below). |
| [CopilotKit](https://github.com/CopilotKit/CopilotKit) | MIT | **Adopt patterns (selective)** | In-app copilot: shared-state + generative UI + human-in-the-loop map onto "Ask ATLF" + Evidence Sync; full adoption fights the static-export architecture. |
| [academic-research-skills](https://github.com/Imbad0202/academic-research-skills) | CC-BY-**NC** | **Reference only** | Verification-rigor / peer-review-rubric / devil's-advocate patterns parallel CP-5 & CP-6A — but the NC license blocks use in a commercial product, and the domain is academic. |
| [Agent-Reach](https://github.com/Panniantong/Agent-Reach) | — | **Exclude** | Social-media scraping (Twitter/Reddit/LinkedIn) via cookie reuse — wrong domain + compliance/MNPI/ToS risk for a regulated credit process. |
| [taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | **Exclude** | Frontend design-quality skill, but biased toward expressive/animated variance — opposite to CAOS's restrained brand; redundant with `.impeccable.md` + `frontend-design`. |

## 1. markitdown — adopt (highest value)

Converts PDF/Excel/Word/PPTX/images(OCR)/HTML/CSV → **structure-preserving
Markdown** (headings, lists, **tables**, links) for LLM pipelines; optional Azure
Document Intelligence backend; MIT.

**Why:** CAOS ingestion ([ingest.py](../server/ingest.py)) does `pypdf` page-text
concatenation + a flat `openpyxl` dump. Credit docs are **table-dense**
(financials, cap structure, covenant schedules, compliance certs) and `pypdf`
mangles tables/multi-column layouts. markitdown preserves that structure →
better chunks → better BM25 retrieval ([retrieval.py](../server/retrieval.py)) →
better evidence grounding and E-xx citations — the thing CAOS is built around.
OCR also rescues scanned PDFs that today "vault fine but produce no chunks."

**Caveat:** markitdown needs **Python 3.10+**; the server runs **3.9.6**. So the
integration runs it **out-of-process**.

### Spike (landed, flag-gated, non-breaking)

- [config.py](../server/config.py): `CAOS_MARKITDOWN_CMD` (default empty) +
  `markitdown_timeout_s`. Empty = current behavior, unchanged.
- [ingest.py](../server/ingest.py): `_markitdown_text()` shells out to the
  configured CLI (any 3.10+ env/binary), writing the upload to a temp file and
  capturing the Markdown. `extract_pdf_text` / `extract_xlsx_text` try it first
  and **fall back to pypdf/openpyxl on empty config, non-zero exit, timeout, or
  a missing binary** — a misconfiguration never blocks an upload.
- [routes/ingestion.py](../server/routes/ingestion.py): passes the filename so
  markitdown picks its converter by extension.
- Tests ([test_ingest_markitdown.py](../tests/server/test_ingest_markitdown.py)):
  a **stub markitdown CLI** proves the out-of-process wiring on 3.9 (table
  Markdown flows through both extractors), plus both fallback paths. 43 pytest.

**To enable in a deployment:** install markitdown in a 3.10+ env and set
`CAOS_MARKITDOWN_CMD` to its binary (e.g. `/opt/markitdown/.venv/bin/markitdown`).
Keep the upload size cap (audit B-2: untrusted-document parsing surface).

## 2. CopilotKit — adopt patterns, selectively

In-app copilot framework (MIT, React + Python): streaming chat, **generative UI**
(agent renders components), **shared state** (agent ↔ UI), **human-in-the-loop**,
Anthropic via AG-UI.

**Useful parts** map onto CAOS's existing assistant
([IssuerChat.tsx](../frontend/src/components/deepdive/IssuerChat.tsx)):
- *Shared state* → the assistant sees the current Evidence Sync selection.
- *Generative UI* → surface an evidence card / covenant clause / chart inline.
- *Human-in-the-loop* → agent proposes, analyst confirms (committee posture).

**Caveats:** the frontend is a **static export** (`output: export`) — CopilotKit
expects a copilot *runtime*, so you'd bridge to FastAPI via its Python SDK /
AG-UI (non-trivial), and restyle away from its consumer-SaaS default to fit the
institutional terminal. **Borrow the patterns; adopt the library only with that
runtime + restyle cost in mind.**

## 3. academic-research-skills — reference only

Claude skills with rigorous machinery: deterministic citation verification,
anti-hallucination, a **peer-review rubric** (0–100 + Accept/Revise/Reject), a
**devil's-advocate** mode, cross-session **handoff schemas**.

**Relevant as prior art** for CAOS's own methods: the rubric ↔ the CP-5 QA gate
([engine/gate.py](../server/engine/gate.py)); devil's-advocate ↔ CP-6A
Bull/Bear/Chair; verification/anti-hallucination ↔ the evidence-trace / CP-5B
lineage.

**Two hard limits:** (1) **CC-BY-NC** — commercial use prohibited, so it **cannot
be vendored** into CAOS; use it only to *inform* the CP-5/CP-6A design. (2) the
domain is academic (Semantic Scholar/arXiv/APA) — only the rigor *patterns*
transfer, not the bibliographic specifics.

## Excluded (reviewed, not useful)

- **Agent-Reach** — gives agents free access to Twitter/X, Reddit, YouTube,
  LinkedIn, etc. via local cookie/token reuse. Wrong domain (social scraping vs.
  internal deal docs) and an active **compliance/governance risk** for a
  regulated credit process — unvetted sources + ToS-circumvention conflict with
  MNPI handling and CP-0/CP-5 source discipline. The only adjacent slice
  (RSS/web reads for CP-MON/CP-SR) is thin and better served by a vetted feed.
- **taste-skill** — frontend design-quality skills (anti-slop, variance/motion/
  density dials, GSAP, brutalist/minimal variants). The anti-slop *goal* is
  sound, but the *methods* (variance, motion, expressive aesthetics) run opposite
  to CAOS's deliberately restrained brand, and the anti-slop value is already
  covered by `.impeccable.md` + the `frontend-design` skill. Redundant.
