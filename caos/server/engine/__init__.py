"""The CAOS analytical engine.

Routes methodology modules via the CP-X PlannerRouter ([planner.py] over the
[registry.py] module graph), executes them against an issuer's documents,
persists their outputs and evidence, and enforces the CP-5B / CP-5 quality gate.
This package is the live counterpart to the seeded module outputs the frontend
renders today — the spine the rest of the roadmap (CP-MON, sector aggregation,
the spec-only analytical/debate modules) builds on. See docs/TIER1_ENGINE_PLAN.md.
"""
