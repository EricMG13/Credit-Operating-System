"""Portfolio management endpoints (/api/portfolios) + the portfolio-exposure walk.

Covers the round-trip: create from a holdings xlsx (+ constraints + mandate CSVs)
→ computed exposure/compliance on read → update holdings replaces positions → the
query rail's portfolio-exposure walk lights up. Also asserts a position matching a
registered issuer soft-links and refreshes that issuer's rating.
"""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-portfolios")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""
    from main import app

    with TestClient(app) as c:
        yield c


def _holdings_xlsx(rows) -> bytes:
    """rows = [(ticker, borrower, sector, ranking, ratings, facility_mn, margin, bid, ask, holdings)]"""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Holdings"
    ws.append(["Ticker", "Borrower Name", "Index Sector", "Ranking", "Ratings",
               "Size ($Mn)", "Margin", "Bid", "Ask", "Holdings"])
    for r in rows:
        ws.append(list(r))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# Alpha holds two loans (aggregate to one obligor); Gamma is 2nd-lien / CCC.
_ROWS = [
    ("ALPHA", "Alpha Corp", "Software", "1L Sr. Secd", "B2 / B", 1500, 400, 99.5, 100.5, 4_000_000),
    ("ALPHA", "Alpha Corp", "Software", "1L Sr. Secd", "B2 / B", 1200, 400, 99.5, 100.5, 2_000_000),
    ("BETA", "Beta Inc", "Insurance", "1L Gtd Sr. Secd", "Ba3 / BB-", 800, 300, 100, 100, 3_000_000),
    ("GAMMA", "Gamma LLC", "Chemicals", "2L", "Caa1 / CCC+", 500, 600, 100, 100, 1_000_000),
]
_CONSTRAINTS = (
    "ID,Constraint Category,Parameter,Limit,Breach Type,Source Document\r\n"
    "C-01,Single Name,Max single issuer,≤ 2.5% NAV,Hard,Indenture §7.11\r\n"
    "C-06,Sector,Max single sector,≤ 10.0% NAV,Soft,Indenture §7.11\r\n"
    "C-09,Instrument,Min 1st Lien / Senior Secured,≥ 90.0% NAV,Hard,Indenture §7.11\r\n"
).encode()
_MANDATE = ("Section,Field,Value,Notes\r\n"
            "Key Parties,Trustee,Bank of New York Mellon,\r\n").encode()


