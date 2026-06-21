"""vault_export: pure-render link integrity + a DB round-trip through export_run."""

from pathlib import Path

import pytest

import vault_export
from vault_export import hub_title, render_issuer_hub, render_run_spoke, spoke_title


def test_render_links_and_frontmatter_match():
    issuer = {"name": "Acme Corp / EU", "ticker": "ACME", "industry": "Industrials", "country": "US"}
    run = {"id": "abcd1234-0000", "as_of_date": "2026-06-21",
           "qa_status": "Pass", "committee_status": "Committee Ready"}
    sections = [{
        "module_id": "CP-1", "module_name": "Financial Foundation",
        "confidence": "High", "qa_status": "Pass",
        "summary": {"net_leverage": 4.2},
        "claims": [{"claim_id": "C-01", "claim_text": "Leverage rose to 4.2x.",
                    "evidence": [{"evidence_id": "E-01"}, {"evidence_id": "E-02"}]}],
    }]
    findings = [{"severity": "MATERIAL", "lane": 6, "module_id": "CP-1",
                 "description": "Weak lineage on E-44.", "required_remediation": "Re-anchor E-44."}]
    spoke = render_run_spoke(issuer, run, sections, findings)
    hub = render_issuer_hub(issuer, [run])

    # the hub's link to the spoke must equal the spoke's filename basename
    assert f"[[{spoke_title(issuer['name'], run)}]]" in hub
    assert f"[[{hub_title(issuer['name'])}]]" in spoke  # spoke back-links the hub
    assert spoke.startswith("---\n") and "\n---\n" in spoke
    assert "## Financial Foundation (CP-1)" in spoke
    assert "`[E-01]` `[E-02]`" in spoke
    assert "## QA findings" in spoke and "Re-anchor E-44." in spoke  # gate output stored
    assert '"Committee Ready"' in spoke  # status stamped, not gated away
    # sector/geo graph links cluster issuers in Obsidian's Graph view
    assert "[[Industrials]]" in hub and "[[US]]" in hub


@pytest.mark.asyncio
async def test_export_run_writes_hub_and_spoke(seeded_db, tmp_path):
    from database import (
        AsyncSessionLocal, Claim, EvidenceItem, Issuer, ModuleOutput, QAFinding, Run,
    )

    async with AsyncSessionLocal() as s:
        issuer = Issuer(name="Testco PLC", industry="Software", country="UK")
        s.add(issuer)
        await s.flush()
        run = Run(issuer_id=issuer.id, as_of_date="2026-03-31",
                  status="complete", qa_status="Pass", committee_status="Committee Ready")
        s.add(run)
        await s.flush()
        mod = ModuleOutput(run_id=run.id, module_id="CP-1", module_name="Financial Foundation",
                           runtime_output={"net_leverage": 3.1, "liquidity": {"rcf_undrawn": 200}},
                           confidence="High", qa_status="Pass")
        # CP-5 is an auditor module — must be excluded from the spoke body.
        s.add(ModuleOutput(run_id=run.id, module_id="CP-5", module_name="QA Gate",
                           runtime_output={"x": 1}))
        # CP-1C carries the peer set → issuer↔issuer graph links on the hub.
        s.add(ModuleOutput(run_id=run.id, module_id="CP-1C", module_name="PeerBenchmark",
                           runtime_output={"peer_count": 1,
                                           "peers": [{"issuer_id": "p1", "name": "Rival Industries"}]}))
        s.add(mod)
        await s.flush()
        claim = Claim(module_output_id=mod.id, claim_id="C-01", claim_text="Margins held.")
        s.add(claim)
        await s.flush()
        s.add(EvidenceItem(claim_pk=claim.id, evidence_id="E-09",
                           extraction_type="sourced_fact", lineage_class="Directly Sourced"))
        s.add(QAFinding(run_id=run.id, module_id="CP-1", finding_id="QA-117", severity="MINOR",
                        lane=6, description="Stale citation.", required_remediation="Re-pull source."))
        await s.commit()

        paths = await vault_export.export_run(s, run.id, str(tmp_path))

    names = sorted(p.name for p in paths)
    assert names == ["Testco PLC - 2026-03-31.md", "Testco PLC.md"]
    spoke = (tmp_path / "Runs" / "Testco PLC - 2026-03-31.md").read_text()
    hub = (tmp_path / "Issuers" / "Testco PLC.md").read_text()
    assert "## Financial Foundation (CP-1)" in spoke
    assert "QA Gate" not in spoke  # auditor module excluded
    assert "```json" in spoke and "rcf_undrawn" in spoke  # nested agent output stored whole
    assert "Margins held. `[E-09]`" in spoke
    assert "## QA findings" in spoke and "Re-pull source." in spoke  # gate output stored
    assert "[[Testco PLC - 2026-03-31]]" in hub  # hub links the spoke by exact basename
    assert "[[Software]]" in hub and "[[UK]]" in hub  # sector/geo graph links
    assert "## Related issuers" in hub and "[[Rival Industries]]" in hub  # CP-1C peer edges
