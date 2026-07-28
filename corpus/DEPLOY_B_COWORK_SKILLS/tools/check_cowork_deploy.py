#!/usr/bin/env python3
"""DEPLOY_B_COWORK_SKILLS consistency checker.

Validates the Cowork skills deployment invariants:
  - every skill/ subfolder has a well-formed SKILL.md (YAML frontmatter with
    name: + description:, under the 1 MB skill-file size cap)
  - references/ subfolders stay within the 20-file companion-file cap
  - every ./references/FILE token cited in a SKILL.md body actually resolves
    to a file in that skill's references/ folder
  - the deployment stays at or under the 50-skill ceiling (expected: 36 —
    32 analytical/display CP modules + two workbook exporters +
    the rbot-orchestrator meta-skill + AI Assurance Auditor)
  - every module skill's SKILL.md carries canonical Markdown plus optional exports
    markers (rbot-orchestrator is exempt — it drives other modules, it does
    not itself emit a canonical analytical artifact)

Run:  python3 tools/check_cowork_deploy.py   (exit 0 = pass, 1 = fail)

Modeled on tools/check_module_consistency.py's check() accumulator style.
stdlib only — frontmatter and reference tokens are regex-parsed, no yaml lib.
"""
import os
import re
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_DIR = os.path.join(ROOT, "skills")

