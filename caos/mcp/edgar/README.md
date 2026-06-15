# CAOS EDGAR MCP server

Exposes CAOS's **free SEC EDGAR** covenant-retrieval lane as agent tools, so a
Claude agent driving **CP-4 (LegalCovenantInterpreter)** can locate and vault
governing legal documents end-to-end — no key, no paid service.

It is a thin wrapper over the CAOS API (`/api/edgar/*`). The FastAPI server stays
the single enforcement point for SEC fair-access, the document vault, and
identity; this wrapper exists only because the MCP SDK needs Python **3.10+**
while the CAOS server runs on **3.9** (the same out-of-process split used for
markitdown).

See the methodology in
[`Modular OS/CP-4/REF_CP-4_EDGARCovenantSourceMap.md`](../../../Modular%20OS/CP-4/REF_CP-4_EDGARCovenantSourceMap.md)
and the rationale in [`caos/docs/AGENT_SKILLS_REVIEW.md`](../../docs/AGENT_SKILLS_REVIEW.md).

## Tools

| Tool | Purpose | Provenance |
|---|---|---|
| `edgar_search` | Full-text search for filings | returns **pointers** (`external · unverified`) |
| `edgar_issuer_filings` | An issuer's recent filings by CIK | pointers |
| `edgar_list_exhibits` | A filing's documents, classified + ranked vs the CP-4 taxonomy | pointers |
| `edgar_fetch_and_vault` | Fetch an exhibit and vault it for an issuer | produces a **vaulted** primary source (E-xx eligible) |

**Provenance discipline (enforced by tool descriptions):** a search hit is a
*pointer* and **cannot be cited**. Only `edgar_fetch_and_vault` turns it into a
primary source able to satisfy the CP-4 Legal File Gate and clear CP-5/CP-5B.

## Prerequisites

1. A running CAOS server with the EDGAR lane enabled — set on the **server**:
   ```bash
   export EDGAR_USER_AGENT="Your Firm research@yourfirm.example"   # SEC fair-access; required
   ```
   Without it, the API 503s the EDGAR endpoints. No API key or cost.
2. Python 3.10+ for this wrapper.

## Install

```bash
cd caos/mcp/edgar
uv venv && uv pip install -e .        # or: pip install -e .
```

## Configure your MCP client

```jsonc
{
  "mcpServers": {
    "caos-edgar": {
      "command": "python",
      "args": ["/ABS/PATH/caos/mcp/edgar/server.py"],
      "env": {
        "CAOS_API_BASE": "http://localhost:8000",
        "CAOS_ANALYST_EMAIL": "analyst@yourfirm.example"
      }
    }
  }
}
```

| Env | Default | Notes |
|---|---|---|
| `CAOS_API_BASE` | `http://localhost:8000` | Base URL of the CAOS server |
| `CAOS_ANALYST_EMAIL` | _(unset)_ | Forwarded identity (`X-Forwarded-Email`). Optional locally (dev identity); set it for a deployed CAOS behind the Databricks edge. |

## Typical agent flow (CP-4 cold start)

1. `edgar_search("Atlas Forge Industrials Credit Agreement", forms="8-K,10-K")`
   → filing pointers.
2. `edgar_list_exhibits(cik, accession)` → pick the exhibit labelled
   *Credit Agreement* / *Indenture* (CP-4 authority rank 1).
3. `edgar_fetch_and_vault(issuer_id, exhibit_url)` → the document is vaulted and
   chunked; now an E-xx-eligible primary source.
4. Run CP-4 — the Legal File Gate is satisfied by a primary executed document.

## Deployment note

The CAOS server makes outbound HTTPS calls to `sec.gov` / `data.sec.gov`. On
Databricks Apps confirm egress to those hosts is permitted. The browser CSP
(`connect-src 'self'`) does not affect this server-side fetch.
