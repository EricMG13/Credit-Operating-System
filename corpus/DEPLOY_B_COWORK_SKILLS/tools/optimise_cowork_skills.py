#!/usr/bin/env python3
"""Idempotent progressive-disclosure migration for the Cowork deployment.

The live SKILL.md bodies are the source for non-canon module instructions. This
tool preserves each body (plus SYSTEM_REFERENCE.md where present) in a required
MODULE_RUNBOOK.md, replaces the entry with a compact launcher, sharpens routing
descriptions, consolidates the four cap-pressure skills, and regenerates each
companion index. Generated canon regions remain owned by tools/build_canon.py.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"
MANIFEST = ROOT / "COWORK_MIGRATION_MANIFEST.json"

CORE_HEADING = "# Canon Core (binding)"
COMPANION_HEADING = "# Companion Files"
RECAP_HEADING = "# Hard-Gate Recap"
RUNBOOK_MARKER = "<!-- COWORK_PROGRESSIVE_DISCLOSURE v1.0 -->"

DESCRIPTIONS = {
    "cp-parse-data-preparation": "Use CP-PARSE when a user supplies issuer, lender, legal, filing, presentation or schedule documents and needs pack-level selection, adaptive extraction, or ZIP-batched preparation for CP-0. Trigger on mixed-pack triage, difficult tables/charts/clauses/OCR, and multi-document packaging. Do not use for credit conclusions or legal interpretation.",
    "cp-0-source-readiness": "Use CP-0 only to inventory supplied sources, test authority and usability, identify gaps, and issue the source-readiness gate for a new issuer package. Trigger before financial or legal analysis. Do not extract canonical financials; use CP-1 after CP-0 clears the source set.",
    "cp-1-canonical-data-foundation": "Use CP-1 only to extract and normalise issuer financial statements into canonical metrics, calculation registers, entity perimeters, and definition conflicts. Trigger on issuer financials, debt basis, liquidity, CFO or FCF construction. Do not write the overall credit view; use CP-2.",
    "cp-1a-business-transaction-fact-pack": "Use CP-1A only to build a factual transaction, ownership, structure, and capitalisation pack for a specific deal or business combination. Trigger on acquisition or sponsor transaction facts. Do not perform earnings variance analysis; use CP-1B, and do not form the overall credit conclusion; use CP-2.",
    "cp-1b-earnings-delta": "Use CP-1B only to explain period-on-period earnings, cash-flow, leverage, and guidance deltas using CP-1 canonical values. Trigger on earnings releases, variance bridges, and result updates. Do not rebuild source financials; use CP-1, and do not benchmark peers; use CP-1C.",
    "cp-1c-peer-benchmark": "Use CP-1C only to select a defensible peer set and benchmark operating, cash-flow, leverage, and valuation metrics on aligned definitions. Trigger on peer comparison, outliers, trading comps, or relative standing. Do not register event catalysts; use CP-2B, and do not select securities; use CP-3.",
    "cp-2-fundamental-credit-synthesizer": "Use CP-2 only to synthesize business risk, financial profile, ownership, outlook, and downside evidence into the overall fundamental credit view. Trigger after CP-1 inputs exist. Do not interpret legal covenants; use CP-4, and do not calculate a specific downside path; use CP-2A.",
    "cp-2a-downside-pathway": "Use CP-2A only to construct causal downside pathways, stress transmission, breakpoints, and default-risk escalation from the CP-2 base view. Trigger on downside scenarios or zero-bound chains. Do not assess ESG themes; use CP-2F, and do not calculate liquidity bridges; use CP-2D.",
    "cp-2b-event-catalyst-register": "Use CP-2B only to register dated issuer events and catalysts, classify probability and credit transmission, and define monitoring windows. Trigger on corporate actions, regulatory events, maturities, or catalysts. Do not perform peer benchmarking; use CP-1C, and do not aggregate a current intelligence digest; use CP-EMAIL.",
    "cp-2c-governance-sponsor-score": "Use CP-2C only to score governance, sponsor behaviour, ownership incentives, and creditor alignment. Trigger on private-equity sponsors, governance quality, or capital-allocation conduct. Do not build liquidity and cash-flow bridges; use CP-2D, and do not model macro or FX sensitivity; use CP-2E.",
    "cp-2d-liquidity-cash-flow-bridge": "Use CP-2D only to reconcile liquidity sources and uses, cash conversion, maturity coverage, and refinancing runway on a consistent entity perimeter. Trigger on liquidity bridge, FCF durability, or funding runway. Do not score governance; use CP-2C, and do not model macro or FX sensitivity; use CP-2E.",
    "cp-2e-macro-fx-hedging-sensitivity": "Use CP-2E only to map macro, currency, rates, commodity, and hedging sensitivities into issuer credit effects. Trigger on FX, rate, inflation, commodity, or hedge questions. Do not build the core liquidity bridge; use CP-2D, and do not score governance; use CP-2C.",
    "cp-2f-esg-sustainability-credit-risk": "Use CP-2F only to translate environmental, social, and sustainability factors into material credit mechanisms and time horizons. Trigger on transition risk, physical risk, social licence, or sustainability liabilities. Do not construct the general downside pathway; use CP-2A, and do not calculate covenant capacity; use CP-4A.",
    "cp-2g-forward-credit-model": "Use CP-2G for auditable issuer base, upside and downside forecasts of earnings, free cash flow, debt, liquidity, leverage, coverage and deleveraging. Trigger on forward credit models, multi-period forecast cases, leverage trajectories or financial breakpoints. Do not use for a qualitative downside chain (CP-2A), near-term liquidity bridge (CP-2D), ratings triggers (CP-2H) or security selection (CP-3).",
    "cp-2h-ratings-migration-trigger": "Use CP-2H to map sourced agency ratings, outlooks, methodologies and issuer-specific upgrade or downgrade triggers against forecast cases. Trigger on rating headroom, migration pressure, agency divergence, notching implications or downgrade catalysts. Do not use to issue a shadow/formal rating, build the forecast (CP-2G), select securities (CP-3) or aggregate an intelligence digest (CP-EMAIL).",
    "cp-3-relative-value-security-selection": "Use CP-3 only to compare priced instruments, relative value, spread compensation, and security-selection trade-offs after the credit view exists. Trigger on bonds, loans, curve, spread, or instrument choice. Do not determine recovery ranking; use CP-3A, and do not size a portfolio position; use CP-3B.",
    "cp-3a-recovery-instrument-preference": "Use CP-3A only to map capital structure, collateral, priority, and recovery scenarios into instrument preference. Trigger on recovery, ranking, collateral, structural subordination, or waterfall questions. Do not interpret covenant language; use CP-4, and do not set portfolio size; use CP-3B.",
    "cp-3b-portfolio-fit-position-sizing": "Use CP-3B only to translate an approved credit and instrument view into portfolio fit, concentration limits, and position size. Trigger on sizing, risk budget, concentration, or portfolio compatibility. Do not select the security; use CP-3, and do not chair the portfolio challenge; use CP-6A.",
    "cp-3c-refinancing-lme-risk": "Use CP-3C only to analyse maturity walls, refinancing feasibility, liability-management transactions, creditor-on-creditor risk, and coercion pathways. Trigger on exchanges, uptiers, drop-downs, or refinancing stress. Do not interpret the governing covenant package; use CP-4, and do not calculate basket capacity; use CP-4A.",
    "cp-3d-market-implied-credit-technicals": "Use CP-3D for timestamped bond/loan pricing, issuer curves, market-implied break-even risk, liquidity evidence, trading technicals and fundamental-versus-market divergence. Trigger on what spreads or prices imply, curve anomalies, liquidity/flow pressure or market dislocation. Do not use for the final relative-value recommendation (CP-3), recovery preference (CP-3A) or position sizing (CP-3B).",
    "cp-4-legal-covenant-interpreter": "Use CP-4 to construe controlling debt documents and produce provision-level findings on definitions, permissions, leakage, defaults, remedies, and amendment exposure. Trigger on qualitative clause meaning or document authority. Quantitative headroom belongs to CP-4A; entity claim topology belongs to CP-4B.",
    "cp-4a-covenant-capacity-calculator": "Use CP-4A as the numeric covenant engine after CP-4 has supplied interpreted definitions. Trigger on incremental-debt availability, restricted-payment capacity, investment room, EBITDA add-back capacity, ratio baskets, or the nearest binding constraint. Raw-document construction belongs to CP-4.",
    "cp-4b-restricted-group-guarantee-map": "Use CP-4B to build the legal-entity claim graph showing obligors, non-obligors, guarantors, restricted or unrestricted subsidiaries, collateral reach, and structural subordination. Trigger on which assets and entities support a creditor claim. Clause construction belongs to CP-4; capacity arithmetic belongs to CP-4A.",
    "cp-4c-restructuring-fulcrum": "Use CP-4C after a documented distress gate to compare restructuring paths, reconcile claims and priority, value the reorganised enterprise, identify the fulcrum range and estimate class recoveries. Trigger on formal restructuring, Chapter 11/scheme/administration scenarios, fulcrum securities or plan recoveries. Do not use for ordinary recovery (CP-3A), pre-default refinancing/LME risk (CP-3C) or legal advice.",
    "cp-5a-research-integrity-qa": "Use CP-5A only as the final research-integrity gate that grades analytical outputs, applies severity rules, sets qa_status, and blocks or restricts committee use. Trigger after evidence validation. Do not trace individual claims from scratch; use CP-5 first, and do not perform the IC debate; use CP-6.",
    "cp-5-evidence-trace-validator": "Use CP-5 only to verify claim-to-source lineage, locators, calculations, conflicts, and handoff consistency before CP-5A. Trigger on evidence-trace validation or citation integrity. Do not issue the final research QA disposition; use CP-5A.",
    "cp-6-ic-debate-challenge": "Use CP-6 only to conduct the adversarial investment-committee debate, test bull and bear cases, expose the greatest uncertainty, and determine action bias. Trigger after analytical and QA gates. Do not determine final portfolio posture; use CP-6A, and do not redo underlying module analysis.",
    "cp-6a-portfolio-debate-challenge": "Use CP-6A only to challenge portfolio consequences, sizing, liquidity, concentration, and exit risk and determine terminal portfolio posture. Trigger after CP-6 or an established allocation view. Do not rerun the issuer IC debate; use CP-6, and do not create initial sizing; use CP-3B.",
    "cp-8-decision-ledger-post-mortem": "Use CP-8 only after a decision to record rationale, assumptions, dissent, outcomes, and post-mortem learning without changing the live recommendation. Trigger on decision ledger or retrospective review. Do not gate a current pathway or aggregate current intelligence; use CP-EMAIL for a display-only digest.",
    "cp-dr-deep-research": "Use CP-DR for a standalone, user-scoped issuer or sector research question that needs an approved plan, iterative retrieval, contradiction testing, evidence-quality control and cited synthesis. CP-0 is optional. Do not use for a current intelligence digest (CP-EMAIL), a single catalyst register (CP-2B), or automatic multi-module execution; any specialist follow-up is a new user-started command.",
    "cp-email-credit-intelligence-classifier": "Use CP-EMAIL to retrieve accessible mailbox and public-source intelligence, resolve entities and stories, deduplicate, classify, rank, and display one coverage-qualified HY, loan, or CLO digest. Trigger on daily briefs, watchlists, issuer or sector news, ratings, regulation, market commentary, or monitoring exceptions. It has no required CP upstream, creates no artifact, and may only recommend a manual CP-X or specialist follow-up; use CP-DR for a scoped deep-research report and CP-2B for a single catalyst register.",
    "cp-x-planner-router": "Use CP-X PlannerRouter only to select the minimal sufficient named pathway, validate dependencies, and produce a route plan without executing analytical skills. Trigger on what module or pathway should run next. Do not execute an end-to-end multi-skill pipeline; use RBOT Orchestrator.",
    "rbot-orchestrator": "Use RBOT Orchestrator only for a multi-module end-to-end pathway that must invoke skills, gate each handoff, propagate limitations, and stop on Blocked. Trigger on full credit, covenant, earnings, distressed, relative-value, portfolio, or user-directed specialist pipelines. Do not use for a single-module request; invoke that module directly. CP-EMAIL remains standalone and does not auto-start an orchestrated pathway.",
}

MERGES = {
    "cp-2-fundamental-credit-synthesizer": [
        ("REF_CP-2_02-04_OperatingModel.md", [
            "REF_CP-2_02_CompanyDescription.md", "REF_CP-2_03_OwnershipGroupStructure.md",
            "REF_CP-2_04A_RevenueDriversPricingPower.md", "REF_CP-2_04B_CostStructureMarginResilience.md",
            "REF_CP-2_04C_CapitalIntensityFCFConversion.md",
        ]),
    ],
    "cp-4-legal-covenant-interpreter": [
        ("REF_CP-4_01-02_LegalSourceGate.md", [
            "REF_CP-4_01_LegalFileGateSourceQuality.md", "REF_CP-4_02_ControllingDocumentsSourceAuthority.md",
        ]),
    ],
    "cp-1c-peer-benchmark": [
        ("REF_CP-1C_04_BenchmarkAnalysis.md", [
            "REF_CP-1C_04A_OperatingBenchmark.md", "REF_CP-1C_04B_CashFlowCapitalIntensity.md",
            "REF_CP-1C_04C_CreditMetricBenchmark.md", "REF_CP-1C_04D_SummaryStatistics.md",
        ]),
    ],
}

FOLD_INTO_RUNBOOK = {
    "cp-4-legal-covenant-interpreter": [
        "REF_CP-4_AggressivenessRubric.md", "REF_CP-4_EDGARCovenantSourceMap.md",
        "REF_CP-4_ExampleOutputPattern.md",
    ],
}

def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def frontmatter(text: str) -> tuple[str, str]:
    m = re.match(r"\A---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        raise SystemExit("missing frontmatter")
    return m.group(0), m.group(1)


def fm_value(fm: str, key: str) -> str:
    m = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", fm, re.M)
    if not m:
        raise SystemExit(f"frontmatter missing {key}")
    return m.group(1)


def replace_description(block: str, value: str) -> str:
    return re.sub(r"^description:.*$", "description: " + value, block, count=1, flags=re.M)


def append_section(target: str, title: str, source_name: str, content: str) -> str:
    marker = f"<!-- EMBEDDED:{source_name} -->"
    if marker in target:
        return target
    return target.rstrip() + f"\n\n{marker}\n# {title}\n\n" + content.strip() + "\n"


def merge_files(refs: Path, target_name: str, source_names: list[str], manifest: list[dict]) -> dict[str, str]:
    target = refs / target_name
    replacements = {}
    if not target.exists():
        parts = [f"# Consolidated companion — {target_name}\n"]
        for name in source_names:
            source = refs / name
            if not source.exists():
                raise SystemExit(f"missing merge source {source}")
            content = read(source)
            parts.append(f"\n<!-- MERGED_FROM:{name} sha256={sha(content)} -->\n## Source: {name}\n\n{content.strip()}\n")
            manifest.append({"action": "merge", "source": str(source.relative_to(ROOT)), "sha256": sha(content), "destination": str(target.relative_to(ROOT))})
        write(target, "".join(parts))
    for name in source_names:
        source = refs / name
        replacements[name] = target_name
        if source.exists():
            source.unlink()
    return replacements


def regenerate_companion_index(refs: Path) -> str:
    files = sorted(p.name for p in refs.iterdir() if p.is_file())
    priority = {"MODULE_RUNBOOK.md": 0, "CANON_RELEVANT.md": 1}
    files.sort(key=lambda n: (priority.get(n, 2), n))
    lines = [COMPANION_HEADING, "", "Progressive disclosure: load the runbook for every invocation; open other companions only at the workflow step or ambiguity that needs them.", ""]
    for name in files:
        if name == "MODULE_RUNBOOK.md":
            note = "binding full module role, workflow, method, system rules, and export specifics; load before analysis"
        elif name == "CANON_RELEVANT.md":
            note = "module-profiled canon; open only the sections needed to resolve an ambiguity"
        elif name == "SCHEMA_REFERENCE.md":
            note = "output sections, tables, schema, and QA checklist; load at export and QA"
        else:
            note = "step or method companion; load only when the runbook invokes it"
        lines.append(f"- `./references/{name}` — {note}.")
    return "\n".join(lines) + "\n\n"


def migrate_skill(skill_dir: Path, manifest: list[dict]) -> None:
    slug = skill_dir.name
    if slug not in DESCRIPTIONS:
        raise SystemExit(f"no routing description for {slug}")
    skill_path = skill_dir / "SKILL.md"
    refs = skill_dir / "references"
    text = read(skill_path)
    fm_block, fm_inner = frontmatter(text)
    name = fm_value(fm_inner, "name")
    new_fm = replace_description(fm_block, DESCRIPTIONS[slug])

    core_pos = text.find(CORE_HEADING)
    companion_pos = text.find(COMPANION_HEADING)
    recap_pos = text.find(RECAP_HEADING)
    if min(core_pos, companion_pos, recap_pos) < 0 or not (core_pos < companion_pos < recap_pos):
        raise SystemExit(f"unsupported SKILL layout: {skill_path}")

    runbook_path = refs / "MODULE_RUNBOOK.md"
    if not runbook_path.exists():
        original_body = text[len(fm_block):core_pos].strip()
        runbook = f"{RUNBOOK_MARKER}\n# {name} — module runbook\n\n{original_body}\n"
        manifest.append({"action": "extract_module_body", "source": str(skill_path.relative_to(ROOT)), "sha256": sha(original_body), "destination": str(runbook_path.relative_to(ROOT))})
    else:
        runbook = read(runbook_path)

    system_ref = refs / "SYSTEM_REFERENCE.md"
    if system_ref.exists():
        content = read(system_ref)
        runbook = append_section(runbook, "Embedded system reference", system_ref.name, content)
        manifest.append({"action": "fold_into_runbook", "source": str(system_ref.relative_to(ROOT)), "sha256": sha(content), "destination": str(runbook_path.relative_to(ROOT))})
        system_ref.unlink()

    replacements: dict[str, str] = {}
    for target, sources in MERGES.get(slug, []):
        replacements.update(merge_files(refs, target, sources, manifest))

    for source_name in FOLD_INTO_RUNBOOK.get(slug, []):
        source = refs / source_name
        if source.exists():
            content = read(source)
            runbook = append_section(runbook, f"Embedded method — {source_name}", source_name, content)
            manifest.append({"action": "fold_into_runbook", "source": str(source.relative_to(ROOT)), "sha256": sha(content), "destination": str(runbook_path.relative_to(ROOT))})
            source.unlink()
        replacements[source_name] = "MODULE_RUNBOOK.md"

    for old, new in replacements.items():
        runbook = runbook.replace(old, new)
    write(runbook_path, runbook)

    core_and_markers = text[core_pos:companion_pos]
    recap_and_tail = text[recap_pos:]
    module_id = re.search(r"CP-[A-Z0-9]+", name.upper())
    module_label = module_id.group(0) if module_id else name
    launcher = (
        f"# Module: {module_label}\n\n"
        "## Progressive-disclosure entry launcher\n\n"
        "Every invocation is a full run. Before analysis, load `./references/MODULE_RUNBOOK.md`; "
        "it preserves the binding role, complete workflow, methods, system rules, and module-specific "
        "export requirements. Load each other step companion only when the runbook invokes it. Open "
        "only the relevant sections of `./references/CANON_RELEVANT.md` when the inline hard gates or "
        "runbook do not resolve a source, calculation, taxonomy, schema, or QA ambiguity. Never replace "
        "the runbook with a summary and never skip a workflow step.\n\n"
    )
    new_text = new_fm + launcher + core_and_markers + regenerate_companion_index(refs) + recap_and_tail
    write(skill_path, new_text)


def main() -> int:
    actions: list[dict] = []
    prior_actions: list[dict] = []
    if MANIFEST.exists():
        prior_actions = json.loads(read(MANIFEST)).get("actions", [])
    skill_dirs = sorted(p for p in SKILLS.iterdir() if p.is_dir() and not p.name.startswith("."))
    if set(p.name for p in skill_dirs) != set(DESCRIPTIONS):
        missing = set(p.name for p in skill_dirs) ^ set(DESCRIPTIONS)
        raise SystemExit(f"description map/skill tree mismatch: {sorted(missing)}")
    for skill_dir in skill_dirs:
        migrate_skill(skill_dir, actions)
    recorded = prior_actions + [a for a in actions if a not in prior_actions]
    payload = {"version": "1.0", "skills": len(skill_dirs), "actions": recorded}
    write(MANIFEST, json.dumps(payload, indent=2) + "\n")
    print(f"optimise: PASS — {len(skill_dirs)} skills, {len(actions)} new / {len(recorded)} recorded preserved-content actions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
