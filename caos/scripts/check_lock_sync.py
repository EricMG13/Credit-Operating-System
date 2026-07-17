#!/usr/bin/env python3
"""Fail if requirements.lock doesn't satisfy every requirements.txt spec.

The prod image installs from ``requirements.lock`` (``pip install --require-hashes``);
``requirements.txt`` is the loose spec dependabot bumps. The production/test install
uses the lock, so this guard catches a bumped/added input that never reached it — e.g.
an ``anthropic`` floor raised in the .txt while the lock still pins the old version, or a
new ``google-genai`` line that the lock never gained. In that state prod silently ships
the stale/absent package. This guard closes the gap: every top-level requirement must be
present in the lock at a version that satisfies its specifier.

A literal "regenerate the lock and ``git diff``" guard is NOT reproducible — pip-compile
bakes the input filename / fd number and the generating Python version into the file's
comments, so an identical re-resolve still diffs. This constraint check is deterministic:
it reads the two files, evaluates markers for the target runtime, and needs no network.
"""

import re
import sys
from pathlib import Path

from packaging.requirements import Requirement

SERVER = Path(__file__).resolve().parent.parent / "server"
# markitdown[pdf] lives in requirements-lock.in outside requirements.txt, so the
# guard expects it in the production lock too.
EXTRA_LOCK_INPUTS = ["markitdown[pdf]==0.1.6"]


def _norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def locked_versions(lock_text: str) -> dict[str, str]:
    # Each pinned line starts a package block: "name==version \".
    return {
        _norm(m.group(1)): m.group(2)
        for m in re.finditer(r"(?m)^([A-Za-z0-9._-]+)==([^\s\\]+)", lock_text)
    }


def requirements(txt_text: str) -> list[Requirement]:
    reqs = []
    for raw in txt_text.splitlines() + EXTRA_LOCK_INPUTS:
        line = raw.split("#", 1)[0].strip()
        if not line or line.startswith("-"):
            continue
        try:
            reqs.append(Requirement(line))
        except Exception:  # noqa: BLE001 — a malformed spec is not this guard's job
            continue
    return reqs


def main() -> int:
    locked = locked_versions((SERVER / "requirements.lock").read_text())
    reqs = requirements((SERVER / "requirements.txt").read_text())

    problems: list[str] = []
    for req in reqs:
        # Skip a requirement whose environment marker excludes this runtime.
        if req.marker and not req.marker.evaluate():
            continue
        name = _norm(req.name)
        version = locked.get(name)
        if version is None:
            problems.append(
                f"{req.name}: required by requirements.txt but ABSENT from requirements.lock"
            )
        elif req.specifier and not req.specifier.contains(version, prereleases=True):
            problems.append(
                f"{req.name}: lock pins {version}, does not satisfy '{req.specifier}'"
            )

    if problems:
        print("requirements.lock is OUT OF SYNC with requirements.txt:\n")
        for p in problems:
            print(f"  - {p}")
        print(
            "\nRegenerate the hashed lock (recipe in caos/deploy/Dockerfile) and commit it:"
            "\n  pip-compile --generate-hashes --strip-extras"
            " --output-file=caos/server/requirements.lock"
            " caos/server/requirements-lock.in"
        )
        return 1

    print(f"requirements.lock satisfies all {len(reqs)} requirements.txt specs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
