"""Loan Compare term catalog — the canonical ~150 covenant/term definitions that
back the `/compare` surface and the `deal_terms` store.

The catalog is the *schema in code* (see [docs/COMPARE_SCHEMA.md]): each entry is
one row in the comparison grid, organized into the sections the source UI uses
(deal identity → transaction fundamentals → incremental → … → amendments). The
DB (`deals` / `deal_terms`) stays a tall EAV store keyed by ``term_key``, so new
terms ship here without a migration, mirroring how the methodology schemas under
``Modular OS/KNOWLEDGE SOURCES/02_SCHEMA/`` are code-defined.

Each ``TermDef`` carries:

  - ``vtype`` — value type; numeric types land in ``DealTerm.value_num``, the
    rest in ``value_text`` (with the verbatim agreement language in ``quote``).
  - ``looser`` — the direction that means MORE borrower room / WEAKER lender
    protection. The pivot uses it to tint the vs-Benchmark delta (the "discover
    loopholes" heat). ``"none"`` for identity and free-text terms.
  - ``enum`` — seed domain for ``enum`` terms; unrecognized values pass through
    as ``value_text`` rather than being rejected (real agreements vary).

The catalog is validated at import (unique keys, known ``vtype``/``looser``,
known ``section``) so a malformed edit fails fast rather than at query time.
"""

from __future__ import annotations

from dataclasses import dataclass

# ── Vocabularies ─────────────────────────────────────────────────────────────
# vtype: numeric → value_num; everything else → value_text (+ quote for blocks).
VALUE_TYPES = frozenset({
    "musd", "bps", "pct", "turns", "months", "price", "score_1_5",  # numeric
    "enum", "bool", "date", "text", "quote",                         # textual
})
NUMERIC_TYPES = frozenset({"musd", "bps", "pct", "turns", "months", "price", "score_1_5"})
LOOSER_DIRECTIONS = frozenset({"higher", "lower", "yes", "none"})

# Ordered sections — (key, display label). The grid renders rows in this order;
# labels match the source UI.
SECTIONS: tuple[tuple[str, str], ...] = (
    ("header", "Deal Identity"),
    ("transaction_fundamentals", "Transaction Fundamentals"),
    ("incremental", "Incremental Tranche (C = closing)"),
    ("ebitda_adjustments", "EBITDA Adjustment Restrictions"),
    ("builder_basket", "Builder Basket"),
    ("day_one_capacity_musd", "Day-One Capacity ($ Millions)"),
    ("day_one_capacity_pct", "Day-One Capacity (% of EBITDA)"),
    ("general_basket_hard_caps", "General Basket Hard Caps ($ Millions)"),
    ("general_basket_growers", "General Basket Growers (%)"),
    ("carveouts", "Carveouts"),
    ("sweeps", "Sweeps"),
    ("financial_covenant", "Financial covenant"),
    ("documentation_scores", "Documentation Scores (1 = most protective to 5 = seriously deficient)"),
    ("narrative", "Overview"),
    ("debt_covenant", "Debt covenant"),
    ("liens_covenant", "Liens covenant"),
    ("rp_covenant", "Restricted payments covenant"),
    ("investments_covenant", "Investments covenant"),
    ("junior_debt_prepay_covenant", "Junior debt prepayments covenant"),
    ("asset_sales_covenant", "Asset sales covenant"),
    ("events_of_default", "Events of Default"),
    ("amendments", "Amendments, etc"),
)


@dataclass(frozen=True)
class TermDef:
    """One comparison-grid row definition. ``key`` is the stable ``term_key``
    persisted in ``deal_terms``; never rename a shipped key."""

    key: str
    section: str
    label: str
    vtype: str
    looser: str = "none"
    enum: tuple[str, ...] = ()

    @property
    def is_numeric(self) -> bool:
        return self.vtype in NUMERIC_TYPES


# Common enum domains (seed values; pass-through on unknowns).
_RATIO = ("Net First Lien Leverage Ratio", "Net Total Leverage Ratio",
          "Net Secured Leverage Ratio", "Fixed Charge Coverage Ratio")
