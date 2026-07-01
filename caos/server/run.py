"""Launcher — binds HOST:PORT (defaults 127.0.0.1:8000 for local dev).

The Docker deploy sets HOST=0.0.0.0 and PORT (deploy/Dockerfile), so the
container binds the wide interface; local `python run.py` stays on localhost.
"""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run("main:app", host=host, port=port, app_dir=str(Path(__file__).parent))
