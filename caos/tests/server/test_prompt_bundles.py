from __future__ import annotations

import json
import shutil

import pytest

from engine.prompt_bundles import PromptBundleError, load_prompt_bundle


def test_cp4d_and_cp2g_bundles_are_complete_and_fingerprinted():
    for module_id in ("CP-4D", "CP-2G"):
        bundle = load_prompt_bundle(module_id)
        assert len(bundle.fingerprint) == 64
        assert bundle.files[0].endswith("CP-COMMON_PREAMBLE.md")
        assert bundle.files[1] == f"{module_id}/{module_id}_ACTIVE_PROMPT.md"
        assert bundle.files[-1] == "CAOS_RUNTIME_OVERLAY_V1"
        assert f"{module_id}/SCHEMA_REFERENCE.md" in bundle.files
        assert f"{module_id}/SYSTEM_REFERENCE.md" in bundle.files
        assert "Do not create, save, upload, or attach files" in bundle.text


def _copy_corpus(tmp_path):
    source = load_prompt_bundle.__globals__["MODULAR_OS_DIR"]
    root = tmp_path / "Modular OS"
    for relative in (
        "CP-4D",
        "CP-2G",
        "KNOWLEDGE SOURCES/00_GOVERNANCE",
    ):
        shutil.copytree(source / relative, root / relative)
    return root


def test_ref_only_change_is_rejected_before_it_can_change_behavior(tmp_path):
    root = _copy_corpus(tmp_path)
    target = root / "CP-2G" / "REF_CP-2G_04_MaterialityClassification.md"
    target.write_text(target.read_text() + "\nchanged\n")
    with pytest.raises(PromptBundleError, match="hash mismatch"):
        load_prompt_bundle("CP-2G", root=root)


def test_extra_or_missing_module_file_fails_closed(tmp_path):
    root = _copy_corpus(tmp_path)
    (root / "CP-4D" / "UNTRACKED.md").write_text("not in manifest")
    with pytest.raises(PromptBundleError, match="directory/manifest mismatch"):
        load_prompt_bundle("CP-4D", root=root)


def test_manifest_update_makes_ref_change_part_of_bundle_fingerprint(tmp_path):
    root = _copy_corpus(tmp_path)
    before = load_prompt_bundle("CP-2G", root=root).fingerprint
    target = root / "CP-2G" / "REF_CP-2G_04_MaterialityClassification.md"
    target.write_text(target.read_text() + "\nreviewed change\n")
    manifest_path = root / "CP-2G" / "SHA256SUMS.json"
    manifest = json.loads(manifest_path.read_text())
    import hashlib
    manifest["files"][target.name] = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    after = load_prompt_bundle("CP-2G", root=root).fingerprint
    assert after != before