SIZE_LIMIT = 1_048_576          # 1 MB
REFERENCES_FILE_LIMIT = 20
REFERENCES_WARN = 16
SKILL_COUNT_LIMIT = 50
EXPECTED_SKILL_COUNT = 36
EXPECTED_SKILLS = {
    "ai-assurance-auditor",
    "cp-0-source-readiness", "cp-1-canonical-data-foundation",
    "cp-1a-business-transaction-fact-pack", "cp-1b-earnings-delta",
    "cp-1c-peer-benchmark", "cp-2-fundamental-credit-synthesizer",
    "cp-2a-downside-pathway", "cp-2b-event-catalyst-register",
    "cp-2c-governance-sponsor-score", "cp-2d-liquidity-cash-flow-bridge",
    "cp-2e-macro-fx-hedging-sensitivity", "cp-2f-esg-sustainability-credit-risk",
    "cp-2g-forward-credit-model", "cp-2h-ratings-migration-trigger",
    "cp-3-relative-value-security-selection", "cp-3a-recovery-instrument-preference",
    "cp-3b-portfolio-fit-position-sizing", "cp-3c-refinancing-lme-risk",
    "cp-3d-market-implied-credit-technicals", "cp-4-legal-covenant-interpreter",
    "cp-4a-covenant-capacity-calculator", "cp-4b-restricted-group-guarantee-map",
    "cp-4c-restructuring-fulcrum", "cp-5-evidence-trace-validator",
    "cp-5a-research-integrity-qa", "cp-6-ic-debate-challenge",
    "cp-6a-portfolio-debate-challenge", "cp-8-decision-ledger-post-mortem",
    "cp-dr-deep-research", "cp-email-credit-intelligence-classifier",
    "cp-model-historical-credit-model-workbook",
    "cp-parse-data-preparation",
    "cp-snap-qualitative-credit-snapshot-workbook",
    "cp-x-planner-router", "rbot-orchestrator",
}
DEPLOY_PROFILE_MANIFEST = "DEPLOY_B_PROFILE_MANIFEST.json"
DEPLOY_PROFILE_EXCLUDED = {
    "COWORK_MIGRATION_MANIFEST.json",
    DEPLOY_PROFILE_MANIFEST,
}
SENSITIVE_FILENAME_RE = re.compile(
    r"(?:^|[._-])(?:api[_-]?keys?|access[_-]?tokens?|secret[_-]?tokens?|service[_-]?accounts?|"
    r"auth(?:entication)?|credentials?|secrets?|client[_-]?secrets?|private[_-]?keys?|id_rsa)(?:[._-]|$)",
    re.IGNORECASE,
)
SENSITIVE_SUFFIXES = {".pem", ".key", ".p12", ".pfx"}
ENTRY_WORD_LIMIT = 2000
DESCRIPTION_WARN = 0.25
DESCRIPTION_FAIL = 0.35
RUNTIME_TOOLS = [
    "validate_handoff.py",
    "render_handoff_docx.py",
    "render_visual_pdf.py",
    "export_handoff.py",
    "normalize_module_payload.py",
    "requirements-renderer.txt",
]
RUNTIME_PACKAGES = ["visual_pdf"]
CP_EMAIL_FOCUSED_FILES = {
    "MODULE_RUNBOOK.md": "Co-Pilot Agents/CP-EMAIL/CP-EMAIL_ACTIVE_PROMPT.md",
    "SCHEMA_REFERENCE.md": "Co-Pilot Agents/CP-EMAIL/SCHEMA_REFERENCE.md",
    "REF_CP-EMAIL_A_ScopeAndCoverage.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_A_ScopeAndCoverage.md",
    "REF_CP-EMAIL_B_RetrievalAndPrivacy.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_B_RetrievalAndPrivacy.md",
    "REF_CP-EMAIL_C_EntityAndStoryResolution.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_C_EntityAndStoryResolution.md",
    "REF_CP-EMAIL_D_ClassificationAndRanking.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_D_ClassificationAndRanking.md",
    "REF_CP-EMAIL_E_MonitoringLane.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_E_MonitoringLane.md",
    "REF_CP-EMAIL_F_DigestAndFollowups.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_F_DigestAndFollowups.md",
    "REF_CP-EMAIL_G_QAAndSafety.md": "Co-Pilot Agents/CP-EMAIL/REF_CP-EMAIL_G_QAAndSafety.md",
    "SYSREF_CP-EMAIL_SourceAuthority.md": "Co-Pilot Agents/CP-EMAIL/SYSREF_CP-EMAIL_SourceAuthority.md",
    "CP-EMAIL__CreditIntelligenceClassifier__payload.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/CP-EMAIL__CreditIntelligenceClassifier__payload.schema.txt",
    "CP_MODULE_PAYLOAD_BASE.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/CP_MODULE_PAYLOAD_BASE.schema.txt",
    "CP_DISPLAY_DIGEST_HARD_GATE.md": "Co-Pilot Agents/KNOWLEDGE SOURCES/00_GOVERNANCE/CP_DISPLAY_DIGEST_HARD_GATE.md",
}
CP_PARSE_FOCUSED_FILES = {
    "MODULE_RUNBOOK.md": "Co-Pilot Agents/CP-PARSE/CP-PARSE_ACTIVE_PROMPT.md",
    "SCHEMA_REFERENCE.md": "Co-Pilot Agents/CP-PARSE/SCHEMA_REFERENCE.md",
    "REF_CP-PARSE_A_TriageAndSelection.md": "Co-Pilot Agents/CP-PARSE/REF_CP-PARSE_A_TriageAndSelection.md",
    "REF_CP-PARSE_B_DocumentProfiles.md": "Co-Pilot Agents/CP-PARSE/REF_CP-PARSE_B_DocumentProfiles.md",
    "REF_CP-PARSE_C_ExtractionAndFidelity.md": "Co-Pilot Agents/CP-PARSE/REF_CP-PARSE_C_ExtractionAndFidelity.md",
    "REF_CP-PARSE_D_PackagingAndQA.md": "Co-Pilot Agents/CP-PARSE/REF_CP-PARSE_D_PackagingAndQA.md",
    "CP-PARSE__DataPreparation__payload.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/CP-PARSE__DataPreparation__payload.schema.txt",
    "CP_MODULE_PAYLOAD_BASE.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/CP_MODULE_PAYLOAD_BASE.schema.txt",
}
WORKBOOK_FOCUSED_FILES = {
    "cp-model-historical-credit-model-workbook": {
        "MODULE_RUNBOOK.md": "Co-Pilot Agents/CP-MODEL/CP-MODEL_ACTIVE_PROMPT.md",
        "SCHEMA_REFERENCE.md": "Co-Pilot Agents/CP-MODEL/SCHEMA_REFERENCE.md",
        "REF_CP-MODEL_A_SourceTemplateGate.md": "Co-Pilot Agents/CP-MODEL/REF_CP-MODEL_A_SourceTemplateGate.md",
        "REF_CP-MODEL_B_PeriodAccountMapping.md": "Co-Pilot Agents/CP-MODEL/REF_CP-MODEL_B_PeriodAccountMapping.md",
        "REF_CP-MODEL_C_ModelMath.md": "Co-Pilot Agents/CP-MODEL/REF_CP-MODEL_C_ModelMath.md",
        "REF_CP-MODEL_D_PreservationExportQA.md": "Co-Pilot Agents/CP-MODEL/REF_CP-MODEL_D_PreservationExportQA.md",
        "CP-MODEL__HistoricalCreditModelWorkbook__payload.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/CP-MODEL__HistoricalCreditModelWorkbook__payload.schema.txt",
        "CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt",
        "CP_WORKBOOK_EXPORT_HARD_GATE.md": "Co-Pilot Agents/KNOWLEDGE SOURCES/00_GOVERNANCE/CP_WORKBOOK_EXPORT_HARD_GATE.md",
        "CP_WORKBOOK_EXPORT_SPEC.md": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/CP_WORKBOOK_EXPORT_SPEC.md",
    },
    "cp-snap-qualitative-credit-snapshot-workbook": {
        "MODULE_RUNBOOK.md": "Co-Pilot Agents/CP-SNAP/CP-SNAP_ACTIVE_PROMPT.md",
        "SCHEMA_REFERENCE.md": "Co-Pilot Agents/CP-SNAP/SCHEMA_REFERENCE.md",
        "REF_CP-SNAP_A_SourceTemplateGate.md": "Co-Pilot Agents/CP-SNAP/REF_CP-SNAP_A_SourceTemplateGate.md",
        "REF_CP-SNAP_B_QualitativeMap.md": "Co-Pilot Agents/CP-SNAP/REF_CP-SNAP_B_QualitativeMap.md",
        "REF_CP-SNAP_C_PopulationRules.md": "Co-Pilot Agents/CP-SNAP/REF_CP-SNAP_C_PopulationRules.md",
        "REF_CP-SNAP_D_PreservationExportQA.md": "Co-Pilot Agents/CP-SNAP/REF_CP-SNAP_D_PreservationExportQA.md",
        "CP-SNAP__QualitativeCreditSnapshotWorkbook__payload.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/CP-SNAP__QualitativeCreditSnapshotWorkbook__payload.schema.txt",
        "CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/MODULE_PAYLOADS/CP_WORKBOOK_EXPORT_PAYLOAD_BASE.schema.txt",
        "CP_WORKBOOK_EXPORT_HARD_GATE.md": "Co-Pilot Agents/KNOWLEDGE SOURCES/00_GOVERNANCE/CP_WORKBOOK_EXPORT_HARD_GATE.md",
        "CP_WORKBOOK_EXPORT_SPEC.md": "Co-Pilot Agents/KNOWLEDGE SOURCES/02_SCHEMA/CP_WORKBOOK_EXPORT_SPEC.md",
    },
}
WORKBOOK_ASSETS = {
    "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx":
        "Co-Pilot Agents/KNOWLEDGE SOURCES/06_WORKBOOK_TEMPLATES/REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx",
}
WORKBOOK_SCRIPTS = {
    "cp-model-historical-credit-model-workbook": {
        "materialize_workbook_asset.py": "tools/materialize_workbook_asset.py",
        "export_cp_model.py": "tools/export_cp_model.py",
        "validate_cp_model_inputs.py": "tools/validate_cp_model_inputs.py",
        "validate_handoff.py": "tools/validate_handoff.py",
    },
    "cp-snap-qualitative-credit-snapshot-workbook": {
        "materialize_workbook_asset.py": "tools/materialize_workbook_asset.py",
        "export_cp_snap.py": "tools/export_cp_snap.py",
    },
}

