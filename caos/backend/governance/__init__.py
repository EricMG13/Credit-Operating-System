"""
CP governance layer — ported from the Modular OS prompt corpus
(`~/Documents/Modular OS/KNOWLEDGE SOURCES/`).

Modules:
  enums.py         — canonical + taxonomy enums (01_TAXONOMY, 00_GOVERNANCE)
  payload_base.py  — Pydantic envelope (CP_MODULE_PAYLOAD_BASE.schema)
  module_registry.json + registry.py — registry-driven DAG + governance checks
  schemas/         — JSON Schema (Draft 2020-12) forms (Migration Guide Phase 1)
"""
