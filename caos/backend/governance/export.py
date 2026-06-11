"""
Render / Extract / DB boundary (P2) — CP_RENDER_COMPILE_BOUNDARY + E1–E7.

- Assembles the 6 canonical appendix JSON blocks embedded in every analytical .docx.
- Validates the export manifest (all 6 blocks present; separate_artifacts empty).
- CP-EXTRACT: turns appendix blocks into extraction envelopes (syntax normalization
  only — no content modification), the sole input to CP-DB.

The .docx serialization itself is a thin adapter (needs python-docx); the
governance-critical assembly + validation here is pure stdlib.
"""

from __future__ import annotations

import hashlib
import json

from .validation import Finding

CANONICAL_BLOCKS = [
    "CP_MODULE_HANDOFF_JSON",
    "CP_EVIDENCE_TRACE_JSON",
    "CP_SOURCE_REGISTRY_JSON",
    "CP_QA_VALIDATION_JSON",
    "CP_EXPORT_MANIFEST_JSON",
    "CP_GAPS_CONFLICTS_DOWNSTREAM_JSON",
]


def assemble_appendices(payload: dict, qa_result: dict, docx_filename: str) -> dict[str, dict]:
    """Build the 6 canonical appendix blocks (Appendices A–E) from a payload + QA."""
    handoff = {k: payload.get(k) for k in
               ("module_id", "module_name", "owned_object", "confidence",
                "qa_status", "downstream_consumers")}
    return {
        "CP_MODULE_HANDOFF_JSON": handoff,
        "CP_EVIDENCE_TRACE_JSON": {"evidence_trace": payload.get("evidence_trace", {})},
        "CP_SOURCE_REGISTRY_JSON": {"sources": payload.get("source_documents_used", [])},
        "CP_QA_VALIDATION_JSON": qa_result,
        "CP_EXPORT_MANIFEST_JSON": build_export_manifest(payload, docx_filename),
        "CP_GAPS_CONFLICTS_DOWNSTREAM_JSON": {
            "limitation_flags": payload.get("limitation_flags", []),
            "validation_warnings": payload.get("validation_warnings", []),
            "downstream_consumers": payload.get("downstream_consumers", []),
        },
    }


def build_export_manifest(payload: dict, docx_filename: str) -> dict:
    return {
        "module_id": payload.get("module_id"),
        "module_name": payload.get("module_name"),
        "runtime_docx_filename": docx_filename,
        "export_status": "Complete",
        "embedded_json_blocks": list(CANONICAL_BLOCKS),
        "separate_artifacts": [],  # E5/C1: must be empty (single-.docx contract)
    }


def validate_export_manifest(manifest: dict) -> list[Finding]:
    """E1/E2/E5: 6 canonical blocks present; no separate artifacts (VE-005)."""
    findings: list[Finding] = []
    blocks = manifest.get("embedded_json_blocks", [])
    missing = [b for b in CANONICAL_BLOCKS if b not in blocks]
    if missing:
        findings.append(Finding.of("VE-005", "Export",
                                   f"appendix missing canonical blocks: {missing}"))
    if manifest.get("separate_artifacts"):
        findings.append(Finding.of("VE-005", "Export",
                                   "separate_artifacts must be empty (single-.docx contract)"))
    return findings


def _normalize(text: str) -> str:
    """CP-EXTRACT syntax normalization ONLY — whitespace/encoding, no content change."""
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n")).strip()


def extract_envelopes(
    appendices: dict[str, dict],
    source_module_id: str,
    source_module_name: str,
    docx_filename: str,
) -> list[dict]:
    """
    CP-EXTRACT: produce one extraction envelope per canonical appendix block.
    Only CP-EXTRACT may parse appendices; CP-DB consumes these envelopes.
    """
    envelopes: list[dict] = []
    for block_name in CANONICAL_BLOCKS:
        if block_name not in appendices:
            envelopes.append({
                "extraction_id": f"{source_module_id}:{block_name}",
                "source_module_id": source_module_id,
                "source_module_name": source_module_name,
                "agent_id": "CP-EXTRACT",
                "source_docx_filename": docx_filename,
                "appendix_block_name": block_name,
                "extraction_status": "Failed",
                "validation_status": "Blocked",
                "content_hash": None,
                "extracted_content": None,
            })
            continue
        raw = _normalize(json.dumps(appendices[block_name], sort_keys=True))
        envelopes.append({
            "extraction_id": f"{source_module_id}:{block_name}",
            "source_module_id": source_module_id,
            "source_module_name": source_module_name,
            "agent_id": "CP-EXTRACT",
            "source_docx_filename": docx_filename,
            "appendix_block_name": block_name,
            "extraction_status": "Success",
            "validation_status": "Passed",
            "content_hash": hashlib.sha256(raw.encode()).hexdigest()[:16],
            "extracted_content": json.loads(raw),
        })
    return envelopes
