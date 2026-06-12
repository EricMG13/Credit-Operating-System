#!/usr/bin/env bash
# Build the Next.js static export and stage it into the server's static dir,
# so the FastAPI app (and the Databricks App bundle) ships the UI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT/frontend"
npm run build

rm -rf "$ROOT/server/static"
cp -R "$ROOT/frontend/out" "$ROOT/server/static"

echo "Frontend staged at caos/server/static ($(find "$ROOT/server/static" -type f | wc -l | tr -d ' ') files)"
