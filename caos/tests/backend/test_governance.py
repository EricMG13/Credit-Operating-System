"""
Tests for CP-5 Severity Engine and CP-5B Traceability.
Includes fault injection: deliberately passing unsupported outputs to verify BLOCKED state.
"""

import pytest
from core.severity_engine import Severity, SeverityEngine, get_severity_engine


class TestSeverityEngine:
    def test_pass_on_clean_payload(self):
        engine = get_severity_engine()
        payload = {
            "has_inferred_metrics": False,
            "material_conclusions": [
                {
                    "label": "Test",
                    "value": "5x",
                    "evidence_chain": [{"evidence": "...", "source_doc": "OM p.1"}],
                }
            ],
        }
        report = engine.evaluate("CP-2", payload)
        assert report.overall_severity == Severity.PASS
        assert report.blocked is False

    def test_blocks_on_inferred_metrics(self):
        """CP-5 must BLOCK outputs flagged as inferred."""
        engine = get_severity_engine()
        payload = {
            "has_inferred_metrics": True,  # Fault injection
            "material_conclusions": [],
        }
        report = engine.evaluate("CP-2", payload)
        assert report.overall_severity == Severity.CRITICAL
        assert report.blocked is True
        assert "NO_INFERRED_METRICS" in [f.rule_id for f in report.findings]

    def test_blocks_on_missing_evidence_chain(self):
        """Material conclusions without evidence chains must be BLOCKED."""
        engine = get_severity_engine()
        payload = {
            "has_inferred_metrics": False,
            "material_conclusions": [
                {
                    "label": "Net Leverage",
                    "value": "5.2x",
                    "evidence_chain": [],  # Fault injection: empty chain
                }
            ],
        }
        report = engine.evaluate("CP-2", payload)
        assert report.overall_severity == Severity.CRITICAL
        assert report.blocked is True
        assert "MISSING_EVIDENCE_CHAIN" in [f.rule_id for f in report.findings]

    def test_custom_module_rule(self):
        """Verify custom rules can be registered per module."""
        engine = SeverityEngine()

        from core.severity_engine import IntegrityFinding, Severity

        def rule_require_tranches(payload):
            if not payload.get("tranches"):
                return IntegrityFinding(
                    severity=Severity.CRITICAL,
                    module_id="CP-1",
                    rule_id="NO_TRANCHES",
                    message="Capital structure must have at least one tranche.",
                )
            return None

        engine.register("CP-1", rule_require_tranches)
        bad_payload = {"has_inferred_metrics": False, "material_conclusions": [], "tranches": []}
        report = engine.evaluate("CP-1", bad_payload)
        assert report.blocked is True


class TestCP5BTraceability:
    @pytest.mark.asyncio
    async def test_traceability_score_full(self, valid_cp2_payload):
        from agents.l5_governance.cp5b_traceability import run_cp5b
        result = await run_cp5b([valid_cp2_payload])
        assert result["total_conclusions"] == 1
        assert result["total_evidence_links"] == 1
        assert result["traceability_score"] == 100.0
        assert len(result["violations"]) == 0

    @pytest.mark.asyncio
    async def test_traceability_flags_missing_chain(self):
        from agents.l5_governance.cp5b_traceability import run_cp5b
        payload = {
            "module_id": "CP-1",
            "material_conclusions": [
                {"label": "Total Debt", "value": "$500mm", "evidence_chain": []}
            ],
        }
        result = await run_cp5b([payload])
        assert len(result["violations"]) == 1
        assert "Total Debt" in result["violations"][0]
