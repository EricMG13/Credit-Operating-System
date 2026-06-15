# CAOS — Loan Compare data schema (`deal_terms`)

**Surface:** new top-level concept `/compare` · **Backend:** `/api/compare` +
`engine/terms_catalog.py` (extends `engine/covenants.py`) · **Storage:** two new
tables `deals` / `deal_terms` · **Ships in:** the existing single-container
Phase-1 stack — no new service · **Last updated:** 2026-06-15

A structured covenant/documentation comparison: deals as columns (one pinned as
**Benchmark**), terms as rows, grouped into ~22 collapsible sections —
*"compare covenants or discover loopholes in specific loans."* This is a
Reorg/Octus/9fin/Covenant-Review-style view, built natively on CAOS's
evidence-traced engine rather than a licensed covenant feed (no paid services).
Companion docs: [TIER1_ENGINE_PLAN](TIER1_ENGINE_PLAN.md) ·
[AUDIT](AUDIT.md) · [deploy/README](../deploy/README.md).

---

## 0. Where it deploys

Nothing new to stand up. The whole app already ships as one image — Next.js
static export (`output: "export"`) baked into FastAPI's `./static`, served at
`/` with `/api/*` from FastAPI, behind Caddy → oauth2-proxy → app → Postgres
(see [docker-compose.yml](../deploy/docker-compose.yml)). Loan Compare adds:

| Piece | Location | Deploy impact |
| --- | --- | --- |
| Compare surface (static route) | `frontend/src/app/compare/` + a 7th entry in `SECTIONS` ([ConceptNav.tsx](../frontend/src/components/shared/ConceptNav.tsx)) | folds into the existing frontend build stage |
| Compare API | `server/routes/compare.py`, registered in [main.py](../server/main.py) (`prefix="/api/compare"`) | new router, same process |
| Term extractor | extend [engine/covenants.py](../server/engine/covenants.py) (CP-4C) + `engine/terms_catalog.py` | same engine package |
| Storage | `deals` + `deal_terms` (this doc) + one Alembic migration | `init_db()` runs alembic on boot — self-applies |

Auth, TLS, Postgres, and the document vault are already in the stack. Same
`docker compose up -d --build`. **The real work is data** (≈150 source-traced
covenant fields per deal), not deployment.

---

## 1. Design decision — tall (EAV), catalog in code

A 150-column wide table would be brittle (every new term a migration), mostly
null, and unable to carry per-cell provenance. The codebase already chose the
tall pattern for this exact shape: `MetricFact` ([database.py](../server/database.py))
is one row per `(issuer, run, metric_key, period)`, each carrying a citation
back to the claim → evidence → chunk that supports it. `deal_terms` is the same
idea applied to covenant attributes.

- **`deals`** — the *column* in the grid (one financing/facility snapshot).
- **`deal_terms`** — the *cells*: one row per `(deal, term_key)`, value + its own
  evidence link.
- **The ~150 field definitions live in code** (`engine/terms_catalog.py`), not the
  DB — the same way the methodology schemas under `Modular OS/KNOWLEDGE
  SOURCES/02_SCHEMA/` are code-defined. New terms ship without a migration.

---

## 2. Tables

Append alongside `MetricFact` in [database.py](../server/database.py); vocab
strings (`lineage_class`, `confidence`, `extraction_type`) are validated by the
engine layer, not DB enums, so the schema stays portable SQLite (dev) ↔ Postgres
(prod) — consistent with the existing models.

```python
class Deal(Base):
    """One financing snapshot — a column in the Compare grid. A deal is an
    issuer's facility at a transaction phase (Launch/Final), sourced from one
    extraction run over its credit agreement."""
    __tablename__ = "deals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    issuer_id: Mapped[str] = mapped_column(String(36), ForeignKey("issuers.id"), index=True)
    run_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("runs.id"))
    document_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("documents.id"))
    # Denormalised identity for the deal picker / column header (also stored as
    # header-section terms, but cheap to read here without a pivot).
    label: Mapped[str] = mapped_column(String(255), nullable=False)        # "team.blue"
    transaction_phase: Mapped[Optional[str]] = mapped_column(String(32))    # Launch|Final
    launch_date: Mapped[Optional[str]] = mapped_column(String(32))
    as_of_date: Mapped[Optional[str]] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DealTerm(Base):
    """One covenant/term value for a deal — a cell. Mixed-type, so value lives in
    value_num (numbers, %, turns, $M, 1–5 scores) OR value_text (enum, boolean,
    free-text covenant blocks, '—'). Provenance mirrors MetricFact: lineage +
    confidence + the chunk it was drawn from (CP-5B click-to-source)."""
    __tablename__ = "deal_terms"
    __table_args__ = (UniqueConstraint("deal_id", "term_key", name="uq_deal_term"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    deal_id: Mapped[str] = mapped_column(String(36), ForeignKey("deals.id"), index=True)
    term_key: Mapped[str] = mapped_column(String(64), nullable=False)   # catalog key, e.g. "mfn_hard_cap_musd"
    value_num: Mapped[Optional[float]] = mapped_column(Float)
    value_text: Mapped[Optional[str]] = mapped_column(Text)
    # Provenance (same vocab as EvidenceItem / MetricFact)
    extraction_type: Mapped[str] = mapped_column(String(32), default="not_available")
    lineage_class: Mapped[str] = mapped_column(String(32), default="Untraced")
    confidence: Mapped[str] = mapped_column(String(32), default="Insufficient Information")
    document_chunk_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("document_chunks.id"))
    quote: Mapped[Optional[str]] = mapped_column(Text)   # verbatim agreement language (the long blocks ARE the quote)
```

