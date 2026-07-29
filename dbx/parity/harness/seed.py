#!/usr/bin/env python3
"""SEED-TIME assembler for the frozen parity corpus (ARCHITECTURE.md §3.1).

Copies the golden-master sources out of the pinned legacy checkout into
``dbx/parity/corpus/``, verifies the two generated JSONs are present (produced
by ``gen_kernel_vectors.py``), records the pinned source in
``SEED_SOURCE.txt``, and writes ``MANIFEST.sha256`` over everything.

Never invoked by tests. After seeding, the corpus is FROZEN: edits are
forbidden; ``tests/parity/test_corpus_frozen.py`` re-verifies the manifest on
every run. Regeneration is only ever done from the pinned commit and produces
a reviewed diff.

Usage:
    python3 seed.py --legacy-root <legacy checkout> --corpus-dir <dbx/parity/corpus> \
        --source-url <git url> --source-branch <branch> --source-commit <sha>
    python3 seed.py --corpus-dir <dbx/parity/corpus> --verify
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

COPY_TREES = [
    # (legacy-relative source, corpus-relative destination)
    ("caos/tests/server/golden", "golden"),
    ("caos/tests/server/corpus", "corpus"),
]
COPY_FILES = [
    ("caos/server/engine/fixtures.py", "atlf_fixtures.py.txt"),
    ("caos/tests/server/test_nan_guards.py", "legacy_tests/test_nan_guards.py"),
    ("caos/tests/server/test_periods_safe_div.py", "legacy_tests/test_periods_safe_div.py"),
    ("caos/tests/server/test_periods.py", "legacy_tests/test_periods.py"),
    ("caos/tests/server/test_cp5_gate_honesty.py", "legacy_tests/test_cp5_gate_honesty.py"),
    ("caos/tests/server/test_qa_findings.py", "legacy_tests/test_qa_findings.py"),
]
GENERATED = ["kernel_vectors.json", "legacy_registry_snapshot.json"]
MANIFEST = "MANIFEST.sha256"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_lines(corpus_dir: Path) -> list[str]:
    lines = []
    for path in sorted(corpus_dir.rglob("*")):
        if path.is_file() and path.name != MANIFEST:
            rel = path.relative_to(corpus_dir).as_posix()
            lines.append(f"{_sha256(path)}  {rel}")
    return lines


def seed(args: argparse.Namespace) -> int:
    legacy = args.legacy_root.resolve()
    corpus = args.corpus_dir.resolve()
    corpus.mkdir(parents=True, exist_ok=True)

    for src_rel, dst_rel in COPY_TREES:
        src = legacy / src_rel
        if not src.is_dir():
            print(f"missing legacy tree: {src}", file=sys.stderr)
            return 2
        dst = corpus / dst_rel
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    for src_rel, dst_rel in COPY_FILES:
        src = legacy / src_rel
        if not src.is_file():
            print(f"missing legacy file: {src}", file=sys.stderr)
            return 2
        dst = corpus / dst_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    for name in GENERATED:
        if not (corpus / name).is_file():
            print(
                f"missing generated file {name} — run gen_kernel_vectors.py first",
                file=sys.stderr,
            )
            return 2

    (corpus / "SEED_SOURCE.txt").write_text(
        "Pinned legacy source for this frozen parity corpus.\n"
        "Regenerate ONLY from this exact commit (reviewed diff required).\n"
        f"url: {args.source_url}\n"
        f"branch: {args.source_branch}\n"
        f"commit: {args.source_commit}\n",
        encoding="utf-8",
    )
    (corpus / MANIFEST).write_text(
        "\n".join(_manifest_lines(corpus)) + "\n", encoding="utf-8"
    )
    print(f"seeded {corpus} ({len(_manifest_lines(corpus))} files manifested)")
    return 0


def verify(corpus_dir: Path) -> int:
    manifest = corpus_dir / MANIFEST
    if not manifest.is_file():
        print("MANIFEST.sha256 missing", file=sys.stderr)
        return 1
    expected = {
        line.split("  ", 1)[1]: line.split("  ", 1)[0]
        for line in manifest.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    actual = {
        line.split("  ", 1)[1]: line.split("  ", 1)[0]
        for line in _manifest_lines(corpus_dir)
    }
    if expected != actual:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        changed = sorted(
            p for p in set(expected) & set(actual) if expected[p] != actual[p]
        )
        for path in missing:
            print(f"missing: {path}", file=sys.stderr)
        for path in extra:
            print(f"unmanifested: {path}", file=sys.stderr)
        for path in changed:
            print(f"hash mismatch: {path}", file=sys.stderr)
        return 1
    print(f"corpus verified: {len(actual)} files match {MANIFEST}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus-dir", type=Path, required=True)
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--legacy-root", type=Path)
    parser.add_argument("--source-url")
    parser.add_argument("--source-branch")
    parser.add_argument("--source-commit")
    args = parser.parse_args()

    if args.verify:
        return verify(args.corpus_dir.resolve())
    for required in ("legacy_root", "source_url", "source_branch", "source_commit"):
        if getattr(args, required) in (None, ""):
            parser.error(f"--{required.replace('_', '-')} is required to seed")
    return seed(args)


if __name__ == "__main__":
    raise SystemExit(main())
