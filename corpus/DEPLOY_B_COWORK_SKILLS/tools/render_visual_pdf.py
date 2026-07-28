#!/usr/bin/env python3
"""Compatibility CLI and API for the CP visual-PDF renderer."""

try:
    from tools.visual_pdf.renderer import *  # noqa: F401,F403
    from tools.visual_pdf.renderer import main
except ModuleNotFoundError:  # Direct execution from a deployed tools directory.
    from visual_pdf.renderer import *  # type: ignore[no-redef]  # noqa: F401,F403
    from visual_pdf.renderer import main  # type: ignore[no-redef]


if __name__ == "__main__":
    raise SystemExit(main())
