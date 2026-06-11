"""
Canonical CP module payload envelope (Pydantic v2).

Typed form of `CP_MODULE_PAYLOAD_BASE.schema` — the base every CP module output
inherits. Per Redeploy Plan D2, this is intended to be GENERATED from the JSON
Schema (`datamodel-code-generator`) once the corpus migrates to JSON-as-source;
until then it is maintained here in lock-step with the schema and `enums.py`.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .enums import Confidence, QaStatus, SchemaFamily

MODULE_ID_RE = re.compile(r"^CP-(0|[1-6][A-F]?|X|SR|MON|DB|RENDER|EXTRACT)$")


class CPModulePayloadBase(BaseModel):
    """The 11 required envelope fields shared by every CP module payload."""

    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    module_id: str
    module_name: str
    owned_object: str
    schema_family: SchemaFamily
    runtime_output: dict = Field(default_factory=dict)
    evidence_trace: dict = Field(default_factory=dict)
    confidence: Confidence
    limitation_flags: list[str] = Field(default_factory=list)
    qa_status: QaStatus = QaStatus.NOT_REVIEWED
    validation_warnings: list[str] = Field(default_factory=list)
    downstream_consumers: list[str] = Field(default_factory=list)

    @field_validator("module_id")
    @classmethod
    def _valid_module_id(cls, v: str) -> str:
        if not MODULE_ID_RE.match(v):
            raise ValueError(f"invalid module_id: {v!r}")
        return v
