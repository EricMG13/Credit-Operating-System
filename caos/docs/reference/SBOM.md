# SBOM / License Report — CAOS (E6)

Generated 2026-07-12. Regenerate at every phase exit and before H3 handover:
the Python table from `caos/server/requirements.lock` (what the prod image
installs with `--require-hashes`) with licenses read from the prod-parity
`.venv311` dist metadata (image-only packages — the `markitdown[pdf]` extra
chain — filled from PyPI metadata); the frontend summary from
`license-checker --production` over `caos/frontend`.

## Verdict

**No copyleft or unknown licenses in shipped code paths.** Everything is
MIT / BSD / Apache-2.0 / ISC / MPL-2.0 / PSF-class. Three flags, all
accepted:

| Flag | Package | Why accepted |
|---|---|---|
| LGPL-3.0-or-later | `@img/sharp-libvips-*` (sharp's prebuilt libvips) | Dynamically-linked native library used at build/serve time; LGPL obligations are met by dynamic linking and we distribute no modified libvips. Internal deployment, not redistributed software. |
| CC-BY-4.0 | `caniuse-lite` | Browser-support **data**, not code; attribution carried by the package itself. |
| UNLICENSED | `caos-frontend@2.0.0` | The app's own private package marker — correct for proprietary internal software. |

Weak-copyleft notes (no action): 3 Python packages under MPL-2.0
(file-level copyleft — unmodified use), `certifi` under MPL-2.0, ZPL-2.1 ×2,
PSF-2.0 — all permissive-in-practice for an internal, non-redistributed
deployment.

## Frontend production dependencies (summary)

| License | Count |
|---|---|
| MIT | 203 |
| ISC | 29 |
| Apache-2.0 | 8 |
| BSD-3-Clause | 4 |
| MIT AND ISC | 1 |
| LGPL-3.0-or-later | 1 (see flag table) |
| CC-BY-4.0 | 1 (see flag table) |
| UNLICENSED | 1 (the app itself) |
| 0BSD | 1 |

Regenerate: `npx license-checker --production --summary` in `caos/frontend`.

## Python server dependencies (from `requirements.lock`)

| Package (lock pin) | Version | License |
|---|---|---|
| aiosqlite | 0.22.1 | MIT License |
| alembic | 1.18.5 | MIT License |
| annotated-doc | 0.0.4 | MIT |
| annotated-types | 0.7.0 | MIT License |
| anthropic | 0.116.0 | MIT License |
| anyio | 4.14.1 | MIT |
| asyncpg | 0.31.0 | Apache Software License |
| beautifulsoup4 | 4.15.0 | MIT License (from PyPI metadata) |
| certifi | 2026.6.17 | Mozilla Public License 2.0 (MPL 2.0) |
| cffi | 2.0.0 | MIT |
| charset-normalizer | 3.4.7 | MIT |
| click | 8.4.2 | BSD-3-Clause |
| cryptography | 49.0.0 | Apache-2.0 OR BSD-3-Clause |
| defusedxml | 0.7.1 | Python Software Foundation License |
| distro | 1.9.0 | Apache Software License |
| docstring-parser | 0.18.0 | MIT License |
| et-xmlfile | 2.0.0 | MIT License |
| fastapi | 0.139.0 | MIT |
| flatbuffers | 25.12.19 | Apache-2.0 (from PyPI metadata) |
| google-auth | 2.55.1 | Apache Software License |
| google-genai | 2.10.0 | Apache-2.0 |
| greenlet | 3.5.2 | MIT AND PSF-2.0 |
| h11 | 0.16.0 | MIT License |
| httpcore | 1.0.9 | BSD-3-Clause |
| httptools | 0.8.0 | MIT |
| httpx | 0.28.1 | BSD License |
| idna | 3.18 | BSD-3-Clause |
| jiter | 0.15.0 | MIT |
| magika | 0.6.3 | Apache-2.0 (from PyPI metadata) |
| mako | 1.3.12 | MIT License |
| markdownify | 1.2.2 | MIT License (from PyPI metadata) |
| markitdown | 0.1.6 | MIT (from PyPI metadata) |
| markupsafe | 3.0.3 | BSD-3-Clause |
| numpy | 2.4.6 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| onnxruntime | 1.27.0 | MIT License (from PyPI metadata) |
| openpyxl | 3.1.5 | MIT License |
| packaging | 26.2 | Apache-2.0 OR BSD-2-Clause |
| pdfminer-six | 20260107 | MIT (from PyPI metadata) |
| pdfplumber | 0.11.10 | MIT License (from PyPI metadata) |
| pgvector | 0.4.2 | MIT |
| pillow | 12.2.0 | MIT-CMU (from PyPI metadata) |
| protobuf | 7.35.1 | BSD-3-Clause (from PyPI metadata) |
| pyasn1 | 0.6.3 | BSD-2-Clause |
| pyasn1-modules | 0.4.2 | BSD License |
| pycparser | 3.0 | BSD-3-Clause |
| pydantic | 2.13.4 | MIT |
| pydantic-core | 2.46.4 | MIT |
| pydantic-settings | 2.14.2 | MIT |
| pypdf | 6.14.2 | BSD-3-Clause |
| pypdfium2 | 5.10.1 | BSD-3-Clause / Apache-2.0 (+ bundled PDFium licenses) (from PyPI metadata) |
| python-dotenv | 1.2.2 | BSD-3-Clause |
| python-multipart | 0.0.32 | Apache-2.0 |
| pyyaml | 6.0.3 | MIT License |
| regex | 2026.6.28 | Apache-2.0 AND CNRI-Python |
| requests | 2.34.2 | Apache Software License |
| six | 1.17.0 | MIT License |
| sniffio | 1.3.1 | MIT License; Apache Software License |
| soupsieve | 2.8.4 | MIT (from PyPI metadata) |
| sqlalchemy | 2.0.51 | MIT |
| starlette | 1.3.1 | BSD-3-Clause |
| tenacity | 9.1.4 | Apache Software License |
| tiktoken | 0.13.0 | MIT License |
| typing-extensions | 4.15.0 | PSF-2.0 |
| typing-inspection | 0.4.2 | MIT |
| urllib3 | 2.7.0 | MIT |
| uvicorn | 0.51.0 | BSD-3-Clause |
| uvloop | 0.22.1 | Apache Software License; MIT License |
| watchfiles | 1.2.0 | MIT License |
| websockets | 16.0 | BSD-3-Clause |

Regenerate: enumerate `requirements.lock` pins and join licenses from
`.venv311` dist metadata (see the E6 note in PRE_DEPLOYMENT_PLAN.md); the
lock is authoritative for versions — a lagging local venv must not change a
version listed here.