### 2.1 Value-state semantics (do not collapse these)

Three states are visible in the source UI and must stay distinguishable:

| State | Representation | Example |
| --- | --- | --- |
| **Present** | `value_num` or `value_text` set | `mfn_hard_cap_musd = 660` |
| **Not present in agreement** | `value_text = "—"`, `confidence = High` | no MFN cap; cov-lite (a real fact) |
| **Not extracted** | both null, `lineage_class = "Insufficient Information"` | not yet read / out of scope |

"The deal has no MFN cap" (a found fact) is **not** the same as "we didn't
extract it." Rendering and the QA gate depend on the distinction.

---

## 3. Term catalog

```python
# engine/terms_catalog.py
from dataclasses import dataclass

# vtype:  musd | bps | pct | turns | months | price | enum | bool | score_1_5 | date | text | quote
# looser: the direction that means MORE borrower room / WEAKER lender protection.
#         Drives the loophole heat-map and the vs-Benchmark delta tint.
#         one of "higher" | "lower" | "yes" | "none"
@dataclass(frozen=True)
class TermDef:
    key: str
    section: str
    label: str
    vtype: str
    looser: str = "none"
    enum: tuple[str, ...] = ()
```

Section order matches the source UI. `looser` is omitted (= `none`) for identity
and free-text terms; the covenant blocks are diffed textually, not directionally.

### header
`company` text · `transaction_phase` enum(Launch, Final) · `lfi_id` text ·
`industry` text · `launch_date` date · `purpose` enum(Refinancing / Dividend
Recap, Merger or Acquisition Financing, LBO, General Corporate, …) ·
`corporate_rating_close` text · `sp_recovery_rating_close` text ·
`facility_rating` text · `lead_arrangers` text · `ownership_sponsor` text

### transaction_fundamentals
`call_term_months` months · `call_type` enum(Soft, Hard, NC) ·
`term_loan_size_musd` musd · `ytm_3yr` pct · `ytm` pct · `price` price ·
`floor` pct · `spread_bps` bps  *(← DM input; DM is CAOS's canonical spread
metric for loans)*

### incremental  *(C = closing)*
`libor_succession` enum(Negative lender consent, …) · `mfn_hard_cap_musd`
musd(↑) · `free_clear_incurs_mfn` bool · `free_clear_grower_type`
enum(EBITDA, Assets) · `free_clear_grower_pct` pct(↑) ·
`free_clear_hard_cap_musd` musd(↑) · `mfn_yield_protection` text ·
`free_clear_ratio_name_1` enum(Net First Lien Leverage Ratio, …) ·
`free_clear_ratio_level_1` turns(↑) · `inside_maturity_hard_cap_musd` musd(↑) ·
`reclassification` bool(looser=yes)

### ebitda_adjustments
`restructuring_business_optimization` enum(Uncapped, %) ·
`synergies_cost_savings_cap` enum/pct (Uncapped = looser) ·
`realized_action_window_months` months(↑)

### builder_basket
`builds_from_unswept_asset_sale_proceeds` enum(From step-down, …) ·
`starter_cni` text · `starter_base_amount_musd` musd(↑) ·
`starter_grower_type` enum(EBITDA) · `starter_grower_pct` pct(↑)

### day_one_capacity_musd  *(musd, looser=higher)*
`d1_unrestricted_sub_investments_musd` · `d1_restricted_payments_musd` ·
`d1_general_purpose_debt_musd`

### day_one_capacity_pct  *(turns / x of EBITDA, looser=higher)*
`d1_unrestricted_sub_investments_pct` · `d1_restricted_payments_pct` ·
`d1_general_purpose_debt_pct`

### general_basket_hard_caps  *(musd, looser=higher)*
`gb_hardcap_investments_musd` · `gb_hardcap_restricted_payments_musd`

### general_basket_growers
`gbg_grower_type` enum(EBITDA) · `gbg_investments_pct` pct(↑) ·
`gbg_restricted_payments_pct` pct(↑) · `gbg_liens_pct` pct(↑)

### carveouts
`portability` bool(looser=yes) · `passthrough` bool(looser=yes)