# Skills exempt from the module export marker check — orchestrators invoke
# other modules' contracts and do not emit their own canonical handoff.
AB_CHECK_EXEMPT = {
    "ai-assurance-auditor",
    "rbot-orchestrator",
    "cp-email-credit-intelligence-classifier",
    "cp-model-historical-credit-model-workbook",
    "cp-snap-qualitative-credit-snapshot-workbook",
}
COMPACT_SHARED_ENGINES = {
    "cp-parse-data-preparation",
    "cp-dr-deep-research",
    "cp-2g-forward-credit-model",
    "cp-2h-ratings-migration-trigger",
    "cp-3d-market-implied-credit-technicals",
    "cp-4c-restructuring-fulcrum",
    "cp-email-credit-intelligence-classifier",
    "cp-model-historical-credit-model-workbook",
    "cp-snap-qualitative-credit-snapshot-workbook",
}

FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
NAME_RE = re.compile(r"^name:\s*(.+?)\s*$", re.MULTILINE)
DESC_RE = re.compile(r"^description:\s*(.+?)\s*$", re.MULTILINE)
REF_TOKEN_RE = re.compile(r"\./references/([\w.\-]+)")

# Post-2026-07-16 structure: module body FIRST, then the generated Canon Core
# region, then companions, then the generated Hard-Gate Recap region. Canon
# content is generated from the master by tools/build_canon.py — every inline
# copy must match _COMMON_CORE.md and every CANON_RELEVANT.md must match the
# generated profile manifest.
CORE_BEGIN, CORE_END = "<!-- CANON_CORE:BEGIN -->", "<!-- CANON_CORE:END -->"
RECAP_BEGIN, RECAP_END = "<!-- CANON_RECAP:BEGIN -->", "<!-- CANON_RECAP:END -->"

# LITE mode removed 2026-07-16 — residual LITE-mode language is a defect.
LITE_TOKEN = re.compile(r"\bLITE\b")
LITE_OK = re.compile(r"LITE removed|LITE mode removed|LITE/MAX gate|LITE/MAX response-mode gate|rev 2026-07", re.IGNORECASE)

CORE_SENTINELS = [
    "Confidence Score", "DOCX", "PDF", "carrying value", "null",
    "qa_status", "upstream re-anchor", "finance-company", "matched-funding",
    "entity/period scope", "fail closed", "Chat is non-canonical",
]
DISPLAY_SENTINELS = [
    "DISPLAY_DIGEST", "coverage", "untrusted", "item-N", "FIRST SEEN",
    "Tier-2", "blocks", "never auto-runs", "current chat",
]
WORKBOOK_SENTINELS = [
    "WORKBOOK_EXPORT", ".xlsx", "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx",
    "Never overwrite", "CP-MODEL", "CP-SNAP", "protected", "independent",
]
AI_AUDIT_EXPECTED_REFS = {
    "MODULE_RUNBOOK.md", "CANON_RELEVANT.md",
    "REF_AI-AUDIT_01_IntakeAndRiskTier.md",
    "REF_AI-AUDIT_02_StaticInspection.md",
    "REF_AI-AUDIT_03_SecurityTestCatalogue.md",
    "REF_AI-AUDIT_04_InvestmentDecisionTests.md",
    "REF_AI-AUDIT_05_ScoringAndReleaseGates.md",
    "REF_AI-AUDIT_06_OptimisationAndRetest.md",
    "SCHEMA_REFERENCE.md", "REF_AI-AUDIT_ExampleOutput.md",
}
AI_AUDIT_SENTINELS = [
    "untrusted evidence", "highest applicable", "Tier 4 inherits Tier 3",
    "E0", "E4", "Insufficient Evidence", "critical", "Ready for Governance Review",
    "never grant formal approval", "Pending Human Decision", "(B)", "(A)",
]
AI_AUDIT_FORBIDDEN_CLAIMS = [
    "the Auditor provisions a tenant",
    "the Auditor runs local Python",
    "the Auditor automatically approves",
    "static controls prove observed performance",
]
STALE_EXPORT_RE = re.compile(
    r"PRINTS? (?:the )?complete analysis.*chat|CHAT\s*(?:=|==)|"
    r"byte-for-byte[^\n]*chat|same text as (?:the )?chat|chat narrative equals|"
    r"self-authors? (?:\*\*)?two artifacts|analysis narrative[^\n]*concise completion response",
    re.IGNORECASE,
)
STOP = set("the and for with from into this that then every must only same per its are was were have has had not all any each when where which one two run step module source file files output report analysis".split())


def region(text, begin, end):
    i, j = text.find(begin), text.find(end)
    if i < 0 or j < 0:
        return None
    return text[i + len(begin):j]

fail = []   # hard failures
warn = []   # soft warnings (don't affect exit code)


def check(cond, msg):
    if not cond:
        fail.append(msg)
    return cond


