"""Launcher — binds the port Databricks Apps assigns (DATABRICKS_APP_PORT).

Locally: python run.py  (defaults to 127.0.0.1:8000; on Databricks the
platform sets DATABRICKS_APP_PORT and needs the wide bind).
"""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", os.environ.get("PORT", "8000")))
    host = "0.0.0.0" if os.environ.get("DATABRICKS_APP_PORT") else os.environ.get("HOST", "127.0.0.1")
    uvicorn.run("main:app", host=host, port=port, app_dir=str(Path(__file__).parent))
