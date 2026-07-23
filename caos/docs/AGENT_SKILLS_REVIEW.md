# Agent-Skills Repo Review — Octagon AI & VoltAgent

**Date:** 2026-06-15 · **Sources:** GitHub — [OctagonAI/skills](https://github.com/OctagonAI/skills),
[VoltAgent org](https://github.com/orgs/VoltAgent/repositories) (`awesome-agent-skills`,
`awesome-claude-code-subagents`, `voltagent`, `awesome-design-md`). **Lens:** fit
to CAOS — a leveraged-finance credit platform (PDF/XLSX deal docs → vault →
chunks → CP-0 → BM25 retrieval → evidence-traced output, with the **Model
Builder**, **Report Studio**, **CP-5 QA gate**, **CP-5B** lineage, **CP-6A**
debate, **CP-MON** monitoring). Companion to
[FINANCE_SKILLS_REVIEW.md](FINANCE_SKILLS_REVIEW.md) and
[TOOLING_REVIEW.md](TOOLING_REVIEW.md).

**Hard constraint:** **no paid services or external vendor dependencies.** CAOS
adopts only **free, open-source, or self-hostable** code and methodology. This is
a gating filter across the whole review — and it changes the Octagon verdict
materially, because Octagon's value is delivered through a **paid, keyed data
API**.

**Framing — the two repos are on different axes** (they don't compete):

- **Octagon = runtime financial capability**, delivered through the **hosted
  Octagon MCP** behind a **paid `OCTAGON_API_KEY`**. Under the constraint the
  *data* is out; only the **MIT-licensed open methodology** survives.
- **VoltAgent = dev-time building capability** — catalogs of developer
  skills/subagents (mostly free/OSS) plus a TypeScript framework (free, but
  architecturally wrong for CAOS).

Non-negotiable unchanged: committee numbers must feed **CP-5B** lineage
([engine/lineage.py](../server/engine/lineage.py)) and clear **CP-5**
([engine/gate.py](../server/engine/gate.py)). *A number with no source trace is
exactly what the platform prevents.*

---

## Verdict at a glance

| Repo / skill group | License / cost | Verdict | Fit to CAOS |
|---|---|---|---|
| **Octagon — data via hosted MCP** (runtime of all 66 skills) | MIT skill · **paid API key** | **Exclude (paid)** | Entire runtime value needs `OCTAGON_API_KEY` + vendor egress — out under the constraint. |
| **Octagon — SEC skill *taxonomy* as methodology** (risk-factors / MD&A / footnotes / **covenants** / segment / governance) | MIT (free) | **Reference only** | The open *structure* is a free coverage checklist for CP-0 + the Modular OS prompts; no API, no wiring, no key. |
| **SEC EDGAR direct** — the free path to the same data | public / **free** | **Adopt (path)** | Official primary source: free, and *better* CP-5B provenance than an aggregator. The constraint-compliant way to get Octagon's data value (§2). |
| **VoltAgent — `voltagent` framework** (TS) | MIT (free) | **Exclude** | Duplicates the FastAPI Tier-1 engine; forks the stack to TypeScript. |
| **VoltAgent — free/OSS dev skills** (Anthropic **MCP Builder**, **Playwright**, Trail of Bits + **Semgrep**, coding subagents) | MIT/Apache (free) | **Selective (dev-time)** | Build/harden CAOS at zero cost; see §4. |
| **VoltAgent — paid-SaaS skills** (Sentry, Datadog, Azure Doc Intelligence, CodeQL on a private repo) | **paid** | **Exclude → OSS swap** | Replace with self-hosted OTel + Semgrep + the landed markitdown spike (§4). |
| **VoltAgent — design catalogs** (`awesome-design-md`) | MIT | **Exclude** | Redundant with `.impeccable.md` + `frontend-design`. |

---

## 1. Octagon under the constraint — methodology survives, data does not

Octagon is the closest *domain* fit reviewed to date — 66 finance skills spanning
SEC filings (incl. **debt covenants / credit agreements**), earnings analysis,
three-statement fundamentals + growth, and distress scores (Altman Z, Piotroski).
But every one of those skills is a thin client over the **hosted Octagon MCP**,
which requires a **paid `OCTAGON_API_KEY`** and routes data through a third-party
vendor. Under *no paid services*, the **entire runtime is out**.

What remains free is the repo's **MIT-licensed skill definitions** — i.e. the
*methodology*, not the data. The most useful slice is the **SEC skill taxonomy**:
the way Octagon decomposes a filing into risk-factors / MD&A / footnotes /
**covenant package** / segment / governance is a ready-made **coverage checklist**
to enrich CP-0 source-readiness and the Modular OS prompts — adopted by reading,
with zero integration, zero key, zero egress. The `sec-debt-covenant` *checklist*
(what a covenant package contains and how to categorize it) is worth lifting; its
*data fetch* is not.

## 2. The free path to the same capability — SEC EDGAR direct

If you want Octagon's actual data value without a vendor, the answer is **SEC
EDGAR**, which is free, official, and public:

- **EDGAR full-text search** (`efts.sec.gov`) + the **submissions** and
  **company-facts / XBRL frames** JSON APIs (`data.sec.gov`) — no key, fair-access
  rate-limited with a `User-Agent`.
- It is the **primary source**, so it *strengthens* CP-5B: a memo cites the filing
  on EDGAR, not an aggregator's read of it.
- It slots straight into the existing pipeline — fetch → [ingest.py](../server/ingest.py)
  (markitdown handles the table-dense parsing) → vault → chunks → retrieval →
  E-xx citation.

**Caveats (same as Octagon, minus the cost):** public-filer coverage only —
strong for HY issuers with public debt (10-K filers), thin for pure-private,
sponsor-owned borrowers; and you build the fetch/parse yourself. More build
effort than a keyed API, but **$0 and better provenance**.

## 3. Provenance principle (now governs the EDGAR path)

The gate rule from the prior revision still holds — it simply applies to EDGAR
instead of Octagon:

> An external source — **even free** EDGAR — may inform, bootstrap, or monitor,
> but a number that lands in a memo triggers CAOS to re-vault the underlying
> filing for a genuine **E-xx** citation and **CP-5B** lineage. Until then it is
> flagged `external · unverified` and is blocked from clearing **CP-5**.

EDGAR happens to satisfy this more cleanly than Octagon ever could: re-vaulting
the *primary* document is trivial when your source already *is* the primary
document.

## 4. VoltAgent — free/OSS dev-time picks (paid SaaS swapped out)

The `voltagent` **framework** is excluded (architecture conflict — it duplicates
[engine/runner.py](../server/engine/runner.py) / [gate.py](../server/engine/gate.py)).
The value is the **catalogs**, re-filtered to free/OSS only:

- **Anthropic MCP Builder** (free) — wrap the free EDGAR fetch as a typed MCP
  tool behind the gate; the clean way to bring §2 data in.
- **Playwright** (OSS) — UI regression on dense numeric panels (tear-sheet tables,
  Model Builder) — the class of hand-fixed spacing/footer bugs in recent commits.
- **Trail of Bits + Semgrep** (free OSS) — security-focused diff review /
  insecure-defaults, extending SEC-1 and [SECURITY.md](SECURITY.md). **Note:**
  CodeQL is free only for *public* repos — on a private CAOS repo it needs paid
  GitHub Advanced Security, so use **Semgrep** (free OSS) instead.
- **Coding subagents** (MIT) — `fastapi-developer`, `nextjs-developer`,
  `quant-analyst`, `risk-manager`, `security-auditor` map 1:1 onto the stack.
- **Observability without a paid SaaS** — skip **Sentry / Datadog**; instrument
  with **OpenTelemetry** (free SDK) and self-host a backend (**SigNoz**,
  **GlitchTip**, or **Grafana Tempo + Loki**) if/when you want traces on the
  deployed app + engine runs.
- **Doc extraction** — **Azure Doc Intelligence is paid**; already covered free by
  the landed **markitdown** out-of-process spike (TOOLING_REVIEW §1).
- **Design catalogs** — excluded; redundant with `.impeccable.md`.

---

## Net

Under **no paid services**, Octagon collapses from "adopt behind the gate" to
**methodology-only reference** — its value lived in a paid, keyed data API. The
free way to get that same data capability is **SEC EDGAR direct**, which is also
*better*-provenanced for CP-5B and reuses the markitdown pipeline; it costs build
effort, not dollars. From VoltAgent, the free/OSS dev-time picks stand (MCP
Builder, Playwright, Semgrep, coding subagents); the paid-SaaS items (Sentry,
Datadog, Azure Doc Intelligence, private-repo CodeQL) are swapped for self-hosted
**OpenTelemetry + Semgrep + markitdown**. Everything retained is free, OSS, or
first-party — no vendor lock-in, no recurring cost.

Sequencing: lift Octagon's **SEC/covenant taxonomy** into the Modular OS prompts
(free, today), then — if you want the data capability — build a small **EDGAR
fetch wrapped as an MCP tool** (MCP Builder), gated `external · unverified` and
re-vaulted on use, proving the §3 pattern on the highest-value content before any
broader build.

**Status (2026-06-15):** both shipped. The taxonomy is in
`Modular OS/CP-4/REF_CP-4_EDGARCovenantSourceMap.md` (wired into the Step-1 Legal
File Gate); the EDGAR lane is implemented at `/api/edgar/*`
(`caos/server/edgar.py`, `routes/edgar.py`) with a 3.10+ MCP wrapper in
`caos/mcp/edgar/`. Pointers are `external · unverified`; `vault-exhibit` makes a
fetched exhibit an E-xx-eligible primary source. Off until `EDGAR_USER_AGENT` is
set — free, no key. 15 new tests (`tests/server/test_edgar.py`), full suite green.
