"""The module-dispatch seam — which synthesizer runs for a module, and what run
state it receives.

Extracted from ``runner.synthesize_module`` (a ~100-line ``if module_id ==
"CP-…"`` chain) so the composition an engineer most needs to reason about and
test — *module → adapter → argument shape* — has an interface and is reachable
without executing a full run against a live database. ``runner`` keeps
orchestration (``_dependency_layers``, the ``_SESSION_SYNTH`` gate, the QA
phase); this module owns the wiring.

``RunContext`` is a frozen 7-field carrier so ``BINDERS`` stays a flat table and
the test seam (``tests/server/test_bindings.py``) is DB-free — ``frozen=True``
only prevents rebinding the fields, the live ``session`` inside stays usable.
Each ``_bind_*`` body is verbatim the code that lived under its ``if`` in the
runner: the subscript-vs-``.get`` on ``upstream`` is per-module and load-bearing
(copied exactly, never normalized), CP-1B returns its sync result un-awaited, and
CP-6A/CP-6E share ``_bind_debate`` (which reads ``ctx.module_id``). There is no
``bindings → runner`` edge; CP-1's source precedence lives in
``engine.cp1_sources`` (see ``docs/ENGINE_IMPLEMENTATION_SPEC.md`` P1·C1).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Awaitable, Callable, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer
from engine import cp1_sources
from engine.adjusted import reconcile_adjusted_ebitda
from engine.capstructure import synthesize_recovery_preference
from engine.catalysts import synthesize_catalysts
from engine.coststructure import synthesize_cost_structure
from engine.covenants import synthesize_covenants
from engine.debate import synthesize_debate
from engine.downside import synthesize_downside
from engine.earnings import synthesize_earnings_delta
from engine.factpack import synthesize_fact_pack
from engine.legal import synthesize_legal_review
from engine.liquidity import synthesize_liquidity
from engine.macro import synthesize_macro
from engine.peers import synthesize_peer_benchmark
from engine.portfoliofit import synthesize_portfolio_fit
from engine.readiness import synthesize_source_readiness
from engine.refinancing import synthesize_refinancing
from engine.relval import synthesize_relative_value
from engine.schemas import ModulePayload
from engine.sponsor import synthesize_sponsor_review
from engine.synth import RetrieveFn, Synthesizer


@dataclass(frozen=True)
class RunContext:
    """The run state one module's synthesis reads — issuer / upstream / retrieve —
    with no write path, so a layer's pure-synth modules run concurrently. A
    uniform carrier: every binder takes the same shape, so ``BINDERS`` is a flat
    table and the routing test needs no database. ``module_id`` is a field because
    ``_bind_debate`` reads it (CP-6A vs CP-6E)."""
    module_id: str
    session: AsyncSession
    issuer: Optional[Issuer]
    issuer_name: str
    synthesizer: Synthesizer          # engine.synth.Synthesizer
    upstream: Dict[str, ModulePayload]
    retrieve: RetrieveFn              # engine.synth.RetrieveFn
    portfolio_id: Optional[str] = None


Binder = Callable[["RunContext"], Awaitable[ModulePayload]]


async def _default_binder(ctx: RunContext) -> ModulePayload:
    """The fall-through: run the module's corpus Active Prompt (live) or its
    deterministic fixture (offline) through the shared synthesizer."""
    return await ctx.synthesizer.synthesize(
        ctx.module_id, issuer_name=ctx.issuer_name, upstream=ctx.upstream, retrieve=ctx.retrieve
    )


async def _bind_cp0(ctx: RunContext) -> ModulePayload:
    # CP-0 reads the issuer's own vaulted documents (no fixture), so a fresh
    # issuer reports its real source pack, not a canned one. A null-issuer run
    # falls through to the default (else it flips from default-output to Blocked).
    if ctx.issuer is None:
        return await _default_binder(ctx)
    return await synthesize_source_readiness(ctx.session, ctx.issuer)


async def _bind_cp2(ctx: RunContext) -> ModulePayload:
    # CP-2 = FundamentalCreditSynthesizer. Live mode runs the corpus Active Prompt
    # (full qualitative synthesis grounded in retrieved chunks + upstream); the
    # offline/fixture path falls back to the deterministic cost-structure read, so
    # the engine stays fully exercisable without a model key.
    if ctx.synthesizer.name == "live":
        return await ctx.synthesizer.synthesize(
            "CP-2", issuer_name=ctx.issuer_name, upstream=ctx.upstream, retrieve=ctx.retrieve
        )
    return await synthesize_cost_structure(ctx.issuer_name, ctx.retrieve)


async def _bind_cp1(ctx: RunContext) -> ModulePayload:
    # CP-1 prefers a deterministic EDGAR reported foundation for any public filer,
    # falling back to the LLM/fixture synthesizer; then it embeds the
    # reported-vs-adjusted (add-back) reconciliation it adjusts.
    cp1 = await cp1_sources.synthesize_cp1_reported(
        ctx.session, ctx.issuer, ctx.issuer_name, ctx.synthesizer, ctx.upstream, ctx.retrieve
    )
    # The add-back reconciliation strips a "% of adjusted EBITDA" haircut off
    # CP-1's EBITDA, so it is only correct when that EBITDA is the *adjusted*
    # (marketed) figure — the fixture / live-LLM basis. On a REPORTED basis
    # (EDGAR XBRL or issuer-disclosed) the EBITDA already excludes those
    # add-backs, so re-stripping them double-counts and manufactures a
    # worse-than-reported "deleveraging gap" — a provenance violation
    # ("reported is canonical"). Skip it there; the reported EBITDA already
    # carries its own limitation flag. The marketed-vs-reported bridge would
    # need the inverse math (E/(1-pct)) and is a separate deliberate feature.
    basis = (cp1.runtime_output or {}).get("basis")
    if basis not in ("reported_gaap_xbrl", "reported_disclosure"):
        res = await reconcile_adjusted_ebitda(cp1, ctx.retrieve)
        if res is not None:
            recon, claim = res
            (cp1.runtime_output or {})["adjusted_ebitda_reconciliation"] = recon
            cp1.claims.append(claim)
    return cp1


async def _bind_cp1a(ctx: RunContext) -> ModulePayload:
    # CP-1A is the BusinessTransactionFactPack: scan offering/transaction text.
    return await synthesize_fact_pack(ctx.retrieve)


async def _bind_cp1b(ctx: RunContext) -> ModulePayload:
    # CP-1B is a pure period-over-period delta off CP-1 (no docs/LLM).
    # synthesize_earnings_delta is sync — return it un-awaited.
    return synthesize_earnings_delta(ctx.upstream["CP-1"])


async def _bind_cp1c(ctx: RunContext) -> ModulePayload:
    # CP-1C benchmarks the issuer vs peers from the metric store. A null-issuer run
    # falls through to the default (else it flips from default-output to Blocked).
    if ctx.issuer is None:
        return await _default_binder(ctx)
    return await synthesize_peer_benchmark(ctx.session, ctx.issuer, ctx.upstream["CP-1"])


async def _bind_cp4c(ctx: RunContext) -> ModulePayload:
    # CP-4C owns covenant-capacity math against CP-1. When CP-4D ran, retain its
    # already schema-validated qualitative handoff as a bounded upstream input
    # record; it never replaces/recalculates CP-4C capacity and is not a hard gate.
    payload = await synthesize_covenants(ctx.upstream["CP-1"], ctx.retrieve)
    cp4d = ctx.upstream.get("CP-4D")
    handoff = (
        ((cp4d.runtime_output or {}).get("handoffs") or {}).get("cp_4c")
        if cp4d is not None else None
    )
    if isinstance(handoff, dict):
        payload.runtime_output = {
            **(payload.runtime_output or {}),
            "cp4d_structural_handoff": copy.deepcopy(handoff),
        }
    return payload


async def _bind_cp2b(ctx: RunContext) -> ModulePayload:
    # CP-2B stresses CP-1's leverage/coverage into downside pathways.
    return await synthesize_downside(ctx.upstream["CP-1"])


async def _bind_cp2c(ctx: RunContext) -> ModulePayload:
    # CP-2C registers forward catalysts from upstream monitoring signals.
    return await synthesize_catalysts(ctx.upstream)


async def _bind_cp2d(ctx: RunContext) -> ModulePayload:
    # CP-2D scans offering/governance text for sponsor red flags.
    return await synthesize_sponsor_review(ctx.retrieve)


async def _bind_cp2e(ctx: RunContext) -> ModulePayload:
    # CP-2E scans financial/agreement text for liquidity sources, and prices
    # the runway against CP-1's cash interest.
    return await synthesize_liquidity(ctx.retrieve, ctx.upstream.get("CP-1"))


async def _bind_cp2f(ctx: RunContext) -> ModulePayload:
    # CP-2F stresses CP-1's debt stack for base-rate sensitivity and scans for an
    # interest-rate hedge register / FX exposure.
    return await synthesize_macro(ctx.upstream["CP-1"], ctx.retrieve)


async def _bind_cp3(ctx: RunContext) -> ModulePayload:
    # CP-3 scores the issuer's fundamentals vs peers from CP-1C.
    return await synthesize_relative_value(ctx.upstream["CP-1C"])


async def _bind_cp3b(ctx: RunContext) -> ModulePayload:
    # CP-3B scans agreement/offering text for the debt tranches, then waterfalls
    # CP-1's distressed EV over them for expected recovery / instrument preference.
    return await synthesize_recovery_preference(ctx.retrieve, ctx.upstream.get("CP-1"))


async def _bind_cp3c(ctx: RunContext) -> ModulePayload:
    # CP-3C maps CP-3's RV recommendation to a portfolio sleeve/sizing; when the
    # run is bound to a portfolio, its concentration register goes live.
    return await synthesize_portfolio_fit(
        ctx.upstream["CP-3"], ctx.upstream.get("CP-1"), ctx.session, ctx.issuer, ctx.portfolio_id)


async def _bind_cp3d(ctx: RunContext) -> ModulePayload:
    # CP-3D scores refinancing/LME vulnerability from leverage + fragility.
    return await synthesize_refinancing(ctx.upstream["CP-1"], ctx.upstream.get("CP-2B"))


async def _bind_cp4(ctx: RunContext) -> ModulePayload:
    # CP-4 scans ingested agreement/covenant text for aggressive provisions.
    return await synthesize_legal_review(ctx.retrieve)


async def _bind_specialized(ctx: RunContext) -> ModulePayload:
    """CP-4D/CP-2G own full-bundle loading and source-gated synthesis.

    Keeping an explicit binder prevents a future fixture-table fallback from
    silently bypassing their source gates.
    """
    return await ctx.synthesizer.synthesize(
        ctx.module_id,
        issuer_name=ctx.issuer_name,
        upstream=ctx.upstream,
        retrieve=ctx.retrieve,
    )


async def _bind_debate(ctx: RunContext) -> ModulePayload:
    # CP-6A/6E are the L6 adversarial debate over the produced upstream outputs;
    # both keys route here and the binder reads ctx.module_id to pick the seat.
    return await synthesize_debate(ctx.module_id, ctx.upstream)


BINDERS: Dict[str, Binder] = {
    "CP-0": _bind_cp0,
    "CP-1": _bind_cp1,
    "CP-2": _bind_cp2,
    "CP-1A": _bind_cp1a,
    "CP-1B": _bind_cp1b,
    "CP-1C": _bind_cp1c,
    "CP-4C": _bind_cp4c,
    "CP-2B": _bind_cp2b,
    "CP-2C": _bind_cp2c,
    "CP-2D": _bind_cp2d,
    "CP-2E": _bind_cp2e,
    "CP-2F": _bind_cp2f,
    "CP-2G": _bind_specialized,
    "CP-3": _bind_cp3,
    "CP-3B": _bind_cp3b,
    "CP-3C": _bind_cp3c,
    "CP-3D": _bind_cp3d,
    "CP-4": _bind_cp4,
    "CP-4D": _bind_specialized,
    "CP-6A": _bind_debate,
    "CP-6E": _bind_debate,
}


async def resolve_binding(ctx: RunContext) -> ModulePayload:
    """Dispatch one module to its wired synthesizer — the composition test surface.
    Unmapped modules fall through to ``_default_binder`` (the corpus/fixture
    synthesizer)."""
    return await BINDERS.get(ctx.module_id, _default_binder)(ctx)