### sweeps
`ecf_sweep_initial_pct` pct(looser=**lower** — a smaller sweep keeps more cash) ·
`ecf_sweep_ratio_type` enum(Net First Lien Leverage Ratio, …) ·
`ecf_sweep_stepdown_1_pct` pct · `ecf_sweep_stepdown_1_ratio` turns ·
`ecf_sweep_stepdown_2_pct` pct · `ecf_sweep_stepdown_2_ratio` turns ·
`asset_sales_stepdown` bool · `asset_sales_reinvestment_period_months`
months(↑) · `asset_sales_reinvestment_extension_months` months(↑)

### financial_covenant
`cov_lite` bool(looser=yes) · `equity_cure_analysis` quote ·
`net_first_lien_leverage_ratio` turns · `springing_trigger_1_threshold`
pct(% RCF drawn) · `springing_trigger_1_initial_level` turns(↑) ·
`springing_trigger_1_ratio` enum

### documentation_scores  *(1 = most protective → 5 = seriously deficient; looser=higher)*
`score_lenders_repricing_optionality` score_1_5 · `score_default_protection`
score_1_5 · `score_collateral_protection` score_1_5 · `score_composite`
score_1_5

### narrative  *(quote/text — free-form)*
`overview` · `collateral` · `guarantors` · `call_protection` · `pricing` ·
`amortization` · `use_of_proceeds` · `facilities`

### debt_covenant  *(quote blocks; one numeric)*
`general_debt_basket` · `debt_reclassification` · `scheduled_existing_debt` ·
`purchase_money_debt_capital_lease` · `guarantee_of_permitted_debt` ·
`intercompany_debt` · `non_loan_party_debt` · `equity_credit_debt` ·
`acquisition_debt` · `new_bond_series` · `incremental_equivalent_debt` ·
`ratio_debt_carveout` turns(↑) · `receivables_financings_securitizations` ·
`acquired_debt`

### liens_covenant  *(quote blocks)*
`ratio_carveout` · `scheduled_existing_liens` ·
`receivables_securitization_liens` · `purchase_money_liens_capital_leases` ·
`intercompany_liens` · `liens_non_loan_party_assets` · `acquired_liens` ·
`liens_non_collateral_assets` · `liens_other_credit_facilities`

### rp_covenant  *(quote blocks; one numeric)*
`ratio_carveout` turns(↑) · `equity_credit_rp` · `scheduled_rp` ·
`repurchase_employee_director_stock` · `dividends_disqualified_preferred_stock` ·
`distributions_unrestricted_sub_stock_debt` · `shared_general_basket` ·
`general_growth_builder_basket`

### investments_covenant · junior_debt_prepay_covenant · asset_sales_covenant · events_of_default · amendments
Section-level `quote` blocks (each rendered as one expandable cell of verbatim
agreement language).

---

## 4. Producing the grid

The comparison is a **pivot, not new compute**. Given N `deal_id`s:
`SELECT * FROM deal_terms WHERE deal_id IN (...)`, group by `term_key`, order by
catalog section/sequence → rows; deals → columns. Three behaviors come straight
off the catalog:

1. **Benchmark delta** — one column is pinned `benchmark`; for numeric terms
   render `value − benchmark` and tint by the term's `looser` direction (the
   "discover loopholes" heat). Identity/text rows show no delta.
2. **Diff-only toggle** — hide rows where all deals agree (text-equal, or within
   ε for numerics).
3. **Doc-score rollup** — `score_composite` and the three sub-scores are *stored*
   terms (extracted, not recomputed); render on the 1 → 5 protective → deficient
   scale paired with a glyph/label (a11y rule: status is never carried by color
   alone — see CLAUDE.md / `.impeccable.md`).

---

## 5. Provenance & QA fit

- Every `DealTerm` carries `lineage_class` / `confidence` / `document_chunk_id` /
  `quote`, so each cell is one click from the agreement language — satisfies
  *show your work* / CP-5B exactly as CP-1 metric facts do.
- Extraction reuses the existing seam in [engine/covenants.py](../server/engine/covenants.py)
  (CP-4C, today 2 fields): LLM-over-retrieved-chunks per section, deterministic
  regex for the numeric baskets, verbatim `quote` for the text blocks. Untrusted
  source text is wrapped (`llm_safety`), and the LLM is gated by budget with a
  regex fallback — unchanged from the current module.
- `cov_lite` reuses the existing `covlite_finding()` so the term and the QA
  finding stay consistent; a cov-lite deal surfaces the same MINOR early-warning
  finding it does today.

---

## 6. Open questions / non-goals

- **Deal grain.** Phase-1 is loans-only with one facility per issuer, so
  `deal ≈ (issuer, latest run)`. Multi-tranche / multi-vintage deals (same
  issuer, several `deals` rows) are supported by the schema but out of the first
  cut.
- **Enum domains.** The `enum(...)` lists above are seed values from the source
  UI; the catalog should treat unknown enum values as pass-through `value_text`
  rather than reject them (real agreements vary).
- **Backfill.** Existing issuers have no `deals`/`deal_terms` until an extraction
  run populates them; the Compare picker lists only deals with extracted terms.
- **Not in scope here:** the extraction prompt design, the `/compare` UI layout,
  and the `terms_catalog.py` full enumeration (each is a follow-on).