def _create(client) -> str:
    r = client.post(
        "/api/portfolios/",
        data={"name": "Test CLO I", "kind": "CLO", "as_of_date": "2026-05-29"},
        files={
            "holdings": ("holdings.xlsx", _holdings_xlsx(_ROWS), _XLSX),
            "constraints": ("cons.csv", _CONSTRAINTS, "text/csv"),
            "mandate": ("mandate.csv", _MANDATE, "text/csv"),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_create_computes_posture(client):
    body = client.post(
        "/api/portfolios/", data={"name": "Compute CLO"},
        files={"holdings": ("h.xlsx", _holdings_xlsx(_ROWS), _XLSX)},
    ).json()
    # 4 positions, 3 obligors (Alpha's two loans aggregate). NAV = 10M @ ~par.
    assert body["n_positions"] == 4
    assert abs(body["total_nav"] - 10_000_000) < 100_000
    assert body["total_par"] == 10_000_000


def test_get_exposure_and_compliance(client):
    pid = _create(client)
    d = client.get(f"/api/portfolios/{pid}").json()
    ex = d["exposure"]
    assert ex["n_obligors"] == 3 and ex["n_sectors"] == 3
    # Alpha = 6M/10M = 60% single name AND Software sector 60% (> both caps → Breach).
    assert ex["single_name_max"]["pct_nav"] == 60.0
    comp = {c["code"]: c for c in d["compliance"]}
    assert comp["C-01"]["status"] == "Breach"           # 60% ≫ 2.5% single name
    assert comp["C-06"]["status"] == "Breach"           # 60% ≫ 10% sector
    assert comp["C-09"]["current"] == 90.0              # 9M 1L / 10M
    assert d["mandate"]["Key Parties"][0]["value"] == "Bank of New York Mellon"


def test_list_includes_created(client):
    pid = _create(client)
    lst = client.get("/api/portfolios/").json()
    row = next(p for p in lst if p["id"] == pid)
    assert row["n_positions"] == 4 and row["breaches"] >= 2


def test_update_holdings_replaces_positions(client):
    pid = _create(client)
    # Re-upload with a single small position → positions replaced, not appended.
    single = [("SOLO", "Solo Co", "Utilities", "1L Sr. Secd", "B1 / B+", 300, 350, 100, 100, 500_000)]
    r = client.post(f"/api/portfolios/{pid}/holdings",
                    files={"holdings": ("h2.xlsx", _holdings_xlsx(single), _XLSX)})
    assert r.status_code == 200, r.text
    assert r.json()["n_positions"] == 1
    assert client.get(f"/api/portfolios/{pid}").json()["exposure"]["n_positions"] == 1


def test_position_links_issuer_and_refreshes_rating(client):
    # An existing issuer whose name matches a position → rating refreshed from holdings.
    iid = client.post("/api/issuers/", json={"name": "Linkable Co", "ticker": "LNK"}).json()["id"]
    assert client.get(f"/api/issuers/{iid}").json()["rating_moody"] is None
    rows = [("LNK", "Linkable Co", "Telecom", "1L Sr. Secd", "B3 / B-", 400, 375, 99, 99, 1_000_000)]
    client.post("/api/portfolios/", data={"name": "Link CLO"},
                files={"holdings": ("h.xlsx", _holdings_xlsx(rows), _XLSX)})
    assert client.get(f"/api/issuers/{iid}").json()["rating_moody"] == "B3"


def test_portfolio_exposure_walk_enabled_and_builds(client):
    _create(client)
    caps = client.get("/api/query/capabilities").json()
    walk = [c for g in caps["groups"] for c in g["capabilities"] if c["id"] == "portfolio-exposure"]
    assert walk and walk[0]["enabled"] is True
    g = client.post("/api/query/graph", json={"capability_id": "portfolio-exposure"}).json()
    sectors = [n for n in g["nodes"] if n["kind"] == "sector"]
    assert sectors and any("%" in n["label"] for n in sectors)


def test_run_auto_binds_and_cp3c_goes_live(client):
    """End-to-end: an issuer held in a book → its run auto-binds → CP-3C's
    concentration register is live (real fixture run, no LLM)."""
    from conftest import wait_for_run

    # Issuer must exist before ingest so the position soft-links to it.
    iid = client.post("/api/issuers/", json={"name": "Concentro Co", "ticker": "CNC"}).json()["id"]
    rows = [
        ("CNC", "Concentro Co", "Software", "1L Sr. Secd", "B2 / B", 1500, 400, 100, 100, 5_000_000),
        ("OTHR", "Other Co", "Insurance", "1L Gtd Sr. Secd", "Ba3 / BB-", 800, 300, 100, 100, 5_000_000),
    ]
    cons = ("ID,Constraint Category,Parameter,Limit,Breach Type\r\n"
            "C-01,Single Name,Max single issuer,≤ 2.5% NAV,Hard\r\n").encode()
    client.post("/api/portfolios/", data={"name": "Concentro CLO"},
                files={"holdings": ("h.xlsx", _holdings_xlsx(rows), _XLSX),
                       "constraints": ("c.csv", cons, "text/csv")})

    run = client.post("/api/runs", json={"issuer_id": iid})
    assert run.status_code == 201, run.text
    finished = wait_for_run(client, run.json()["id"])
    assert finished["status"] == "complete"

    rid = run.json()["id"]
    cp3c = client.get(f"/api/runs/{rid}/modules/CP-3C").json()
    conc = cp3c["runtime_output"].get("concentration")
    assert conc is not None, cp3c["runtime_output"]  # went live (run was portfolio-bound)
    # Concentro = 5M of a 10M book = 50% ≫ 2.5% cap → HIGH.
    assert conc["in_portfolio"] and conc["held_pct_nav"] == 50.0 and conc["concentration_risk"] == "HIGH"

    # …and the concentration flows into the CP-6A debate as a bear point.
    cp6a = client.get(f"/api/runs/{rid}/modules/CP-6A").json()
    bear = cp6a["runtime_output"]["bear_case"]["points"]
    assert any(p["source"] == "CP-3C" for p in bear), bear


def test_empty_holdings_rejected(client):
    # A sheet with no Holdings column → 422 (no CLO positions).
    from openpyxl import Workbook

    wb = Workbook()
    wb.active.append(["Ticker", "Borrower Name", "Ratings"])
    wb.active.append(["X", "Y", "B2 / B"])
    buf = io.BytesIO()
    wb.save(buf)
    r = client.post("/api/portfolios/", data={"name": "Empty CLO"},
                    files={"holdings": ("h.xlsx", buf.getvalue(), _XLSX)})
    assert r.status_code == 422
