"""Provenance discipline — the web/vault separation primitive (Phase 4).

The plan's Phase-4 anti-pattern: "Mixing web-derived and vault-derived evidence
in one pack — separate lanes, separate provenance, separate marking." This
module is the marking + the gate. A web-grounded artifact carries
``provenance="web"``; the committee-export gate (``export_allowed``) rejects any
web-grounded artifact unless an analyst has explicitly web-ratified it. So web
research can inform an analyst's thinking but can never reach a committee pack
uneexamined — the same "autonomous drafting, not publishing" boundary the
Reporter's ``ratify`` enforces, specialized for the web trust class.

The gate is deliberately preemptive: the autonomous pipeline (Analyst → Reporter)
is vault-grounded today (the Analyst's ``_generate`` retrieves from
``document_chunks``), so no web content reaches a Reporter draft yet. But the
discipline must exist BEFORE a web-using lane is wired in — building the gate
after web content leaks is too late. A future web-grounded Analyst lane sets
``provenance="web"`` on its draft; this gate then export-blocks it until
web-ratified. Vault drafts (``provenance`` absent or ``"vault"``) are unaffected.

No migration — ``provenance`` is a payload-level key on the artifact dict, not a
column. The marker travels with the artifact wherever the JSON goes.
"""

from __future__ import annotations

from typing import Optional

WEB = "web"
VAULT = "vault"


def is_web_provenance(artifact: dict) -> bool:
    """True when the artifact carries ``provenance == "web"``. Absent / ``"vault"``
    / any other value → False (vault-grounded, the default trust class). The check
    is on a payload key, not a column, so it works on any artifact dict (a
    Reporter draft, a research output, a future web-Analyst claim pack)."""
    return (artifact or {}).get("provenance") == WEB


def ratify_web(artifact: dict) -> dict:
    """The analyst's explicit web-ratification: flip ``web_ratified`` on a
    web-grounded artifact so the export gate passes it. Returns a NEW dict (the
    original stays un-web-ratified for audit — same posture as ``reporter.ratify``).
    No-op on a non-web artifact (web-ratifying a vault draft is meaningless; don't
    add the key)."""
    if not is_web_provenance(artifact):
        return artifact
    return {**artifact, "web_ratified": True}


def export_allowed(artifact: dict) -> bool:
    """The committee-export provenance gate. True only when the artifact is NOT
    web-grounded, OR it is web-grounded AND has been web-ratified. A web draft
    that is merely ``ratified`` (the Reporter flywheel) but NOT ``web_ratified``
    is STILL rejected — web evidence requires its own, separate ratification, the
    plan's "separate provenance, separate marking." Vault drafts pass this gate
    (their export is governed by ``reporter.is_exportable``'s ``ratified`` check,
    which composes with this one)."""
    if not is_web_provenance(artifact):
        return True  # vault-grounded — not this gate's concern
    return bool((artifact or {}).get("web_ratified"))


def mark_web(artifact: dict) -> dict:
    """Stamp ``provenance="web"`` on an artifact (a future web-grounded lane calls
    this when it composes a draft from web-retrieved evidence). Returns a new dict.
    Idempotent: re-marking a web artifact is a no-op. The marker is the signal the
    export gate + the frontend marking read; it does NOT bypass any grounding
    gate — a web claim still must be cited + number-grounded in its own lane."""
    if is_web_provenance(artifact):
        return artifact
    return {**(artifact or {}), "provenance": WEB}
