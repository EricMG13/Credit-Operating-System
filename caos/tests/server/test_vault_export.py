"""vault_export: pure-render link integrity + a DB round-trip through export_run."""

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


def test_raw_source_text_is_redacted():
    """#10: raw-content keys (even nested) are blanked before reaching the vault;
    analytical values are preserved."""
    issuer = {"name": "R Co", "industry": "Tech", "country": "US"}
    run = {"id": "r1", "as_of_date": "2026-01-01", "qa_status": "Pass", "committee_status": "Draft Only"}
    sections = [{
        "module_id": "CP-1", "module_name": "Foundation", "confidence": "High", "qa_status": "Pass",
        "summary": {"net_leverage": 3.2, "source_excerpt": "SECRET RAW DOC",
                    "nested": {"chunk_text": "SECRET TWO", "ratio": 1.1}},
        "claims": [],
    }]
    spoke = render_run_spoke(issuer, run, sections)
    assert "SECRET RAW DOC" not in spoke and "SECRET TWO" not in spoke  # raw text gone
    assert "[redacted" in spoke
    assert "net_leverage" in spoke and "3.2" in spoke and "1.1" in spoke  # analysis preserved


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
        run_id = run.id

        paths = await vault_export.export_run(s, run_id, str(tmp_path))

    # filename carries the run id so same-as_of runs can't collide (#5)
    title = spoke_title("Testco PLC", {"id": run_id, "as_of_date": "2026-03-31"})
    assert title.startswith("Testco PLC - 2026-03-31 - ")
    assert sorted(p.name for p in paths) == sorted([f"{title}.md", "Testco PLC.md"])
    spoke = (tmp_path / "Runs" / f"{title}.md").read_text()
    hub = (tmp_path / "Issuers" / "Testco PLC.md").read_text()
    assert "## Financial Foundation (CP-1)" in spoke
    assert "QA Gate" not in spoke  # auditor module excluded
    assert "```json" in spoke and "rcf_undrawn" in spoke  # nested agent output stored whole
    assert "Margins held. `[E-09]`" in spoke
    assert "## QA findings" in spoke and "Re-pull source." in spoke  # gate output stored
    assert f"[[{title}]]" in hub  # hub links the spoke by exact basename
    assert "[[Software]]" in hub and "[[UK]]" in hub  # sector/geo graph links
    assert "## Related issuers" in hub and "[[Rival Industries]]" in hub  # CP-1C peer edges


async def _mk_run(committee_status: str, *, issuer_name: str | None = None):
    """Persist a minimal complete run and return (run_id). Helper for the hook tests."""
    import uuid

    from database import AsyncSessionLocal, Issuer, ModuleOutput, Run

    async with AsyncSessionLocal() as s:
        issuer = Issuer(
            name=issuer_name or f"AutoCo {uuid.uuid4().hex[:8]}",
            industry="Tech",
            country="US",
        )
        s.add(issuer)
        await s.flush()
        run = Run(issuer_id=issuer.id, as_of_date="2026-09-30", status="complete",
                  qa_status="Passed", committee_status=committee_status)
        s.add(run)
        await s.flush()
        s.add(ModuleOutput(run_id=run.id, module_id="CP-1", module_name="Financial Foundation",
                           runtime_output={"net_leverage": 3.0}, confidence="High", qa_status="Passed"))
        await s.commit()
        return run.id


class _Settings:
    def __init__(self, auto, dir_):
        self.vault_export_auto = auto
        self.vault_export_dir = dir_


@pytest.mark.asyncio
async def test_auto_export_hook_writes_on_committee_ready(seeded_db, tmp_path, monkeypatch):
    """The executor auto-hook fires for a Committee-Ready run when the flag is on —
    exercises the gate + the post-commit session reuse the manual route doesn't."""
    import run_executor
    from database import AsyncSessionLocal

    monkeypatch.setattr(run_executor, "get_settings", lambda: _Settings(True, str(tmp_path)))
    run_id = await _mk_run("Committee Ready", issuer_name="AutoCo")
    async with AsyncSessionLocal() as s:  # fresh session, mirroring the executor
        await run_executor._maybe_export_to_vault(s, run_id)

    title = spoke_title("AutoCo", {"id": run_id, "as_of_date": "2026-09-30"})
    assert (tmp_path / "Runs" / f"{title}.md").exists()
    assert (tmp_path / "Issuers" / "AutoCo.md").exists()


def test_spoke_title_unique_per_run_same_as_of():
    """#5 regression: two runs with the same issuer + as_of_date must not collide
    to one filename (would silently overwrite)."""
    issuer = "Atlas Forge Industrials"
    a = spoke_title(issuer, {"id": "aaaa1111-x", "as_of_date": "2026-03-31"})
    b = spoke_title(issuer, {"id": "bbbb2222-y", "as_of_date": "2026-03-31"})
    assert a != b
    assert a.startswith("Atlas Forge Industrials - 2026-03-31 - ")


@pytest.mark.asyncio
async def test_auto_export_hook_skips_when_not_ready_or_flag_off(seeded_db, tmp_path, monkeypatch):
    """No write when the run isn't Committee Ready, nor when the flag is off."""
    import run_executor
    from database import AsyncSessionLocal

    # flag on, but run is Restricted → skip
    monkeypatch.setattr(run_executor, "get_settings", lambda: _Settings(True, str(tmp_path)))
    restricted = await _mk_run("Restricted")
    async with AsyncSessionLocal() as s:
        await run_executor._maybe_export_to_vault(s, restricted)
    assert not (tmp_path / "Runs").exists()

    # Committee Ready, but flag off → skip
    monkeypatch.setattr(run_executor, "get_settings", lambda: _Settings(False, str(tmp_path)))
    ready = await _mk_run("Committee Ready")
    async with AsyncSessionLocal() as s:
        await run_executor._maybe_export_to_vault(s, ready)
    assert not (tmp_path / "Runs").exists()


@pytest.mark.asyncio
async def test_auto_export_hook_never_raises(seeded_db, tmp_path, monkeypatch):
    """Any failure inside the hook — even the settings/gate read, not just the
    export call — must be swallowed, or it would mark a completed run failed."""
    import run_executor
    from database import AsyncSessionLocal

    def boom():
        raise RuntimeError("settings blew up")

    monkeypatch.setattr(run_executor, "get_settings", boom)
    run_id = await _mk_run("Committee Ready")
    async with AsyncSessionLocal() as s:
        await run_executor._maybe_export_to_vault(s, run_id)  # must not raise
