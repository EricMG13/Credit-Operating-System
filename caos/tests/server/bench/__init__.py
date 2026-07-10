"""Benchmark harness for the cross-encoder re-rank.

The deferral reason named in the handoff: without a measured harness, the re-rank
is an unmeasured latency cost. This package seeds a small labeled set
(query → relevant chunk_id) reused from the golden query-gate hit sets, and the
companion test proves the re-rank does not regress precision@K vs RRF-only on
that seed (the non-regression guard — RT-2026-07-07-12 acknowledges the seed is
small by design; the real precision-lift measurement is a follow-on with a
larger labeled set).

The seed labels live in `seed_labels.py` so the harness is structured for
one-line extension: add a (query, relevant_chunk_ids, corpus) tuple and the
precision assertion picks it up automatically.
"""
