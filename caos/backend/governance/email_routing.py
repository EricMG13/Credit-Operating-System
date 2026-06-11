"""
Email intelligence routing layer (P3) — code form of REF_CP-EMAIL v2.0.

Codifies the 8 email categories (REF_CP-SR_G), their source tiers and staleness,
the per-module allowed-use guardrails, and the standard routing-signal table from
`REF_CP-EMAIL_SourceRoutingMatrix.md`. Pure stdlib (no pydantic) so it is
enforceable in CI; the EmailMetadata payload model lives in `payloads.py`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum


class EmailCategory(str, Enum):
    RATING_ACTION = "RATING_ACTION"
    INTERNAL_RESEARCH = "INTERNAL_RESEARCH"
    SELL_SIDE_RESEARCH = "SELL_SIDE_RESEARCH"
    SELL_SIDE_NEWS = "SELL_SIDE_NEWS"
    TRADING_DESK = "TRADING_DESK"
    MARKET_DATA = "MARKET_DATA"
    EVENT_INVITE = "EVENT_INVITE"
    INTERNAL_COMMS = "INTERNAL_COMMS"


class EmailUse(str, Enum):
    EVIDENCE = "Evidence"
    CONTEXT = "Context"
    TRIGGER = "Trigger"
    ROUTING_SIGNAL = "Routing Signal"


@dataclass(frozen=True)
class CategoryMeta:
    tier: float
    staleness_days: int | None  # None = permanent / event-bound
    note: str


# REF_CP-EMAIL §3 — category reference.
CATEGORY_META: dict[EmailCategory, CategoryMeta] = {
    EmailCategory.RATING_ACTION:      CategoryMeta(1.5, None, "Permanent for rating history; refresh if superseded"),
    EmailCategory.INTERNAL_RESEARCH:  CategoryMeta(1.5, 90, "Review after 90 days unless reaffirmed"),
    EmailCategory.SELL_SIDE_RESEARCH: CategoryMeta(2.0, 90, "Stale after 90 days unless updated"),
    EmailCategory.SELL_SIDE_NEWS:     CategoryMeta(2.0, None, "Event-specific; refresh if superseded"),
    EmailCategory.TRADING_DESK:       CategoryMeta(2.5, 5, "Stale after 5 business days for pricing"),
    EmailCategory.MARKET_DATA:        CategoryMeta(2.5, 7, "Stale after 5–10 business days"),
    EmailCategory.EVENT_INVITE:       CategoryMeta(3.0, None, "Stale after event date"),
    EmailCategory.INTERNAL_COMMS:     CategoryMeta(3.0, None, "Stale after purpose is resolved"),
}

# REF_CP-EMAIL §5 — standard routing signals: event -> (primary, [secondary]).
ROUTING_SIGNALS: dict[str, tuple[str, list[str]]] = {
    "rating_downgrade":      ("CP-MON", ["CP-1", "CP-3", "CP-6A", "CP-6E"]),
    "negative_outlook":      ("CP-MON", ["CP-1", "CP-6A"]),
    "new_issue":             ("CP-3", ["CP-3C", "CP-MON"]),
    "tender_exchange":       ("CP-3D", ["CP-3", "CP-6A", "CP-4"]),
    "amend_and_extend":      ("CP-3D", ["CP-4", "CP-6A"]),
    "distressed_default":    ("CP-MON", ["CP-3D", "CP-6A", "CP-6E"]),
    "m_and_a":               ("CP-1", ["CP-3", "CP-6A", "CP-SR"]),
    "trading_price_drop":    ("CP-MON", ["CP-3", "CP-6A"]),
    "sector_outlook":        ("CP-SR", ["CP-3", "CP-6E"]),
    "internal_writeup":      ("CP-1", ["CP-2", "CP-3", "CP-6A"]),
    "covenant_amendment":    ("CP-4", ["CP-4C", "CP-3D"]),
    "liquidity_rcf_draw":    ("CP-MON", ["CP-2E", "CP-3D"]),
    "lender_call":           ("CP-3D", ["CP-MON", "CP-1"]),
}

# REF_CP-EMAIL §7 — modules where email may NEVER be sole Evidence (guardrails).
# value = categories barred from Evidence at that module ("*" = all).
EVIDENCE_GUARDRAILS: dict[str, set[str]] = {
    "CP-4":  {"*"},   # covenant interpretation requires legal source docs
    "CP-4C": {"*"},   # basket/RP/debt capacity never from email
    "CP-5":  {"*"},   # QA introduces no new evidence
    "CP-5B": {"*"},   # lineage validator, not an evidence source
    "CP-2E": {"*"},   # liquidity/cash-flow bridge figures need schedules
    "CP-2":  {EmailCategory.SELL_SIDE_NEWS.value, EmailCategory.TRADING_DESK.value,
              EmailCategory.MARKET_DATA.value, EmailCategory.EVENT_INVITE.value,
              EmailCategory.INTERNAL_COMMS.value},
}

# Categories that can ever act as Evidence at all (the rest are Context/Trigger only).
_EVIDENCE_CAPABLE = {
    EmailCategory.RATING_ACTION, EmailCategory.INTERNAL_RESEARCH,
    EmailCategory.SELL_SIDE_RESEARCH, EmailCategory.SELL_SIDE_NEWS,
    EmailCategory.TRADING_DESK, EmailCategory.MARKET_DATA,
}

_TRIGGER_CAPABLE = {
    EmailCategory.RATING_ACTION, EmailCategory.SELL_SIDE_NEWS,
    EmailCategory.TRADING_DESK, EmailCategory.MARKET_DATA, EmailCategory.EVENT_INVITE,
}


def allowed_uses(module_id: str, category: EmailCategory) -> set[EmailUse]:
    """Allowed uses of an email category at a module, applying §7 guardrails."""
    uses: set[EmailUse] = {EmailUse.CONTEXT}
    if category in _TRIGGER_CAPABLE:
        uses.add(EmailUse.TRIGGER)
    if module_id == "CP-X":
        uses.add(EmailUse.ROUTING_SIGNAL)
    # Evidence permission, subject to guardrails.
    barred = EVIDENCE_GUARDRAILS.get(module_id, set())
    if category in _EVIDENCE_CAPABLE and "*" not in barred and category.value not in barred:
        uses.add(EmailUse.EVIDENCE)
    return uses


def can_be_evidence(module_id: str, category: EmailCategory) -> bool:
    return EmailUse.EVIDENCE in allowed_uses(module_id, category)


def route_event(event_key: str) -> dict:
    """Return primary/secondary module routing for a standard email event."""
    if event_key not in ROUTING_SIGNALS:
        raise KeyError(f"unknown email event: {event_key}")
    primary, secondary = ROUTING_SIGNALS[event_key]
    return {"event": event_key, "primary_module": primary, "secondary_modules": secondary}


def is_stale(category: EmailCategory, received: date, as_of: date | None = None) -> bool:
    """Staleness check per the category rule (permanent categories never stale)."""
    meta = CATEGORY_META[category]
    if meta.staleness_days is None:
        return False
    return (as_of or date.today()) - received > timedelta(days=meta.staleness_days)


# Heuristic classifier (deterministic). An LLM classifier per REF_CP-SR_G can
# replace this; the keyword cascade gives a testable default.
_KEYWORDS: list[tuple[EmailCategory, tuple[str, ...]]] = [
    (EmailCategory.RATING_ACTION, ("downgrade", "upgrade", "outlook", "creditwatch", "rating action", "affirmed")),
    (EmailCategory.SELL_SIDE_NEWS, ("new issue", "launches", "m&a", "acquisition", "tender", "exchange offer", "default")),
    (EmailCategory.SELL_SIDE_RESEARCH, ("initiation", "price target", "reiterate", "research", "note:", "buy", "sell")),
    (EmailCategory.TRADING_DESK, ("axe", "bid", "offer", "bwic", "runs", "levels", "desk")),
    (EmailCategory.MARKET_DATA, ("spread", "cds", "yield", "index", "pricing", "bps")),
    (EmailCategory.EVENT_INVITE, ("invite", "webinar", "conference", "call invitation", "rsvp")),
    (EmailCategory.INTERNAL_RESEARCH, ("internal", "our analyst", "credit committee", "writeup", "write-up")),
]


def classify_email(subject: str, sender: str = "", body: str = "") -> EmailCategory:
    """Best-effort category from subject/sender/body keywords."""
    text = f"{subject} {body}".lower()
    domain = sender.split("@")[-1].lower() if "@" in sender else ""
    for category, kws in _KEYWORDS:
        if any(k in text for k in kws):
            return category
    if domain and not any(x in domain for x in ("bank", "securities", "capital", "research")):
        return EmailCategory.INTERNAL_COMMS
    return EmailCategory.INTERNAL_COMMS
