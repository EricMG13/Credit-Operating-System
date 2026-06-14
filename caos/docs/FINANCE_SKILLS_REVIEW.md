# Finance / Quant Skills Review — complements to CAOS

**Date:** 2026-06-14 · **Sources:** [Snyk: Top Claude Skills for Finance &
Quant Developers](https://snyk.io/articles/top-claude-skills-finance-quantitative-developers/)
+ GitHub. **Lens:** what genuinely *complements* CAOS — a leveraged-finance
credit platform (document → evidence → Tier-1 engine → committee output, with a
cash-flow **Model Builder**, **Report Studio**, the **CP-5 QA gate**, **CP-6A**
debate, **CP-3B** recovery). Companion to [TOOLING_REVIEW.md](TOOLING_REVIEW.md).

**Framing:** these are agentic *Claude skills* (methodology + optional reference
scripts), not drop-in modules for a deployed FastAPI/Next app. The benefit to
CAOS lands in three layers: **(a)** reusable Apache/MIT **reference code** that
can make a mock surface real; **(b)** **methodology** to enrich the engine's LLM
synth and the Modular OS prompts; **(c)** **governance reference**. Non-negotiable:
anything adopted must feed CAOS's evidence lineage (CP-5B) and clear the QA gate
(CP-5) — a number with no source trace is exactly what the platform prevents.

## Verdict at a glance

| Skill / repo | License | Verdict | Fit to CAOS |
|---|---|---|---|
| [Anthropic financial-modeling](https://github.com/anthropics/claude-cookbooks) | Apache-2.0 | **Adopt (top)** | LBO/debt-capacity, **Monte Carlo, sensitivity, best/base/worst** — exactly the Model Builder's domain; reusable code. |
| Official Anthropic **xlsx/docx/pptx/pdf** skills | first-party | **Adopt** | Real working-formula Excel model + Word/PPT IC pack for Report Studio. |
| [JoelLewis/finance_skills](https://github.com/JoelLewis/finance_skills) (Compliance) | MIT | **Reference** | Books-records/WORM, conflicts, KYC/AML methodology → extend CP-5 governance. No MNPI/credit/covenant skills (gap). |
| [K-Dense-AI/claude-scientific-skills](https://github.com/K-Dense-AI/claude-scientific-skills) | MIT | **Selective** | Time-series (ARIMA/GARCH), stats → CP-3 RV/spread + recovery distributions. |
| [quant-sentiment-ai/claude-equity-research](https://github.com/quant-sentiment-ai/claude-equity-research) | MIT | **Patterns only** | Bull/base/bear + position-sizing structure ↔ CP-6A / CP-6E, but *equity* domain. |
| Data-analysis / CSV-summarizer skills | MIT | **Marginal** | Data-quality validation for CP-0 source readiness on pricing sheets. |
| [claude-code-plugins-plus](https://github.com/jeremylongshore/claude-code-plugins-plus-skills) (backtesting/algo) | MIT | **Exclude** | Systematic/algo trading — off-domain for fundamental credit. |

## 1. Anthropic financial-modeling — highest fit (Apache-2.0)

DCF/WACC, **LBO (IRR/MOIC/debt-capacity)**, **Monte Carlo** (distributions,
confidence intervals), **sensitivity (tornado)**, and **best/base/worst**
scenarios — with runnable Python and balance/cash-flow reconciliation checks.

**Why it's the strongest complement:** CAOS is leveraged finance and the **Model
Builder (Concept D)** is the natural home. Its sensitivity + best/base/worst map
directly onto a credit cash-flow lens; LBO/debt-capacity is the credit core;
Monte Carlo maps onto **CP-3B recovery** distributions. Apache-2.0 means the
methodology *and* code are reusable.

**Acted on (this session):** added a forward **Scenario & Sensitivity** lens to
the Model Builder — best/base/worst cash-flow projections + an **adjustable
tornado** — see [lib/model/scenarios.ts](../frontend/src/lib/model/scenarios.ts).
Kept it a **cash-flow** model (no DCF/valuation swapped in).

## 2. Official Anthropic office skills — deliverables

Working-formula **Excel** (NPV/IRR/three-statement/sensitivity), **Word**, **PPT**.
Report Studio prints a light PDF and the Model Builder exports CSV; a real Excel
workbook with live formulas + a docx/pptx IC pack make the deliverables
committee-grade and auditable. Prefer the first-party skills over third-party
clones.

## 3. Compliance methodology — governance (MIT, partial)

`finance_skills` Compliance plugin (books-records SEC 17a-3/17a-4 **WORM**,
conflicts, KYC/CIP/CDD, BSA/AML, Reg S-P). Complements the CP-5 governance and
the [SECURITY.md](SECURITY.md) audit trail. **Caveat:** wealth-management/advisory
compliance — **no MNPI, credit, or covenant** coverage; reference, not a fit.

## 4. Quant analytics — selective (MIT)

K-Dense time-series (GARCH for spread vol, ARIMA) + a quant agent (VaR, Sharpe)
for the **CP-3 RV/spread** and recovery-distribution work. Adopt specific calcs,
not wholesale.

## Patterns-only / excluded

- **claude-equity-research** — bull/base/bear + sizing *patterns* transfer to
  CP-6A/CP-6E; the equity domain (options flow, equity valuation) does not.
- **Data-analysis / CSV-summarizer** — outlier/distribution checks could harden
  CP-0 source readiness on uploaded pricing sheets; marginal (CAOS ingests XLSX).
- **claude-code-plugins-plus (backtesting/algo)** — systematic trading is
  off-domain for an IC-memo credit workflow.

## Net

The single highest-leverage complement is the **Anthropic financial-modeling
skill** — right domain (LBO/debt-capacity/recovery), right license (Apache-2.0,
reusable), filling CAOS's clearest gap (a richer Model Builder). Office skills
and compliance methodology are solid secondary adds; quant-analytics is
selective; equity-research and backtesting are off-domain. Licenses are clean
(Apache-2.0 / MIT) — no NonCommercial trap.
