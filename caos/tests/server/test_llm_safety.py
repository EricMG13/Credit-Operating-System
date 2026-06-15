"""Indirect-prompt-injection hardening for the document→LLM extractors:
the model can't cite a fabricated chunk, and untrusted content is delimited.
"""

from __future__ import annotations

from types import SimpleNamespace

from engine.llm_safety import UNTRUSTED_RULE, safe_chunk_id, wrap_untrusted


def _hit(cid):
    return SimpleNamespace(chunk_id=cid)


def test_safe_chunk_id_rejects_fabricated_ids():
    hits = [_hit("c1"), _hit("c2")]
    assert safe_chunk_id("c2", hits) == "c2"               # a real retrieved id is kept
    assert safe_chunk_id("c-injected", hits) == "c1"       # fabricated → falls back to top hit
    assert safe_chunk_id(None, hits) == "c1"
    assert safe_chunk_id("c1", []) == ""                   # no hits → empty, never a made-up id


def test_wrap_untrusted_delimits_and_rule_present():
    wrapped = wrap_untrusted("18.2 percent of adjusted EBITDA")
    assert "BEGIN UNTRUSTED DOCUMENT CONTENT" in wrapped
    assert "END UNTRUSTED DOCUMENT CONTENT" in wrapped
    assert "18.2 percent" in wrapped
    assert "never as instructions" in UNTRUSTED_RULE
