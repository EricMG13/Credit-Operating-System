"""Tests for engine/provenance.py — the web/vault provenance discipline (Phase 4)
+ its composition with reporter.is_exportable.

The gate is preemptive (the autonomous pipeline is vault-grounded today), but
the discipline must exist before a web-using lane is wired in. These tests pin
the marker, the web-ratification flip, the export gate, and the composition with
the Reporter's `ratified` gate.
"""

from __future__ import annotations

from engine import provenance, reporter


def _vault_draft(ratified=True):
    return {"status": "draft", "ratified": ratified, "sections": [], "summary": {}}


def _web_draft(ratified=True, web_ratified=False):
    return {"status": "draft", "ratified": ratified, "provenance": "web",
            "web_ratified": web_ratified, "sections": [], "summary": {}}


# ── is_web_provenance ────────────────────────────────────────────────────────

def test_is_web_provenance_recognizes_web_marker():
    assert provenance.is_web_provenance({"provenance": "web"}) is True


def test_is_web_provenance_treats_vault_and_absent_as_not_web():
    assert provenance.is_web_provenance({"provenance": "vault"}) is False
    assert provenance.is_web_provenance({}) is False              # absent = vault (default)
    assert provenance.is_web_provenance({"provenance": "other"}) is False
    assert provenance.is_web_provenance(None) is False            # defensive


# ── ratify_web ───────────────────────────────────────────────────────────────

def test_ratify_web_flips_flag_and_returns_new_dict():
    d = _web_draft(web_ratified=False)
    out = provenance.ratify_web(d)
    assert out["web_ratified"] is True
    assert d["web_ratified"] is False  # original unchanged (audit trail)


def test_ratify_web_noop_on_vault_draft():
    """Web-ratifying a vault draft is meaningless — don't add the key."""
    d = _vault_draft()
    out = provenance.ratify_web(d)
    assert out is d  # returned unchanged
    assert "web_ratified" not in out


# ── export_allowed (the gate) ────────────────────────────────────────────────

def test_export_allowed_rejects_web_unratified():
    assert provenance.export_allowed(_web_draft(web_ratified=False)) is False


def test_export_allowed_passes_web_ratified():
    assert provenance.export_allowed(_web_draft(web_ratified=True)) is True


def test_export_allowed_passes_vault_regardless_of_web_ratify():
    # A vault draft is not this gate's concern — its export is governed by the
    # Reporter's `ratified` check, which composes with this one.
    assert provenance.export_allowed(_vault_draft()) is True
    assert provenance.export_allowed({"provenance": "vault"}) is True
    assert provenance.export_allowed({}) is True  # absent = vault


# ── mark_web ─────────────────────────────────────────────────────────────────

def test_mark_web_stamps_provenance_idempotent():
    d = {"sections": []}
    marked = provenance.mark_web(d)
    assert marked["provenance"] == "web"
    assert "provenance" not in d  # new dict, original unchanged
    # Idempotent: re-marking a web artifact is a no-op (same dict shape).
    remar = provenance.mark_web(marked)
    assert remar["provenance"] == "web"
    assert remar is marked  # already web → returned as-is


# ── composition with reporter.is_exportable ─────────────────────────────────

def test_reporter_is_exportable_blocks_web_until_web_ratified():
    # A web draft that is merely `ratified` (Reporter flywheel) but NOT
    # `web_ratified` is STILL export-blocked — web needs its own ratification.
    assert reporter.is_exportable(_web_draft(ratified=True, web_ratified=False)) is False
    # Web-ratify it → now exportable (it's also `ratified`).
    assert reporter.is_exportable(_web_draft(ratified=True, web_ratified=True)) is True


def test_reporter_is_exportable_unratified_web_blocked():
    # Unratified + web → blocked on both gates.
    assert reporter.is_exportable(_web_draft(ratified=False, web_ratified=True)) is False


def test_reporter_is_exportable_vault_unchanged_by_web_gate():
    # Vault drafts pass the web gate; their export is governed by `ratified` alone.
    assert reporter.is_exportable(_vault_draft(ratified=True)) is True
    assert reporter.is_exportable(_vault_draft(ratified=False)) is False