_GROWER = ("EBITDA", "Assets", "Total Assets")

# ── The catalog ──────────────────────────────────────────────────────────────
CATALOG: tuple[TermDef, ...] = (
    # ── Deal identity (header rows) ──────────────────────────────────────────
    TermDef("company", "header", "Company", "text"),
    TermDef("transaction_phase", "header", "Transaction phase", "enum",
            enum=("Launch", "Final")),
    TermDef("lfi_id", "header", "LFI ID", "text"),
    TermDef("industry", "header", "Industry", "text"),
    TermDef("launch_date", "header", "Launch Date", "date"),
    TermDef("purpose", "header", "Purpose", "enum",
            enum=("Refinancing / Dividend Recap", "Merger or Acquisition Financing",
                  "Leveraged Buyout", "General Corporate Purposes")),
    TermDef("corporate_rating_close", "header", "Corporate Rating @ Close", "text"),
    TermDef("sp_recovery_rating_close", "header", "S&P Recovery Rating @ Close", "text"),
    TermDef("facility_rating", "header", "Facility Rating", "text"),
    TermDef("lead_arrangers", "header", "Lead Arrangers", "text"),
    TermDef("ownership_sponsor", "header", "Ownership | Lead Sponsor", "text"),

    # ── Transaction fundamentals ─────────────────────────────────────────────
    TermDef("call_term_months", "transaction_fundamentals", "Call Term (Months)", "months"),
    TermDef("call_type", "transaction_fundamentals", "Call Type", "enum",
            enum=("Soft", "Hard", "Non-Call")),
    TermDef("term_loan_size_musd", "transaction_fundamentals", "Term Loan Size ($ Millions)", "musd"),
    TermDef("ytm_3yr", "transaction_fundamentals", "YTM - 3 year", "pct"),
    TermDef("ytm", "transaction_fundamentals", "YTM", "pct"),
    TermDef("price", "transaction_fundamentals", "Price", "price"),
    TermDef("floor", "transaction_fundamentals", "Floor", "pct"),
    # Spread feeds DM — CAOS's canonical loan spread metric.
    TermDef("spread_bps", "transaction_fundamentals", "Spread", "bps"),

    # ── Incremental tranche (C = closing) ────────────────────────────────────
    TermDef("libor_succession", "incremental", "LIBOR Succession", "enum",
            enum=("Negative lender consent", "Positive lender consent", "Agent only")),
    TermDef("mfn_hard_cap_musd", "incremental", "MFN Hard Cap ($ Millions)", "musd", "higher"),
    TermDef("free_clear_incurs_mfn", "incremental", "Free & Clear Incurs MFN", "bool"),
    TermDef("free_clear_grower_type", "incremental", "Free & Clear Grower Type", "enum", enum=_GROWER),
    TermDef("free_clear_grower_pct", "incremental", "Free & Clear Grower %", "pct", "higher"),
    TermDef("free_clear_hard_cap_musd", "incremental", "Free & Clear Hard Cap ($ Millions)", "musd", "higher"),
    TermDef("mfn_yield_protection", "incremental", "MFN Yield Protection", "text"),
    TermDef("free_clear_ratio_name_1", "incremental", "Free & Clear Ratio Name 1", "enum", enum=_RATIO),
    TermDef("free_clear_ratio_level_1", "incremental", "Free & Clear Ratio Level 1", "turns", "higher"),
    TermDef("inside_maturity_hard_cap_musd", "incremental", "Inside Maturity Hard Cap ($ Millions)", "musd", "higher"),
    TermDef("reclassification", "incremental", "Reclassification", "bool", "yes"),

    # ── EBITDA adjustment restrictions ───────────────────────────────────────
    # "Uncapped" or a figure/percent → text (free value, no numeric tint).
    TermDef("restructuring_business_optimization", "ebitda_adjustments",
            "Restructuring / Business Optimization", "text"),
    TermDef("synergies_cost_savings_cap", "ebitda_adjustments", "Synergies & Cost Savings Cap", "text"),
    TermDef("realized_action_window_months", "ebitda_adjustments",
            "Realized Action w/in Period After Closing", "months", "higher"),

    # ── Builder basket ───────────────────────────────────────────────────────
    TermDef("builds_from_unswept_asset_sale_proceeds", "builder_basket",
            "Builds from unswept asset sale proceeds", "enum",
            enum=("From step-down", "Yes", "No")),
    TermDef("starter_cni", "builder_basket", "Starter CNI", "text"),
    TermDef("starter_base_amount_musd", "builder_basket", "Starter Base Amount ($ Millions)", "musd", "higher"),
    TermDef("starter_grower_type", "builder_basket", "Starter Grower type", "enum", enum=_GROWER),
    TermDef("starter_grower_pct", "builder_basket", "Starter Grower %", "pct", "higher"),

    # ── Day-one capacity ($ Millions) ────────────────────────────────────────
    TermDef("d1_unrestricted_sub_investments_musd", "day_one_capacity_musd",
            "Unrestricted subsidiary investments", "musd", "higher"),
    TermDef("d1_restricted_payments_musd", "day_one_capacity_musd", "Restricted payments", "musd", "higher"),
    TermDef("d1_general_purpose_debt_musd", "day_one_capacity_musd", "General purpose debt", "musd", "higher"),

    # ── Day-one capacity (turns of EBITDA; UI labels it "% of EBITDA") ───────
    TermDef("d1_unrestricted_sub_investments_pct", "day_one_capacity_pct",
            "Unrestricted subsidiary investments", "turns", "higher"),
    TermDef("d1_restricted_payments_pct", "day_one_capacity_pct", "Restricted payments", "turns", "higher"),
    TermDef("d1_general_purpose_debt_pct", "day_one_capacity_pct", "General purpose debt", "turns", "higher"),

    # ── General basket hard caps ($ Millions) ────────────────────────────────
    TermDef("gb_hardcap_investments_musd", "general_basket_hard_caps", "Investments", "musd", "higher"),
    TermDef("gb_hardcap_restricted_payments_musd", "general_basket_hard_caps", "Restricted Payments", "musd", "higher"),

    # ── General basket growers (%) ───────────────────────────────────────────
    TermDef("gbg_grower_type", "general_basket_growers", "Grower Type", "enum", enum=_GROWER),
    TermDef("gbg_investments_pct", "general_basket_growers", "Investments", "pct", "higher"),
    TermDef("gbg_restricted_payments_pct", "general_basket_growers", "Restricted Payments", "pct", "higher"),
    TermDef("gbg_liens_pct", "general_basket_growers", "Liens", "pct", "higher"),

    # ── Carveouts ────────────────────────────────────────────────────────────
    TermDef("portability", "carveouts", "Portability", "bool", "yes"),
    TermDef("passthrough", "carveouts", "Passthrough", "bool", "yes"),

    # ── Sweeps (smaller ECF sweep = more cash retained = looser) ─────────────
    TermDef("ecf_sweep_initial_pct", "sweeps", "ECF Sweep Initial", "pct", "lower"),
    TermDef("ecf_sweep_ratio_type", "sweeps", "ECF Sweep Ratio Type", "enum", enum=_RATIO),
    TermDef("ecf_sweep_stepdown_1_pct", "sweeps", "ECF Sweep Step-down 1", "pct", "lower"),
    TermDef("ecf_sweep_stepdown_1_ratio", "sweeps", "ECF Sweep Step-down 1 Ratio", "turns"),
    TermDef("ecf_sweep_stepdown_2_pct", "sweeps", "ECF Sweep Step-down 2", "pct", "lower"),
    TermDef("ecf_sweep_stepdown_2_ratio", "sweeps", "ECF Sweep Step-down 2 Ratio", "turns"),
    TermDef("asset_sales_stepdown", "sweeps", "Asset Sales Step-down", "bool"),
    TermDef("asset_sales_reinvestment_period_months", "sweeps",
            "Asset Sales Reinvestment Period (months)", "months", "higher"),
    TermDef("asset_sales_reinvestment_extension_months", "sweeps",
            "Asset Sales Reinvestment Extension (months)", "months", "higher"),

    # ── Financial covenant ───────────────────────────────────────────────────
    TermDef("cov_lite", "financial_covenant", "Cov-lite", "bool", "yes"),
    TermDef("equity_cure_analysis", "financial_covenant", "Equity Cure Analysis", "quote"),
    TermDef("net_first_lien_leverage_ratio", "financial_covenant", "Net first lien leverage ratio", "turns"),
    TermDef("springing_trigger_1_threshold", "financial_covenant",
            "Springing Trigger 1 Threshold", "pct"),  # % RCF drawn
    TermDef("springing_trigger_1_initial_level", "financial_covenant",
            "Springing Trigger 1 Initial Level", "turns", "higher"),
    TermDef("springing_trigger_1_ratio", "financial_covenant", "Springing Trigger 1 Ratio", "enum", enum=_RATIO),

    # ── Documentation scores (1 protective → 5 deficient; higher = looser) ───
    TermDef("score_lenders_repricing_optionality", "documentation_scores",
            "Lenders Repricing Optionality", "score_1_5", "higher"),
    TermDef("score_default_protection", "documentation_scores", "Default Protection", "score_1_5", "higher"),
    TermDef("score_collateral_protection", "documentation_scores", "Collateral Protection", "score_1_5", "higher"),
    TermDef("score_composite", "documentation_scores", "Composite", "score_1_5", "higher"),

    # ── Narrative (verbatim free-text blocks) ────────────────────────────────
    TermDef("overview", "narrative", "Overview", "quote"),
    TermDef("collateral", "narrative", "Collateral", "quote"),
    TermDef("guarantors", "narrative", "Guarantors", "quote"),
    TermDef("call_protection", "narrative", "Call protection", "quote"),
    TermDef("pricing", "narrative", "Pricing", "quote"),
    TermDef("amortization", "narrative", "Amortization", "quote"),
    TermDef("use_of_proceeds", "narrative", "Use of proceeds", "quote"),
    TermDef("facilities", "narrative", "Facilities", "quote"),

    # ── Debt covenant ────────────────────────────────────────────────────────
    TermDef("general_debt_basket", "debt_covenant", "General debt basket", "quote"),
    TermDef("debt_reclassification", "debt_covenant", "Debt reclassification", "quote"),
    TermDef("scheduled_existing_debt", "debt_covenant", "Scheduled / existing debt", "quote"),
    TermDef("purchase_money_debt_capital_lease", "debt_covenant",
            "Purchase money debt / capital lease obligations", "quote"),
    TermDef("guarantee_of_permitted_debt", "debt_covenant", "Guarantee of permitted debt", "quote"),
    TermDef("intercompany_debt", "debt_covenant", "Intercompany debt", "quote"),
    TermDef("non_loan_party_debt", "debt_covenant", "Non-loan party debt", "quote"),
    TermDef("equity_credit_debt", "debt_covenant", "Equity credit debt", "quote"),
    TermDef("acquisition_debt", "debt_covenant", "Acquisition debt", "quote"),
    TermDef("new_bond_series", "debt_covenant", "New bond series", "quote"),
    TermDef("incremental_equivalent_debt", "debt_covenant", "Incremental equivalent debt", "quote"),
    TermDef("ratio_debt_carveout", "debt_covenant", "Ratio debt carveout", "turns", "higher"),
    TermDef("receivables_financings_securitizations", "debt_covenant",
            "Receivables financings / securitizations", "quote"),
    TermDef("acquired_debt", "debt_covenant", "Acquired debt", "quote"),

    # ── Liens covenant ───────────────────────────────────────────────────────
    TermDef("liens_ratio_carveout", "liens_covenant", "Ratio carveout", "quote"),
    TermDef("scheduled_existing_liens", "liens_covenant", "Scheduled / existing liens", "quote"),
    TermDef("receivables_securitization_liens", "liens_covenant",
            "Receivables financing / securitization liens", "quote"),
    TermDef("purchase_money_liens_capital_leases", "liens_covenant",
            "Purchase money liens / liens securing capital leases", "quote"),
    TermDef("intercompany_liens", "liens_covenant", "Intercompany liens", "quote"),
    TermDef("liens_non_loan_party_assets", "liens_covenant", "Liens on non-loan party assets", "quote"),
    TermDef("acquired_liens", "liens_covenant", "Acquired liens", "quote"),
    TermDef("liens_non_collateral_assets", "liens_covenant", "Liens on non-collateral assets", "quote"),
    TermDef("liens_other_credit_facilities", "liens_covenant", "Liens securing other credit facilities", "quote"),

    # ── Restricted payments covenant ─────────────────────────────────────────
    TermDef("rp_ratio_carveout", "rp_covenant", "Ratio carveout", "turns", "higher"),
    TermDef("equity_credit_rp", "rp_covenant", "Equity credit restricted payments", "quote"),
    TermDef("scheduled_rp", "rp_covenant", "Scheduled restricted payments", "quote"),
    TermDef("repurchase_employee_director_stock", "rp_covenant",
            "Repurchase of employee / director stock", "quote"),
    TermDef("dividends_disqualified_preferred_stock", "rp_covenant",
            "Dividends on disqualified or preferred stock", "quote"),
    TermDef("distributions_unrestricted_sub_stock_debt", "rp_covenant",
            "Distributions of unrestricted subsidiary stock or debt", "quote"),
    TermDef("shared_general_basket", "rp_covenant", "Shared general basket", "quote"),
    TermDef("general_growth_builder_basket", "rp_covenant", "General growth / builder basket", "quote"),

    # ── Tail covenant sections (section-level blocks; expand into sub-terms
    #    later, same pattern as debt/liens/RP above). ─────────────────────────
    TermDef("investments_covenant_summary", "investments_covenant", "Investments covenant", "quote"),
    TermDef("junior_debt_prepay_summary", "junior_debt_prepay_covenant",
            "Junior debt prepayments covenant", "quote"),
    TermDef("asset_sales_summary", "asset_sales_covenant", "Asset sales covenant", "quote"),
    TermDef("events_of_default_summary", "events_of_default", "Events of Default", "quote"),
    TermDef("amendments_summary", "amendments", "Amendments, etc", "quote"),
)

