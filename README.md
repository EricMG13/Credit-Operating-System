# Credit Operating System

**An institutional leveraged-finance credit-analysis platform** — a structured
analytical methodology (the *Modular OS* prompt corpus) implemented as a
deployable analyst workspace (**CAOS — Credit Agent OS**). It turns a deal's
source documents into a defensible credit view, with every figure one click from
its source and a deterministic QA gate standing between draft and committee.

Built for the **buy-side credit analyst** (deep work in Deep-Dive, Model Builder,
Report Studio), with secondary lenses for the **PM/CIO** (portfolio posture) and
**Head of Research / QA** (coverage health, the QA gate).

> Demo/portfolio build. Figures are anchored to a seeded reference deal —
> *Atlas Forge Industrials (ATLF)* — and much of the deep-dive UI is high-fidelity
> illustrative data; see **Status** below for exactly what is engine-derived vs seeded.

---

## What's in here

| Path | What it is |
|------|------------|
| [`Modular OS/`](Modular%20OS/) | The 27-module credit methodology — CP-0…CP-6E, CP-SR/MON/X, plus canonical schemas. Analytical **prose**, the single source of truth for module behaviour. |
| [`caos/`](caos/) | The app: Next.js 15 analyst UI (`frontend/`) + FastAPI engine/service (`server/`), deployed as a **single Databricks App**. See [caos/README.md](caos/README.md). |
| [`caos/docs/`](caos/docs/) | Architecture, audit, security, and planning docs (index below). |

## Capabilities

- **Tier-1 analytical engine** — runs the module slice (CP-0 → CP-1 → CP-2)
  followed by **CP-5B evidence-lineage validation** and the deterministic
  **CP-5 QA gate** (CRITICAL→Blocked, MATERIAL→Restricted, else Passed). Each
  claim is traced to an ingested source chunk via BM25 retrieval. Runs use a
  fixture synthesizer offline and live Claude when a key is set.
- **Six-concept analyst UI** — Command Center, Pipeline, Deep-Dive, Model
  Builder, Report Studio, and Monitor, plus a global **Ask (⌘K)** launcher.
- **Cross-issuer natural-language query** (Command Center) — structured metric
  ranking, semantic evidence retrieval, and a hybrid of both, with a
  **run / derived / seed provenance** ladder and **click-to-source** citations.
- **Model Builder** — a sourced cash-flow grid grounded in the live CP-1 run,
  a forward Scenario & Sensitivity lens (tornado), and a **Scenario Builder**
  (presets + natural language) that re-centers base/downside forecasts.
- **Report Studio** — a print-ready institutional tear-sheet, gated on
  committee-ready status.

## Architecture

One process serves everything: FastAPI exposes the JSON API under `/api` and
serves the **statically-exported** Next.js frontend at `/` (no Node in
production). Auth is platform-managed (Databricks workspace OAuth at the edge).
Storage is SQLite + a local vault by default; point `DATABASE_URL` at Lakebase
(Postgres) and `CAOS_STORAGE_DIR` at a Unity Catalog Volume for durability.
Schema is managed by **Alembic**; LLM features use Anthropic Claude
(`claude-opus-4-8`) and degrade to deterministic demo behaviour without a key.

```
Credit Operating System/
  Modular OS/        methodology corpus (CP-0…CP-6E, schemas)
  caos/
    frontend/        Next.js 15 (output: "export")
    server/          FastAPI app + Tier-1 engine (the Databricks App source)
    scripts/         build_frontend.sh (stages the UI into server/static)
    tests/           pytest (server) + Playwright (e2e)
    docs/            architecture / audit / security / plans
```

## Quickstart (local, single process — what production runs)

```bash
cd caos
python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt
./scripts/build_frontend.sh                 # builds the UI into server/static
cd server && ../.venv/bin/python run.py     # http://localhost:8000
```

UI hot-reload, Databricks deploy, and full test commands are in
**[caos/README.md](caos/README.md)**.

## Status

Healthy and deploy-ready (no P0/P1 — see [AUDIT.md](caos/docs/AUDIT.md)).

| Check | State |
|-------|-------|
| Server tests | 73 pytest ✓ |
| Frontend | eslint ✓ · `tsc --noEmit` (strict) ✓ · 98 vitest ✓ · `next build` ✓ |
| CI | [ci.yml](.github/workflows/ci.yml) runs all of the above |

**Engine-derived vs seeded (honest line):** the engine genuinely produces
CP-0/CP-1/CP-2 outputs, the QA gate, evidence lineage, and the metric store that
backs NL query. Much of the broader deep-dive/report UI is still high-fidelity
**seeded** demo data — tracked as finding A-1 in the audit. Values carry a
`run` / `derived` / `seed` provenance badge so the distinction is visible in-product.

## Docs

- [caos/README.md](caos/README.md) — deploy & local dev
- [caos/docs/AUDIT.md](caos/docs/AUDIT.md) — codebase audit & findings
- [caos/docs/SECURITY.md](caos/docs/SECURITY.md) — trust model & authz posture
- [caos/docs/TIER1_ENGINE_PLAN.md](caos/docs/TIER1_ENGINE_PLAN.md) — engine design
- [caos/docs/IA_REVIEW.md](caos/docs/IA_REVIEW.md) — information-architecture review
- [.impeccable.md](.impeccable.md) / [CLAUDE.md](CLAUDE.md) — design system & contributor guidance
