"""CAOS EDGAR MCP server — exposes the free SEC EDGAR covenant-retrieval lane as
agent tools, so a Claude agent driving CP-4 can locate and vault governing legal
documents end-to-end.

This is a thin wrapper over the CAOS API (``/api/edgar/*``): the FastAPI server
remains the single enforcement point for SEC fair-access (EDGAR_USER_AGENT), the
document vault, and identity. The wrapper is a separate process because the MCP
SDK needs Python 3.10+, while the CAOS server runs on 3.9 — the same out-of-process
split used for markitdown.

Provenance discipline (surfaced in every tool description so the agent honors it):
a search hit is a POINTER (``external · unverified``) and CANNOT be cited; only a
vaulted exhibit earns an E-xx and can satisfy the CP-4 Legal File Gate.

Config (env):
  CAOS_API_BASE        Base URL of the CAOS server. Default http://localhost:8000
  CAOS_ANALYST_EMAIL   Forwarded identity for the API (X-Forwarded-Email). Optional
                       locally (dev identity); set it for a deployed CAOS.

Run:  python server.py        (stdio transport — launched by the MCP client)
"""

from __future__ import annotations

import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("CAOS_API_BASE", "http://localhost:8000").rstrip("/")
ANALYST_EMAIL = os.environ.get("CAOS_ANALYST_EMAIL", "")

mcp = FastMCP("caos-edgar")


def _headers() -> dict:
    return {"X-Forwarded-Email": ANALYST_EMAIL} if ANALYST_EMAIL else {}


async def _api(method: str, path: str, **kw) -> object:
    async with httpx.AsyncClient(base_url=API_BASE, timeout=60.0) as client:
        resp = await client.request(method, path, headers=_headers(), **kw)
    if resp.status_code >= 400:
        detail = resp.json().get("detail", resp.text) if resp.content else resp.text
        raise RuntimeError(f"CAOS API {resp.status_code}: {detail}")
    return resp.json()


@mcp.tool()
async def edgar_search(query: str, forms: str = "", limit: int = 10) -> str:
    """Search SEC EDGAR full text for filings. Returns POINTERS only
    (``external · unverified``) — a hit locates a document but CANNOT be cited;
    only a vaulted exhibit earns an E-xx. Pair the issuer name with a term like
    "Credit Agreement", "Indenture", "Supplemental Indenture", or "Description of
    Notes". ``forms`` is an optional comma-separated filter, e.g. "8-K,S-4,10-K".
    """
    params = {"q": query, "limit": limit}
    if forms:
        params["forms"] = forms
    return json.dumps(await _api("GET", "/api/edgar/search", params=params), indent=2)


@mcp.tool()
async def edgar_issuer_filings(cik: str, forms: str = "", limit: int = 25) -> str:
    """List an issuer's recent EDGAR filings by CIK, optionally filtered to
    covenant-bearing carrier forms (e.g. "8-K,S-4,10-K"). Returns pointers."""
    params = {"limit": limit}
    if forms:
        params["forms"] = forms
    return json.dumps(await _api("GET", f"/api/edgar/filings/{cik}", params=params), indent=2)


@mcp.tool()
async def edgar_list_exhibits(cik: str, accession: str) -> str:
    """List the documents in a filing, each classified against the CP-4 covenant
    taxonomy (Credit Agreement / Indenture / Intercreditor / Covenant Description
    ...) with its CP-4 authority rank. Use this to pick the exhibit to vault."""
    params = {"cik": cik, "accession": accession}
    return json.dumps(await _api("GET", "/api/edgar/exhibits", params=params), indent=2)


@mcp.tool()
async def edgar_fetch_and_vault(
    issuer_id: str, exhibit_url: str, file_name: str = "", run_mode: str = "legal"
) -> str:
    """Fetch a specific EDGAR exhibit and VAULT it for the issuer through CAOS's
    standard ingest path. This is the step that turns a pointer into a PRIMARY,
    E-xx-eligible source able to satisfy the CP-4 Legal File Gate and clear
    CP-5/CP-5B. ``exhibit_url`` must be an EDGAR Archives URL (from
    edgar_list_exhibits). Returns the new document_id and chunk count."""
    body = {
        "issuer_id": issuer_id,
        "exhibit_url": exhibit_url,
        "run_mode": run_mode,
    }
    if file_name:
        body["file_name"] = file_name
    return json.dumps(await _api("POST", "/api/edgar/vault-exhibit", json=body), indent=2)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
