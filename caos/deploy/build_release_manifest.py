"""H0 release-manifest generator (PD-01 completion gate, plan §H0).

Assembles the machine-derivable legs of the H0 release manifest into one
digest-addressed evidence record:

  candidate identity . app + third-party image digests . Alembic schema head .
  sanitized config fingerprint . explicit feature-flag states . Modular OS
  in-image resource probe (verify_image_resources.py) . SBOMs . vulnerability
  scans . CI evidence links . a digest-pinned compose override

Two modes (RT-2026-07-22-781):

  diagnostic (default) — record whatever the current tree/tooling can prove;
      every section carries ``status: recorded | unavailable`` and the manifest
      is stamped ``mode: diagnostic`` so it can never pass as H0 evidence.
  --strict — the H0 gate: refuses a dirty tree, a HEAD that is not the
      ``origin/main`` tip, unresolved digests, missing flag states, or any
      unavailable section.

Host-bound H0 legs (DB restore/upgrade rehearsal, off-host backup verify,
image-scan disposition sign-off) are deliberately NOT implemented here
(RT-2026-07-22-783); the manifest records them as named open slots.

Secrets never enter the record (RT-2026-07-22-780): the config fingerprint
hashes tracked non-secret deploy files only, and flag states are taken solely
from explicit ``--flag NAME=STATE`` arguments.

Usage (from the repository root):

    python caos/deploy/build_release_manifest.py \
        --image caos-app:ci \
        --flag caos_cp_4d_enabled=false --flag caos_cp_2g_enabled=false \
        [--strict] [--ci-run-url URL ...] [--out caos/docs/qa/release]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SERVER_DIR = REPO_ROOT / "caos" / "server"
FRONTEND_DIR = REPO_ROOT / "caos" / "frontend"
DEPLOY_DIR = REPO_ROOT / "caos" / "deploy"
VENV_PYTHON = SERVER_DIR / ".venv311" / "bin" / "python"

# Tracked, non-secret deploy inputs only — never a live .env (RT-780).
CONFIG_FINGERPRINT_FILES = [
    "caos/deploy/docker-compose.yml",
    "caos/deploy/Dockerfile",
    "caos/deploy/Dockerfile.backup",
    "caos/deploy/Dockerfile.backup-sync",
    "caos/deploy/Caddyfile",
    "caos/deploy/oauth2-proxy.cfg",
    "caos/deploy/clamd.conf",
    "caos/deploy/.env.example",
    ".dockerignore",
]

# H0 legs this script must not fake (RT-783).
MANUAL_H0_SLOTS = {
    "db_restore_upgrade_rehearsal": "open — rehearse against a restored target snapshot (plan §H0)",
    "off_host_backup_verified": "open — take and verify immediately before H1 (plan §H0)",
    "image_scan_disposition": "open — every critical/high finding needs a signed disposition (plan §H0)",
    "signed_decision_record": "open — PD-09 archive step",
}


def run(cmd: list[str], cwd: Path | None = None, timeout: int = 600) -> tuple[int, str, str]:
    proc = subprocess.run(
        cmd, cwd=str(cwd or REPO_ROOT), capture_output=True, text=True, timeout=timeout
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def recorded(**evidence: object) -> dict:
    return {"status": "recorded", **evidence}


def unavailable(reason: str, command: str = "") -> dict:
    out: dict[str, object] = {"status": "unavailable", "reason": reason}
    if command:
        out["command"] = command
    return out


def section_candidate() -> dict:
    code, head, _ = run(["git", "rev-parse", "HEAD"])
    if code != 0:
        return unavailable("not a git checkout", "git rev-parse HEAD")
    _, branch, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    _, status, _ = run(["git", "status", "--porcelain"])
    _, main_tip, _ = run(["git", "rev-parse", "origin/main"])
    return recorded(
        commit=head,
        branch=branch,
        dirty=bool(status),
        origin_main=main_tip,
        equals_origin_main=head == main_tip,
    )


def section_app_image(image: str) -> dict:
    code, out, err = run(["docker", "image", "inspect", image,
                          "--format", "{{.Id}} {{json .RepoDigests}}"])
    if code != 0:
        return unavailable(f"docker inspect failed: {err.splitlines()[-1] if err else code}",
                           f"docker image inspect {image}")
    image_id, _, repo_digests = out.partition(" ")
    return recorded(reference=image, image_id=image_id,
                    repo_digests=json.loads(repo_digests or "[]"))


def section_third_party_images() -> dict:
    """Compose-declared images. Locally built services carry their build context;
    external services must already be digest-pinned in compose."""
    compose = (DEPLOY_DIR / "docker-compose.yml").read_text()
    entries, unpinned = [], []
    for line in compose.splitlines():
        m = re.match(r"\s*image:\s*(\S+)", line)
        if not m:
            continue
        ref = m.group(1)
        pinned = "@sha256:" in ref
        entries.append({"image": ref, "digest_pinned": pinned})
        # caos-* tags are the compose-built app/backup images, resolved via
        # the app-image section / their own build records — not registry pins.
        if not pinned and not ref.startswith("caos-"):
            unpinned.append(ref)
    out = recorded(images=entries)
    if unpinned:
        return unavailable(f"external images without digest pins: {unpinned}")
    return out


def section_schema_head() -> dict:
    if not VENV_PYTHON.exists():
        return unavailable(f"venv python missing: {VENV_PYTHON}")
    code, out, err = run([str(VENV_PYTHON), "-m", "alembic", "heads"], cwd=SERVER_DIR)
    if code != 0:
        return unavailable(f"alembic heads failed: {err.splitlines()[-1] if err else code}",
                           "alembic heads")
    heads = [ln.split(" ")[0] for ln in out.splitlines() if ln.strip()]
    return recorded(heads=heads, single_head=len(heads) == 1)


def section_config_fingerprint() -> dict:
    files, missing = {}, []
    for rel in CONFIG_FINGERPRINT_FILES:
        p = REPO_ROOT / rel
        if not p.exists():
            missing.append(rel)
            continue
        files[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
    combined = hashlib.sha256(
        "\n".join(f"{k}:{v}" for k, v in sorted(files.items())).encode()
    ).hexdigest()
    out = recorded(files=files, combined_sha256=combined)
    if missing:
        return unavailable(f"fingerprint inputs missing: {missing}")
    return out


def discover_flags() -> list[str]:
    text = (SERVER_DIR / "config.py").read_text()
    return sorted(set(re.findall(r"^\s*(\w+_enabled)\s*:\s*bool", text, re.M)))


def section_flags(flag_args: list[str]) -> dict:
    declared = discover_flags()
    stated: dict[str, str] = {}
    for arg in flag_args:
        name, _, value = arg.partition("=")
        if not value or name not in declared:
            return unavailable(f"unknown or malformed flag argument: {arg!r} "
                               f"(declared flags: {declared})")
        stated[name] = value
    missing = [f for f in declared if f not in stated]
    out = recorded(declared=declared, stated=stated, missing_states=missing)
    if missing:
        out["note"] = ("strict H0 requires an explicit --flag state, matching the "
                       "signed C14 disposition, for every declared flag")
    return out


def section_modular_os_probe(image: str) -> dict:
    cmd = ["docker", "run", "--rm", "--entrypoint", "python", image,
           "verify_image_resources.py"]
    code, out, err = run(cmd, timeout=300)
    if code != 0:
        return unavailable(f"in-image probe failed: {err.splitlines()[-1] if err else code}",
                           " ".join(cmd))
    try:
        return recorded(probe=json.loads(out))
    except json.JSONDecodeError:
        return unavailable("probe output was not JSON", " ".join(cmd))


def write_artifact(out_dir: Path, name: str, content: str) -> dict:
    path = out_dir / name
    path.write_text(content)
    return {"path": str(path.relative_to(REPO_ROOT)),
            "sha256": hashlib.sha256(content.encode()).hexdigest()}


def section_sboms(out_dir: Path) -> dict:
    results: dict[str, object] = {}
    code, out, err = run(["npm", "sbom", "--sbom-format", "cyclonedx",
                          "--package-lock-only"], cwd=FRONTEND_DIR)
    results["frontend_npm"] = (
        recorded(**write_artifact(out_dir, "sbom-frontend-cyclonedx.json", out))
        if code == 0 else
        unavailable(f"npm sbom failed: {err.splitlines()[-1] if err else code}", "npm sbom")
    )
    if VENV_PYTHON.exists():
        code, out, err = run([str(VENV_PYTHON), "-m", "pip_audit",
                              "--format", "cyclonedx-json",
                              "-r", "requirements.lock", "--require-hashes"],
                             cwd=SERVER_DIR)
        # Exit 1 with output = vulnerabilities found; the SBOM itself is still
        # valid and the findings surface via the vulnerability section.
        results["server_pip"] = (
            recorded(findings_present=code == 1,
                     **write_artifact(out_dir, "sbom-server-cyclonedx.json", out))
            if out and code in (0, 1) else
            unavailable(f"pip-audit sbom failed: {err.splitlines()[-1] if err else code}",
                        "pip-audit --format cyclonedx-json -r requirements.lock")
        )
    else:
        results["server_pip"] = unavailable(f"venv python missing: {VENV_PYTHON}")
    ok = all(v.get("status") == "recorded" for v in results.values())
    return {"status": "recorded" if ok else "unavailable", **results}


def section_vulnerability(out_dir: Path, image: str) -> dict:
    results: dict[str, object] = {}
    if VENV_PYTHON.exists():
        code, out, err = run([str(VENV_PYTHON), "-m", "pip_audit", "-f", "json",
                              "-r", "requirements.lock", "--require-hashes"],
                             cwd=SERVER_DIR)
        # pip-audit exits 1 when vulnerabilities are found — that is a finding
        # to disposition, not a tool failure.
        if out and code in (0, 1):
            results["server_pip_audit"] = recorded(
                findings_present=code == 1,
                **write_artifact(out_dir, "pip-audit.json", out))
        else:
            results["server_pip_audit"] = unavailable(
                f"pip-audit failed: {err.splitlines()[-1] if err else code}", "pip-audit")
    else:
        results["server_pip_audit"] = unavailable(f"venv python missing: {VENV_PYTHON}")

    code, out, err = run(["npm", "audit", "--json", "--audit-level=high"],
                         cwd=FRONTEND_DIR)
    if out and code in (0, 1):
        results["frontend_npm_audit"] = recorded(
            findings_present=code == 1,
            **write_artifact(out_dir, "npm-audit.json", out))
    else:
        results["frontend_npm_audit"] = unavailable(
            f"npm audit failed: {err.splitlines()[-1] if err else code}", "npm audit")

    # Final-OCI-image scan (OS packages): trivy preferred (adopted 2026-07-22),
    # docker scout fallback. Disposition of findings stays a manual H0 slot
    # (RT-783).
    code, _, _ = run(["trivy", "--version"])
    if code == 0:
        code, out, err = run(["trivy", "image", "--quiet", "--format", "sarif", image],
                             timeout=900)
        results["image_os_scan"] = (
            recorded(scanner="trivy",
                     **write_artifact(out_dir, "image-scan.sarif.json", out))
            if code == 0 and out else
            unavailable(f"trivy image failed: {err.splitlines()[-1] if err else code}",
                        f"trivy image --format sarif {image}")
        )
    elif run(["docker", "scout", "version"])[0] == 0:
        code, out, err = run(["docker", "scout", "cves", "--format", "sarif", image],
                             timeout=900)
        results["image_os_scan"] = (
            recorded(scanner="docker-scout",
                     **write_artifact(out_dir, "image-scan.sarif.json", out))
            if code == 0 and out else
            unavailable(f"docker scout cves failed: {err.splitlines()[-1] if err else code}",
                        f"docker scout cves {image}")
        )
    else:
        results["image_os_scan"] = unavailable(
            "no OCI image scanner available (trivy and docker scout absent); "
            "H0 requires scanning the final image including OS packages",
            "trivy image")
    ok = all(v.get("status") == "recorded" for v in results.values())
    return {"status": "recorded" if ok else "unavailable", **results}


def write_digest_override(out_dir: Path, app_image: dict) -> dict:
    digests = app_image.get("repo_digests") or []
    ref = digests[0] if digests else app_image.get("image_id")
    if not ref:
        return unavailable("no app digest to pin")
    override = (
        "# Generated by build_release_manifest.py — H0 digest pin.\n"
        "# The target host consumes the candidate by immutable reference and\n"
        "# never rebuilds from source (plan §H0).\n"
        "services:\n"
        "  app:\n"
        f"    image: {ref}\n"
        "    build: !reset null\n"
        "  vault-init:\n"
        f"    image: {ref}\n"
        "    build: !reset null\n"
    )
    return recorded(**write_artifact(out_dir, "docker-compose.digests.yml", override))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--image", default="caos-app:ci")
    ap.add_argument("--flag", action="append", default=[], metavar="NAME=STATE")
    ap.add_argument("--ci-run-url", action="append", default=[])
    ap.add_argument("--out", default="caos/docs/qa/release")
    ap.add_argument("--strict", action="store_true",
                    help="fail-closed H0 mode: clean origin/main tree, all "
                         "sections recorded, every flag stated")
    args = ap.parse_args()

    candidate = section_candidate()
    sha = (candidate.get("commit") or "unknown")[:12]
    mode = "strict-h0" if args.strict else "diagnostic"
    out_dir = REPO_ROOT / args.out / f"{mode}-{sha}"
    out_dir.mkdir(parents=True, exist_ok=True)

    app_image = section_app_image(args.image)
    manifest = {
        "record": "CAOS H0 release manifest",
        "mode": mode,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "candidate": candidate,
        "app_image": app_image,
        "third_party_images": section_third_party_images(),
        "schema": section_schema_head(),
        "config_fingerprint": section_config_fingerprint(),
        "feature_flags": section_flags(args.flag),
        "modular_os": section_modular_os_probe(args.image),
        "sboms": section_sboms(out_dir),
        "vulnerability": section_vulnerability(out_dir, args.image),
        "ci_evidence": (recorded(runs=args.ci_run_url) if args.ci_run_url
                        else unavailable("no --ci-run-url provided; link the green "
                                         "CI/nightly/security runs at freeze time")),
        "digest_override": write_digest_override(out_dir, app_image),
        "manual_h0_slots": MANUAL_H0_SLOTS,
    }

    failures = [k for k, v in manifest.items()
                if isinstance(v, dict) and v.get("status") == "unavailable"]
    if args.strict:
        c = candidate
        if c.get("dirty") or not c.get("equals_origin_main"):
            failures.append("candidate: strict H0 requires a clean checkout equal "
                            "to the origin/main tip")
        if manifest["feature_flags"].get("missing_states"):
            failures.append("feature_flags: every declared flag needs an explicit "
                            "--flag state matching the signed C14 disposition")

    manifest["strict_failures"] = sorted(set(failures))
    path = out_dir / "RELEASE_MANIFEST.json"
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    print(f"{mode} manifest: {path.relative_to(REPO_ROOT)}")
    for f in manifest["strict_failures"]:
        print(f"  open: {f}")
    if args.strict and manifest["strict_failures"]:
        print("STRICT H0: FAIL-CLOSED — resolve every line above.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