def read(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read()


def _sha(path):
    import hashlib
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def is_generated_junk(path):
    parts = os.path.relpath(path, ROOT).split(os.sep)
    return (
        any(part in {"__MACOSX", "__pycache__"} for part in parts)
        or any(part == ".DS_Store" or part.startswith("._") for part in parts)
        or path.endswith((".pyc", ".pyo"))
    )


def is_hidden_or_sensitive(path):
    """Mirror aggregate release exclusions in the direct validator."""

    relative_parts = os.path.relpath(path, ROOT).split(os.sep)
    name = os.path.basename(path)
    return (
        any(part.startswith(".") for part in relative_parts)
        or bool(SENSITIVE_FILENAME_RE.search(name))
        or os.path.splitext(name)[1].lower() in SENSITIVE_SUFFIXES
    )


def is_confined(path, declared_root):
    """Reject symlinks and resolved paths outside the declared deployment root."""

    try:
        return not os.path.islink(path) and os.path.commonpath(
            [os.path.realpath(path), os.path.realpath(declared_root)]
        ) == os.path.realpath(declared_root)
    except (OSError, ValueError):
        return False


def check_registry_and_junk():
    observed = {
        name for name in os.listdir(SKILLS_DIR)
        if os.path.isdir(os.path.join(SKILLS_DIR, name)) and not name.startswith(".")
    }
    check(observed == EXPECTED_SKILLS,
          f"active skill registry drift: missing={sorted(EXPECTED_SKILLS-observed)} extra={sorted(observed-EXPECTED_SKILLS)}")
    check(not os.path.islink(ROOT), "deployment root cannot be a symlink")
    check(is_confined(SKILLS_DIR, ROOT), "skills root is symlinked or escapes deployment root")
    for skill in EXPECTED_SKILLS:
        skill_path = os.path.join(SKILLS_DIR, skill)
        check(is_confined(skill_path, SKILLS_DIR),
              f"{skill}: skill dir is symlinked or escapes skills root")
    for dirpath, dirnames, filenames in os.walk(ROOT):
        for name in [*dirnames, *filenames]:
            path = os.path.join(dirpath, name)
            if os.path.islink(path) or not is_confined(path, ROOT):
                fail.append(f"path is symlinked or escapes direct deployment: {os.path.relpath(path, ROOT)}")
            if is_generated_junk(path):
                fail.append(f"generated junk present in direct deployment: {os.path.relpath(path, ROOT)}")
            if is_hidden_or_sensitive(path):
                fail.append(f"hidden/secret-like path present in direct deployment: {os.path.relpath(path, ROOT)}")


def profile_record_digest(records):
    import hashlib

    canonical = json.dumps(
        records,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def check_deploy_profile_manifest(canon_profiles):
    manifest_path = os.path.join(ROOT, DEPLOY_PROFILE_MANIFEST)
    if not check(
        os.path.isfile(manifest_path),
        f"missing {DEPLOY_PROFILE_MANIFEST}",
    ):
        return
    try:
        payload = json.loads(read(manifest_path))
    except ValueError as exc:
        fail.append(f"invalid {DEPLOY_PROFILE_MANIFEST}: {exc}")
        return

    expected_root_keys = {
        "version",
        "deployment",
        "scope",
        "hash_algorithm",
        "digest_basis",
        "excluded_files",
        "summary",
        "support_files",
        "profiles",
    }
    if not check(
        isinstance(payload, dict) and set(payload) == expected_root_keys,
        f"{DEPLOY_PROFILE_MANIFEST}: root schema drift",
    ):
        return
    check(payload["version"] == "1.0", f"{DEPLOY_PROFILE_MANIFEST}: version must be 1.0")
    check(
        payload["deployment"] == "DEPLOY_B_COWORK_SKILLS",
        f"{DEPLOY_PROFILE_MANIFEST}: wrong deployment identity",
    )
    check(payload["hash_algorithm"] == "sha256",
          f"{DEPLOY_PROFILE_MANIFEST}: hash_algorithm must be sha256")
    check(
        payload["excluded_files"] == sorted(DEPLOY_PROFILE_EXCLUDED),
        f"{DEPLOY_PROFILE_MANIFEST}: exclusion registry drift",
    )

    support = payload.get("support_files")
    profile_rows = payload.get("profiles")
    summary = payload.get("summary")
    if not check(isinstance(support, list), f"{DEPLOY_PROFILE_MANIFEST}: support_files must be a list"):
        return
    if not check(isinstance(profile_rows, list), f"{DEPLOY_PROFILE_MANIFEST}: profiles must be a list"):
        return
    if not check(isinstance(summary, dict), f"{DEPLOY_PROFILE_MANIFEST}: summary must be an object"):
        return

    expected_profile_keys = {
        "skill", "module", "file_count", "total_bytes", "profile_sha256", "files"
    }
    expected_file_keys = {"path", "bytes", "sha256"}
    all_records = []
    observed_paths = set()
    observed_skills = []

    def validate_records(records, owner):
        if not check(isinstance(records, list), f"{owner}: files must be a list"):
            return []
        validated = []
        for row in records:
            if not check(
                isinstance(row, dict) and set(row) == expected_file_keys,
                f"{owner}: invalid file-record schema",
            ):
                continue
            relative = row.get("path")
            size = row.get("bytes")
            digest = row.get("sha256")
            safe = (
                isinstance(relative, str)
                and relative
                and "\\" not in relative
                and not relative.startswith("/")
                and all(part not in {"", ".", ".."} for part in relative.split("/"))
            )
            if not check(safe, f"{owner}: unsafe manifest path {relative!r}"):
                continue
            if not check(relative not in observed_paths,
                         f"{DEPLOY_PROFILE_MANIFEST}: duplicate path {relative}"):
                continue
            observed_paths.add(relative)
            deployed = os.path.join(ROOT, *relative.split("/"))
            if not check(is_confined(deployed, ROOT),
                         f"{owner}: file is symlinked or escapes deployment: {relative}"):
                continue
            if not check(os.path.isfile(deployed), f"{owner}: missing deployed file {relative}"):
                continue
            check(isinstance(size, int) and size >= 0,
                  f"{owner}: invalid byte count for {relative}")
            check(os.path.getsize(deployed) == size,
                  f"{owner}: byte-count drift for {relative}")
            check(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest or ""),
                  f"{owner}: invalid SHA-256 for {relative}")
            check(_sha(deployed) == digest, f"{owner}: hash drift for {relative}")
            validated.append(row)
        return validated

    support_records = validate_records(support, "deployment support")
    for row in profile_rows:
        if not check(
            isinstance(row, dict) and set(row) == expected_profile_keys,
            f"{DEPLOY_PROFILE_MANIFEST}: invalid profile schema",
        ):
            continue
        skill = row.get("skill")
        observed_skills.append(skill)
        owner = f"profile {skill}"
        records = validate_records(row.get("files"), owner)
        expected_module = canon_profiles.get(skill, {}).get("module")
        check(skill in EXPECTED_SKILLS, f"{owner}: unknown skill")
        check(row.get("module") == expected_module, f"{owner}: module identity drift")
        check(row.get("file_count") == len(records), f"{owner}: file_count drift")
        check(
            row.get("total_bytes") == sum(record["bytes"] for record in records),
            f"{owner}: total_bytes drift",
        )
        check(
            row.get("profile_sha256") == profile_record_digest(records),
            f"{owner}: profile digest drift",
        )
        prefix = f"skills/{skill}/"
        for record in records:
            check(record["path"].startswith(prefix),
                  f"{owner}: file assigned to wrong profile: {record['path']}")
        all_records.extend(records)

    check(observed_skills == sorted(EXPECTED_SKILLS),
          f"{DEPLOY_PROFILE_MANIFEST}: profile registry/order drift")
    for record in support_records:
        check(not record["path"].startswith("skills/"),
              f"deployment support: skill file is outside its profile: {record['path']}")
    all_records.extend(support_records)
    all_records.sort(key=lambda row: row["path"])

    expected_paths = set()
    for dirpath, _dirnames, filenames in os.walk(ROOT):
        for name in filenames:
            path = os.path.join(dirpath, name)
            relative = os.path.relpath(path, ROOT).replace(os.sep, "/")
            if relative not in DEPLOY_PROFILE_EXCLUDED:
                expected_paths.add(relative)
    check(observed_paths == expected_paths,
          f"{DEPLOY_PROFILE_MANIFEST}: deployed file registry drift: "
          f"missing={sorted(expected_paths-observed_paths)} "
          f"extra={sorted(observed_paths-expected_paths)}")

    expected_summary = {
        "profile_count": len(profile_rows),
        "profile_file_count": sum(row.get("file_count", 0) for row in profile_rows if isinstance(row, dict)),
        "support_file_count": len(support_records),
        "total_file_count": len(all_records),
        "total_bytes": sum(record["bytes"] for record in all_records),
        "deployment_sha256": profile_record_digest(all_records),
    }
    check(summary == expected_summary, f"{DEPLOY_PROFILE_MANIFEST}: summary drift")


def check_cp_email_focused_files():
    workspace = os.path.dirname(ROOT)
    references = os.path.join(
        SKILLS_DIR, "cp-email-credit-intelligence-classifier", "references"
    )
    if not check(is_confined(references, SKILLS_DIR),
                 "CP-EMAIL focused references are symlinked or escape skills root"):
        return
    for deployed_name, canonical_relative in CP_EMAIL_FOCUSED_FILES.items():
        deployed = os.path.join(references, deployed_name)
        canonical = os.path.join(workspace, canonical_relative)
        if check(os.path.isfile(deployed), f"CP-EMAIL focused support missing: {deployed_name}") and check(
            os.path.isfile(canonical), f"canonical CP-EMAIL support missing: {canonical_relative}"
        ):
            check(_sha(deployed) == _sha(canonical),
                  f"CP-EMAIL focused support hash drift: {deployed_name}")


def check_cp_parse_focused_files():
    workspace = os.path.dirname(ROOT)
    references = os.path.join(SKILLS_DIR, "cp-parse-data-preparation", "references")
    if not check(is_confined(references, SKILLS_DIR),
                 "CP-PARSE focused references are symlinked or escape skills root"):
        return
    for deployed_name, canonical_relative in CP_PARSE_FOCUSED_FILES.items():
        deployed = os.path.join(references, deployed_name)
        canonical = os.path.join(workspace, canonical_relative)
        if check(os.path.isfile(deployed), f"CP-PARSE focused support missing: {deployed_name}") and check(
            os.path.isfile(canonical), f"canonical CP-PARSE support missing: {canonical_relative}"
        ):
            check(_sha(deployed) == _sha(canonical),
                  f"CP-PARSE focused support hash drift: {deployed_name}")


def check_workbook_focused_files():
    workspace = os.path.dirname(ROOT)
    canonical_hashes = {}

    for skill, expected in WORKBOOK_FOCUSED_FILES.items():
        skill_root = os.path.join(SKILLS_DIR, skill)
        references = os.path.join(SKILLS_DIR, skill, "references")
        if not check(
            is_confined(references, SKILLS_DIR),
            f"{skill}: workbook references are symlinked or escape skills root",
        ):
            continue
        if os.path.isdir(references):
            with os.scandir(references) as entries:
                actual = set()
                nested_directories = []
                for entry in entries:
                    if entry.is_file(follow_symlinks=False):
                        actual.add(entry.name)
                    elif entry.is_dir(follow_symlinks=False):
                        nested_directories.append(entry.name)
        else:
            actual = set()
            nested_directories = []

        expected_registry = {*expected, "CANON_RELEVANT.md"}
        check(
            not nested_directories,
            f"{skill}: nested reference directories are prohibited: "
            f"{sorted(nested_directories)}",
        )
        check(
            actual == expected_registry,
            f"{skill}: workbook reference registry drift: "
            f"missing={sorted(expected_registry-actual)} "
            f"extra={sorted(actual-expected_registry)}",
        )
        for deployed_name, canonical_relative in expected.items():
            deployed = os.path.join(references, deployed_name)
            canonical = os.path.join(workspace, canonical_relative)
            if not check(
                is_confined(deployed, references),
                f"{skill}: workbook support is symlinked or escapes references: "
                f"{deployed_name}",
            ):
                continue
            if not check(
                is_confined(canonical, workspace),
                f"{skill}: canonical workbook support is symlinked or escapes workspace: "
                f"{canonical_relative}",
            ):
                continue
            if not check(
                os.path.isfile(deployed),
                f"{skill}: workbook support missing: {deployed_name}",
            ):
                continue
            if not check(
                os.path.isfile(canonical),
                f"{skill}: canonical workbook support missing: {canonical_relative}",
            ):
                continue

            deployed_hash = _sha(deployed)
            canonical_hash = canonical_hashes.get(canonical)
            if canonical_hash is None:
                canonical_hash = _sha(canonical)
                canonical_hashes[canonical] = canonical_hash
            check(
                deployed_hash == canonical_hash,
                f"{skill}: workbook support hash drift: {deployed_name}",
            )

        for directory_name, expected_files in (
            ("assets", WORKBOOK_ASSETS),
            ("scripts", WORKBOOK_SCRIPTS[skill]),
        ):
            directory = os.path.join(skill_root, directory_name)
            if not check(
                is_confined(directory, skill_root),
                f"{skill}: {directory_name} directory escapes skill root",
            ):
                continue
            actual_files = (
                {
                    entry.name
                    for entry in os.scandir(directory)
                    if entry.is_file(follow_symlinks=False)
                }
                if os.path.isdir(directory)
                else set()
            )
            check(
                actual_files == set(expected_files),
                f"{skill}: workbook {directory_name} registry drift: "
                f"missing={sorted(set(expected_files)-actual_files)} "
                f"extra={sorted(actual_files-set(expected_files))}",
            )
            for deployed_name, canonical_relative in expected_files.items():
                deployed = os.path.join(directory, deployed_name)
                canonical = os.path.join(workspace, canonical_relative)
                if check(
                    os.path.isfile(deployed),
                    f"{skill}: workbook {directory_name} file missing: "
                    f"{deployed_name}",
                ) and check(
                    os.path.isfile(canonical),
                    f"{skill}: canonical {directory_name} file missing: "
                    f"{canonical_relative}",
                ):
                    check(
                        _sha(deployed) == _sha(canonical),
                        f"{skill}: workbook {directory_name} hash drift: "
                        f"{deployed_name}",
                    )


COMMON_CORE_TEXT = None


def words(text):
    return re.findall(r"[A-Za-z0-9][A-Za-z0-9_-]*", text)


def desc_tokens(text):
    return {t for t in (x.lower() for x in words(text)) if len(t) > 1 and t not in STOP}


def jaccard(a, b):
    union = a | b
    return len(a & b) / max(len(union), 1)


def main():
    global COMMON_CORE_TEXT
    check_registry_and_junk()
    if not check(os.path.isdir(SKILLS_DIR), f"missing skills dir: {SKILLS_DIR}"):
        print("RESULT: FAIL")
        return 1

    core_master = os.path.join(ROOT, "_COMMON_CORE.md")
    if check(os.path.isfile(core_master), "missing _COMMON_CORE.md master"):
        COMMON_CORE_TEXT = read(core_master)

    profile_path = os.path.join(ROOT, "CANON_PROFILE_MANIFEST.json")
    profiles = {}
    if check(os.path.isfile(profile_path), "missing CANON_PROFILE_MANIFEST.json"):
        try:
            payload = json.loads(read(profile_path))
            profiles = {row["skill"]: row for row in payload.get("profiles", [])}
        except (ValueError, KeyError, TypeError) as exc:
            fail.append(f"invalid CANON_PROFILE_MANIFEST.json: {exc}")
    check_deploy_profile_manifest(profiles)

    skill_names = sorted(
        d for d in os.listdir(SKILLS_DIR)
        if os.path.isdir(os.path.join(SKILLS_DIR, d)) and not d.startswith(".")
    )

    source_tools = os.path.join(os.path.dirname(ROOT), "tools")
    for name in RUNTIME_TOOLS:
        deployed = os.path.join(ROOT, "tools", name)
        source = os.path.join(source_tools, name)
        if check(os.path.isfile(deployed), f"tools: missing {name}") and check(
            os.path.isfile(source), f"workspace tools: missing {name}"
        ):
            check(_sha(deployed) == _sha(source), f"tools/{name} differs from workspace source")
    for package in RUNTIME_PACKAGES:
        deployed_root = os.path.join(ROOT, "tools", package)
        source_root = os.path.join(source_tools, package)
        source_files = sorted(
            os.path.relpath(os.path.join(current, name), source_root)
            for current, directories, files in os.walk(source_root)
            for name in files
            if name.endswith(".py") and "__pycache__" not in current.split(os.sep)
        )
        deployed_files = sorted(
            os.path.relpath(os.path.join(current, name), deployed_root)
            for current, directories, files in os.walk(deployed_root)
            for name in files
            if name.endswith(".py") and "__pycache__" not in current.split(os.sep)
        ) if os.path.isdir(deployed_root) else []
        if check(deployed_files == source_files, f"tools/{package}: runtime package registry drift"):
            for relative in source_files:
                check(
                    _sha(os.path.join(deployed_root, relative))
                    == _sha(os.path.join(source_root, relative)),
                    f"tools/{package}/{relative} differs from workspace source",
                )

    rows = []  # (name, size, words, ref_file_count, referenced_count, missing_count, orphan_count)
    descriptions = []

    for skill in skill_names:
        sdir = os.path.join(SKILLS_DIR, skill)
        skill_md = os.path.join(sdir, "SKILL.md")
        refs_dir = os.path.join(sdir, "references")

        if not check(is_confined(sdir, SKILLS_DIR),
                     f"{skill}: skill dir is symlinked or escapes skills root"):
            rows.append((skill, 0, 0, 0, 0, 0, 0))
            continue
        if os.path.lexists(refs_dir) and not check(
            is_confined(refs_dir, sdir),
            f"{skill}: references dir is symlinked or escapes skill root",
        ):
            rows.append((skill, os.path.getsize(skill_md) if os.path.isfile(skill_md) else 0,
                         0, 0, 0, 0, 0))
            continue

        # 1. SKILL.md exists + has YAML frontmatter with name: and description:
        if not check(os.path.isfile(skill_md), f"{skill}: missing SKILL.md"):
            rows.append((skill, 0, 0, 0, 0, 0, 0))
            continue

        text = read(skill_md)
        fm = FRONTMATTER_RE.match(text)
        if check(fm is not None, f"{skill}: SKILL.md has no YAML frontmatter block (--- ... ---)"):
            fm_text = fm.group(1)
            name_m = NAME_RE.search(fm_text)
            desc_m = DESC_RE.search(fm_text)
            check(bool(name_m and name_m.group(1)), f"{skill}: frontmatter missing name: field")
            check(bool(desc_m and desc_m.group(1)), f"{skill}: frontmatter missing description: field")
            if desc_m:
                descriptions.append((skill, desc_m.group(1).strip()))

        # 2. SKILL.md size < 1 MB
        size = os.path.getsize(skill_md)
        check(size < SIZE_LIMIT, f"{skill}: SKILL.md is {size} bytes >= {SIZE_LIMIT} (1 MB cap)")
        word_count = len(words(text))
        check(word_count <= ENTRY_WORD_LIMIT,
              f"{skill}: SKILL.md has {word_count} words > {ENTRY_WORD_LIMIT} progressive-disclosure target")

        # 3. references/ has <= 20 files
        ref_files = []
        if os.path.isdir(refs_dir):
            ref_files = sorted(f for f in os.listdir(refs_dir) if os.path.isfile(os.path.join(refs_dir, f)))
            check(
                len(ref_files) <= REFERENCES_FILE_LIMIT,
                f"{skill}: references/ has {len(ref_files)} files > {REFERENCES_FILE_LIMIT} cap",
            )
            if len(ref_files) > REFERENCES_WARN:
                warn.append(f"{skill}: references/ has {len(ref_files)} files > {REFERENCES_WARN} target")
            if skill == "ai-assurance-auditor":
                check(
                    set(ref_files) == AI_AUDIT_EXPECTED_REFS,
                    f"{skill}: reference registry drift: "
                    f"missing={sorted(AI_AUDIT_EXPECTED_REFS-set(ref_files))} "
                    f"extra={sorted(set(ref_files)-AI_AUDIT_EXPECTED_REFS)}",
                )

        # 4. every ./references/FILE token cited in the body resolves to a real file;
        #    warn (don't fail) on references/ files never mentioned in the body.
        cited = sorted(set(REF_TOKEN_RE.findall(text)))
        missing = []
        for token in cited:
            target = os.path.join(refs_dir, token)
            if not os.path.isfile(target):
                missing.append(token)
        for token in missing:
            fail.append(f"{skill}: SKILL.md references ./references/{token} but that file does not exist")

        orphans = sorted(set(ref_files) - set(cited))
        for token in orphans:
            warn.append(f"{skill}: references/{token} exists but is never cited in SKILL.md (orphan)")

        # 6. Canonical Markdown and optional export markers, module skills only
        if skill not in AB_CHECK_EXEMPT:
            check(
                "Markdown" in text and "DOCX" in text and "PDF" in text,
                f"{skill}: SKILL.md missing Markdown/DOCX/PDF export markers",
            )
        if skill == "cp-dr-deep-research":
            for token in ("byte-identical", "MODULE_RUNBOOK.md", "approved", "prompt injection", "CP-0"):
                check(token in text, f"{skill}: missing CP-DR runtime sentinel {token!r}")
            for forbidden in ("Cowork", "built-in Deep Research", "Research mode", "Enterprise Search"):
                check(forbidden not in text, f"{skill}: product-specific runtime assumption {forbidden!r}")
        if skill in WORKBOOK_FOCUSED_FILES:
            for token in (
                "WORKBOOK_EXPORT",
                ".xlsx",
                "MODULE_RUNBOOK.md",
                "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx",
                "terminal",
                "manually invoked",
            ):
                check(token in text, f"{skill}: missing workbook runtime sentinel {token!r}")

        # 7. Canon Core + Recap regions present; core identical to _COMMON_CORE.md
        core = region(text, CORE_BEGIN, CORE_END)
        recap = region(text, RECAP_BEGIN, RECAP_END)
        check(core is not None, f"{skill}: SKILL.md missing CANON_CORE markers")
        check(recap is not None, f"{skill}: SKILL.md missing CANON_RECAP markers")
        if core is not None and COMMON_CORE_TEXT is not None:
            if skill == "ai-assurance-auditor":
                for token in AI_AUDIT_SENTINELS:
                    check(token.lower() in core.lower(),
                          f"{skill}: CANON_CORE missing Auditor sentinel {token!r}")
                    check(token.lower() in recap.lower(),
                          f"{skill}: CANON_RECAP missing Auditor sentinel {token!r}")
                for claim in AI_AUDIT_FORBIDDEN_CLAIMS:
                    check(claim.lower() not in text.lower(),
                          f"{skill}: contains forbidden capability claim {claim!r}")
            elif skill in COMPACT_SHARED_ENGINES:
                # Shared engines keep the common hard gates once in their end
                # recap and load the exact A/B runbook. Repeating the generic
                # core defeats Structure B's progressive-disclosure purpose.
                check("byte-identical" in core and "MODULE_RUNBOOK.md" in core,
                      f"{skill}: compact CANON_CORE must point to the shared runbook")
                if recap is not None:
                    if skill == "cp-email-credit-intelligence-classifier":
                        sentinels = DISPLAY_SENTINELS
                    elif skill in WORKBOOK_FOCUSED_FILES:
                        sentinels = WORKBOOK_SENTINELS
                    else:
                        sentinels = CORE_SENTINELS
                    for token in sentinels:
                        check(token.lower() in recap.lower(),
                              f"{skill}: CANON_RECAP missing sentinel {token!r}")
            else:
                check(core.strip() == COMMON_CORE_TEXT.strip(),
                      f"{skill}: CANON_CORE region differs from _COMMON_CORE.md (drift)")
                for token in CORE_SENTINELS:
                    check(token in core, f"{skill}: CANON_CORE missing sentinel {token!r}")

        # 8. body-before-core order (primacy invariant)
        if core is not None:
            body_pos = text.find("# Module:")
            core_pos = text.find(CORE_BEGIN)
            if body_pos >= 0:
                check(body_pos < core_pos,
                      f"{skill}: module body must precede the Canon Core region")

        # 9. Progressive-disclosure companions + generated profile integrity
        runbook = os.path.join(refs_dir, "MODULE_RUNBOOK.md")
        relevant = os.path.join(refs_dir, "CANON_RELEVANT.md")
        check(os.path.isfile(runbook), f"{skill}: missing references/MODULE_RUNBOOK.md")
        if check(os.path.isfile(relevant), f"{skill}: missing references/CANON_RELEVANT.md"):
            profile = profiles.get(skill)
            if check(profile is not None, f"{skill}: missing canon profile manifest row"):
                check(_sha(relevant) == profile.get("sha256"),
                      f"{skill}: CANON_RELEVANT.md differs from manifest hash")
                if skill == "ai-assurance-auditor":
                    check(profile.get("module") == "AI-AUDIT",
                          f"{skill}: canon profile module must be AI-AUDIT")
                elif skill in WORKBOOK_FOCUSED_FILES:
                    expected_module = (
                        "CP-MODEL" if skill.startswith("cp-model-") else "CP-SNAP"
                    )
                    check(
                        profile.get("module") == expected_module,
                        f"{skill}: canon profile module must be {expected_module}",
                    )
        check(not os.path.exists(os.path.join(refs_dir, "CANON_FULL.md")),
              f"{skill}: stale references/CANON_FULL.md must be removed")
        check(not os.path.exists(os.path.join(refs_dir, "SYSTEM_REFERENCE.md")),
              f"{skill}: stale SYSTEM_REFERENCE.md must be folded into MODULE_RUNBOOK.md")

        # 10. stale payload-schema appendix gate
        sr = os.path.join(refs_dir, "SCHEMA_REFERENCE.md")
        if os.path.isfile(sr):
            check("## Module Payload Schema" not in read(sr),
                  f"{skill}: stale '## Module Payload Schema' block in references/SCHEMA_REFERENCE.md")

        # 11. no residual LITE-mode language
        for i, line in enumerate(text.splitlines(), 1):
            if LITE_TOKEN.search(line) and not LITE_OK.search(line):
                fail.append(f"{skill}: residual LITE-mode language in SKILL.md:{i}")

        stale_paths = [skill_md]
        if os.path.isdir(refs_dir):
            stale_paths.extend(
                os.path.join(refs_dir, name)
                for name in ref_files
                if name.endswith((".md", ".txt"))
            )
        for path in stale_paths:
            if STALE_EXPORT_RE.search(read(path)):
                fail.append(
                    f"{skill}: stale chat-first/CHAT=REPORT contract in "
                    f"{os.path.relpath(path, sdir)}"
                )

        rows.append((skill, size, word_count, len(ref_files), len(cited), len(missing), len(orphans)))

    # 5. total skill count <= 50
    check(
        len(skill_names) <= SKILL_COUNT_LIMIT,
        f"skill count {len(skill_names)} exceeds ceiling of {SKILL_COUNT_LIMIT}",
    )

    # 12. routing-description collision gate
    pairs = []
    for i, (a_name, a_desc) in enumerate(descriptions):
        for b_name, b_desc in descriptions[i + 1:]:
            pairs.append((jaccard(desc_tokens(a_desc), desc_tokens(b_desc)), a_name, b_name))
    pairs.sort(reverse=True)
    for similarity, a_name, b_name in pairs:
        if similarity >= DESCRIPTION_FAIL:
            fail.append(f"routing descriptions collide: {a_name} <> {b_name} = {similarity:.1%} >= {DESCRIPTION_FAIL:.0%}")
        elif similarity >= DESCRIPTION_WARN:
            warn.append(f"routing descriptions overlap: {a_name} <> {b_name} = {similarity:.1%}")
    if len(skill_names) != EXPECTED_SKILL_COUNT:
        warn.append(
            f"skill count is {len(skill_names)}, expected {EXPECTED_SKILL_COUNT} "
            f"(32 analytical/display modules + 2 workbook exporters + "
            "rbot-orchestrator + AI Assurance Auditor)"
        )
    check_cp_email_focused_files()
    check_cp_parse_focused_files()
    check_workbook_focused_files()

    # report
    print(f"DEPLOY_B_COWORK_SKILLS consistency check — {len(skill_names)} skills, root={ROOT}")
    print("-" * 78)
    name_w = max((len(n) for n in skill_names), default=4)
    header = f"{'skill':<{name_w}}  {'size':>9}  {'words':>5}  {'refs':>4}  {'cited':>5}  {'missing':>7}  {'orphans':>7}"
    print(header)
    print("-" * len(header))
    for name, size, word_count, ref_count, cited_count, missing_count, orphan_count in rows:
        print(
            f"{name:<{name_w}}  {size:>9}  {word_count:>5}  {ref_count:>4}  {cited_count:>5}  "
            f"{missing_count:>7}  {orphan_count:>7}"
        )
    print("-" * 78)

    if warn:
        print(f"WARN ({len(warn)}):")
        for w in warn:
            print("  - " + w)
        print("-" * 78)

    if fail:
        print(f"FAIL ({len(fail)} issue(s)):")
        for f in fail:
            print("  - " + f)
    ok = not fail
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
