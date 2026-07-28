#!/usr/bin/env python3
"""Validate canonical Markdown and create only the requested optional exports."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

try:
    from tools.render_handoff_docx import (
        extract_docx_body_blocks,
        render_markdown,
    )
    from tools.render_visual_pdf import render_visual_pdf
    from tools.validate_handoff import _parse_frontmatter, validate_text
    from tools.visual_pdf.quality import verify_visual_pdf
    from tools.visual_pdf.registry import VisualArchetype, get_profile
except ModuleNotFoundError:  # Direct execution from a deployed tools directory.
    from render_handoff_docx import extract_docx_body_blocks, render_markdown
    from render_visual_pdf import render_visual_pdf
    from validate_handoff import _parse_frontmatter, validate_text
    from visual_pdf.quality import verify_visual_pdf
    from visual_pdf.registry import VisualArchetype, get_profile


EXIT_EXPORT_FAILURE = 5


class ExportRequest(str, Enum):
    NONE = "none"
    DOCX = "docx"
    PDF = "pdf"
    BOTH = "both"

    @property
    def wants_docx(self) -> bool:
        return self in {ExportRequest.DOCX, ExportRequest.BOTH}

    @property
    def wants_pdf(self) -> bool:
        return self in {ExportRequest.PDF, ExportRequest.BOTH}


@dataclass(frozen=True)
class ExportResult:
    kind: str
    status: str
    path: str | None = None
    error: str | None = None
    metadata: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"kind": self.kind, "status": self.status}
        if self.path is not None:
            result["path"] = self.path
        if self.error is not None:
            result["error"] = self.error
        if self.metadata is not None:
            result["metadata"] = self.metadata
        return result


def _docx_renderer(markdown: Path, output: Path) -> dict[str, Any]:
    metadata = render_markdown(markdown, output)
    if extract_docx_body_blocks(output) != metadata["semantic_blocks"]:
        raise ValueError("DOCX ordered-block parity verification failed")
    return {
        "source_sha256": metadata["source_sha256"],
        "docx_sha256": metadata["docx_sha256"],
    }


def _pdf_renderer(markdown: Path, output: Path) -> dict[str, Any]:
    metadata = render_visual_pdf(markdown, output)
    return {**metadata, **verify_visual_pdf(markdown, output)}


def _atomic_export(
    kind: str,
    markdown: Path,
    destination: Path,
    renderer: Callable[[Path, Path], dict[str, Any]],
) -> ExportResult:
    temporary: Path | None = None
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        mode = destination.stat().st_mode & 0o777 if destination.exists() else 0o644
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{destination.name}.",
            suffix=".tmp",
            dir=destination.parent,
        )
        os.close(descriptor)
        temporary = Path(temporary_name)
        metadata = renderer(markdown, temporary)
        if not temporary.is_file() or temporary.stat().st_size == 0:
            raise ValueError(f"{kind.upper()} renderer did not create a non-empty artifact")
        temporary.chmod(mode)
        temporary.replace(destination)
        return ExportResult(
            kind=kind,
            status="available",
            path=str(destination),
            metadata=metadata,
        )
    except Exception as error:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        return ExportResult(
            kind=kind,
            status="failed",
            path=str(destination),
            error=f"{type(error).__name__}: {error}",
        )


def export_handoff(
    markdown: Path,
    request: ExportRequest = ExportRequest.NONE,
    *,
    output_dir: Path | None = None,
    docx_renderer: Callable[[Path, Path], dict[str, Any]] = _docx_renderer,
    pdf_renderer: Callable[[Path, Path], dict[str, Any]] = _pdf_renderer,
) -> dict[str, Any]:
    if markdown.suffix.lower() != ".md":
        raise ValueError("canonical handoff filename must end in .md")
    text = markdown.read_text(encoding="utf-8")
    validation = validate_text(text, filename=markdown.name)
    if validation.exit_code != 0:
        details = list(validation.errors + validation.identity_mismatches)
        if validation.fields is not None and validation.fields.get("qa_status") == "Blocked":
            details.append("qa_status is Blocked")
        raise ValueError("Invalid canonical Markdown: " + "; ".join(details))

    fields, _ = _parse_frontmatter(text)
    module_id = str(fields["module_id"])
    profile = get_profile(module_id)
    if profile.archetype is VisualArchetype.DISPLAY_ONLY:
        raise ValueError(f"{module_id}: display-only identity cannot create artifacts")

    target_dir = output_dir or markdown.parent
    docx_path = target_dir / f"{markdown.stem}.docx"
    pdf_path = target_dir / f"{markdown.stem}_VISUAL.pdf"
    exports: list[ExportResult] = []
    if request.wants_docx:
        exports.append(_atomic_export("docx", markdown, docx_path, docx_renderer))
    if request.wants_pdf:
        exports.append(_atomic_export("pdf", markdown, pdf_path, pdf_renderer))

    failed = [result for result in exports if result.status == "failed"]
    return {
        "module_id": module_id,
        "markdown": str(markdown),
        "analytical_status": "complete" if not failed else "complete_with_export_warning",
        "request": request.value,
        "available_actions": ["docx", "pdf", "both"],
        "exports": [result.as_dict() for result in exports],
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("markdown", type=Path)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--docx", action="store_true", help="create editable DOCX")
    selection.add_argument("--pdf", action="store_true", help="create visual PDF")
    selection.add_argument("--both", action="store_true", help="create DOCX and visual PDF")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="directory for requested exports; defaults to the Markdown directory",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    request = (
        ExportRequest.BOTH
        if args.both
        else ExportRequest.PDF
        if args.pdf
        else ExportRequest.DOCX
        if args.docx
        else ExportRequest.NONE
    )
    try:
        result = export_handoff(
            args.markdown,
            request,
            output_dir=args.output_dir,
        )
    except (OSError, UnicodeError, ValueError) as error:
        print(json.dumps({"analytical_status": "blocked", "error": str(error)}, sort_keys=True))
        return 2
    print(json.dumps(result, sort_keys=True))
    return (
        EXIT_EXPORT_FAILURE
        if result["analytical_status"] == "complete_with_export_warning"
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(main())