# ── Derived lookups ──────────────────────────────────────────────────────────
BY_KEY: dict[str, TermDef] = {t.key: t for t in CATALOG}
SECTION_LABELS: dict[str, str] = dict(SECTIONS)


def terms_in_section(section: str) -> list[TermDef]:
    """Catalog order is authoritative for row ordering within a section."""
    return [t for t in CATALOG if t.section == section]


def validate_catalog() -> list[str]:
    """Return a list of catalog errors (empty == valid). Mirrors
    ``schemas.validate_payload``: structural invariants the rest of the
    Compare lane relies on."""
    errors: list[str] = []
    section_keys = {k for k, _ in SECTIONS}
    seen: set[str] = set()
    for t in CATALOG:
        if t.key in seen:
            errors.append(f"duplicate term_key {t.key!r}")
        seen.add(t.key)
        if t.section not in section_keys:
            errors.append(f"{t.key}: unknown section {t.section!r}")
        if t.vtype not in VALUE_TYPES:
            errors.append(f"{t.key}: unknown vtype {t.vtype!r}")
        if t.looser not in LOOSER_DIRECTIONS:
            errors.append(f"{t.key}: unknown looser direction {t.looser!r}")
        if t.looser != "none" and not (t.is_numeric or t.vtype == "bool"):
            errors.append(f"{t.key}: looser={t.looser!r} only valid on numeric/bool terms")
        if t.enum and t.vtype != "enum":
            errors.append(f"{t.key}: enum domain set on non-enum vtype {t.vtype!r}")
    return errors


# Fail fast on a malformed edit rather than at query time.
_errs = validate_catalog()
if _errs:
    raise RuntimeError("terms_catalog is invalid:\n  " + "\n  ".join(_errs))
