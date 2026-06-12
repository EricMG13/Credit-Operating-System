"""Launcher — binds the port Databricks Apps assigns (DATABRICKS_APP_PORT).

Locally: python run.py  (defaults to 0.0.0.0:8000)
"""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", os.environ.get("PORT", "8000")))
    uvicorn.run("main:app", host="0.0.0.0", port=port, app_dir=str(Path(__file__).parent))
