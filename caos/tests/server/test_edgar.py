"""EDGAR retrieval lane — unit tests for the client (hermetic, HTTP mocked) and
route tests for the search/vault endpoints. No real network: edgar's HTTP layer
and fetch are monkeypatched.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

import edgar  # noqa: E402


# ─── unit: client logic (HTTP mocked) ────────────────────────────────────────


def test_http_get_requires_user_agent(monkeypatch):
    monkeypatch.setattr(edgar.settings, "edgar_user_agent", "")
    with pytest.raises(edgar.EdgarError):
        edgar._http_get("https://efts.sec.gov/LATEST/search-index?q=x")


def test_normalize_cik():
    assert edgar.normalize_cik("320193") == "0000320193"
    assert edgar.normalize_cik("CIK0000320193") == "0000320193"
    with pytest.raises(edgar.EdgarError):
        edgar.normalize_cik("nope")


def test_search_parses_hits_and_flags_pointer(monkeypatch):
    payload = {
        "hits": {
            "hits": [
                {
                    "_id": "0001193125-22-000123:dex101.htm",
                    "_source": {
                        "ciks": ["0000320193"],
                        "file_type": "8-K",
                        "file_date": "2022-03-01",
                        "display_names": ["Atlas Forge Industrials (CIK 0000320193)"],
                    },
                }
            ]
        }
    }
    monkeypatch.setattr(edgar, "_get_json", lambda url: payload)
    hits = edgar.search("Atlas Forge Credit Agreement", forms=["8-K"])
    assert len(hits) == 1
    h = hits[0]
    assert h.cik == "0000320193"
    assert h.accession == "0001193125-22-000123"
    assert h.primary_doc == "dex101.htm"
    assert h.form == "8-K"
    # a search hit is a pointer — not citable until vaulted
    assert h.provenance == edgar.PROV_POINTER
    assert h.source_url.endswith("/000119312522000123/dex101.htm")


def test_list_exhibits_classifies_and_orders(monkeypatch):
    payload = {
        "directory": {
            "item": [
                {"name": "form8k.htm", "type": "8-K", "size": "999"},
                {"name": "dex41.htm", "type": "EX-4.1", "size": "12345"},
                {"name": "dex101.htm", "type": "EX-10.1", "size": "23456"},
            ]
        }
    }
    monkeypatch.setattr(edgar, "_get_json", lambda url: payload)
    ex = edgar.list_exhibits("320193", "0001193125-22-000123")
    by_name = {e.name: e for e in ex}
    assert by_name["dex41.htm"].doc_label == "Indenture"
    assert by_name["dex41.htm"].authority_rank == 1
    assert by_name["dex101.htm"].doc_label == "Credit Agreement"
    assert by_name["dex101.htm"].authority_rank == 1
    assert by_name["form8k.htm"].authority_rank is None
    # ranked governing docs sort ahead of the unclassified cover filing
    assert ex[-1].name == "form8k.htm"


@pytest.mark.parametrize(
    "filename,desc,label,rank",
    [
        ("indenture.htm", "", "Indenture", 1),
        ("first-supplemental-indenture.htm", "", "Supplemental Indenture", 1),
        ("ex10-1.htm", "Credit Agreement", "Credit Agreement", 1),
        ("intercreditor.htm", "", "Intercreditor Agreement", 2),
        ("d424b5.htm", "prospectus", "Covenant Description (prospectus)", 4),
        ("ex99-1.htm", "press release", "Marketing / Press (Ex-99)", 6),
        ("random.htm", "", "Other / Unclassified", None),
    ],
)
def test_classify(filename, desc, label, rank):
    assert edgar.classify(filename, desc) == (label, rank)


def test_fetch_exhibit_rejects_non_archive_url(monkeypatch):
    monkeypatch.setattr(edgar.settings, "edgar_user_agent", "Test UA t@e.st")
    with pytest.raises(edgar.EdgarError):
        edgar.fetch_exhibit("https://evil.example/x.htm")


@pytest.mark.parametrize(
    "url",
    [
        # look-alike host: prefix check passes, host does not (SSRF)
        "https://www.sec.gov.evil.com/Archives/x",
        # userinfo trick: hostname is evil.com, "www.sec.gov" is the username
        "https://www.sec.gov@evil.com/Archives/x",
        # path-embedded decoy: real host is evil.com
        "https://evil.com/https://www.sec.gov/Archives/x",
        # right host, wrong scheme — only https is allowed
        "http://www.sec.gov/Archives/x",
        # right host, wrong path root
        "https://www.sec.gov/cgi-bin/x",
    ],
)
def test_fetch_exhibit_rejects_ssrf_bypasses(monkeypatch, url):
    """SSRF guard (P-3): a bare startswith() prefix check is bypassable. The parsed
    host must be exactly www.sec.gov, scheme https, path under /Archives/, and no
    embedded credentials — so these all reject before any network call."""
    monkeypatch.setattr(edgar.settings, "edgar_user_agent", "Test UA t@e.st")
    # Fail loudly if the guard ever lets one through to the network in a test.
    monkeypatch.setattr(edgar, "_http_get", lambda *a, **k: pytest.fail(f"fetched {url!r}"))
    with pytest.raises(edgar.EdgarError):
        edgar.fetch_exhibit(url)


def test_fetch_exhibit_accepts_legit_archive_url(monkeypatch):
    """A genuine www.sec.gov/Archives/ URL passes the guard and reaches _http_get."""
    monkeypatch.setattr(edgar.settings, "edgar_user_agent", "Test UA t@e.st")
    seen = {}

    def fake_http_get(url, accept="application/json", cap_bytes=None):
        seen["url"], seen["accept"], seen["cap"] = url, accept, cap_bytes
        return b"<html>ok</html>"

    monkeypatch.setattr(edgar, "_http_get", fake_http_get)
    good = "https://www.sec.gov/Archives/edgar/data/320193/000.../creditagreement.htm"
    assert edgar.fetch_exhibit(good) == b"<html>ok</html>"
    assert seen["url"] == good
    assert seen["accept"] == "*/*" and seen["cap"] is not None
    # host match is case-insensitive (SEC sometimes upper-cases)
    monkeypatch.setattr(
        edgar, "_http_get", lambda *a, **k: b"ok2"
    )
    assert edgar.fetch_exhibit("https://WWW.SEC.GOV/Archives/x.htm") == b"ok2"


# ─── route tests ─────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-edgar")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""
    from main import app

    with TestClient(app) as c:
        yield c


def test_search_route_503_without_ua(client, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "edgar_user_agent", "")
    assert client.get("/api/edgar/search", params={"q": "atlas"}).status_code == 503


def test_search_route_returns_pointers(client, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "edgar_user_agent", "Test UA t@e.st")

    def fake_search(query, forms=None, date_from=None, date_to=None, limit=10):
        return [
            edgar.FilingHit(
                cik="0000320193",
                accession="0001193125-22-000123",
                form="8-K",
                filed_date="2022-03-01",
                title="Atlas Forge Industrials",
                primary_doc="dex101.htm",
                source_url="https://www.sec.gov/Archives/edgar/data/320193/.../dex101.htm",
            )
        ]

    monkeypatch.setattr(edgar, "search", fake_search)
    r = client.get("/api/edgar/search", params={"q": "Atlas Forge Credit Agreement"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body[0]["provenance"] == edgar.PROV_POINTER
    assert body[0]["accession"] == "0001193125-22-000123"


def test_vault_exhibit_creates_primary_source(client, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "edgar_user_agent", "Test UA t@e.st")
    html = b"<html><body>" + (b"This is a credit agreement clause. " * 200) + b"</body></html>"
    monkeypatch.setattr(edgar, "fetch_exhibit", lambda url: html)

    issuer_id = client.get("/api/issuers/").json()[0]["id"]
    r = client.post(
        "/api/edgar/vault-exhibit",
        json={
            "issuer_id": issuer_id,
            "exhibit_url": "https://www.sec.gov/Archives/edgar/data/320193/000.../creditagreement.htm",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provenance"] == edgar.PROV_VAULTED
    assert body["chunks_created"] > 0
    assert body["document_id"]

    docs = client.get(f"/api/issuers/{issuer_id}/documents").json()
    assert any(d["doc_type"] == "EDGAR Exhibit" and d["run_mode"] == "legal" for d in docs)


def test_filings_route_503_without_ua(client, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "edgar_user_agent", "")
    assert client.get("/api/edgar/filings/0000320193").status_code == 503


def test_filings_route_returns_hits_and_passes_form_filter(client, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "edgar_user_agent", "Test UA t@e.st")
    seen = {}

    def fake_list_filings(cik, forms=None, limit=25):
        seen["cik"], seen["forms"], seen["limit"] = cik, forms, limit
        return [
            edgar.FilingHit(
                cik="0000320193",
                accession="0001193125-22-000123",
                form="10-K",
                filed_date="2022-03-01",
                title="Atlas Forge Industrials",
                primary_doc="aapl-20220301.htm",
                source_url="https://www.sec.gov/Archives/edgar/data/320193/.../aapl.htm",
            )
        ]

    monkeypatch.setattr(edgar, "list_filings", fake_list_filings)
    r = client.get("/api/edgar/filings/0000320193", params={"forms": "10-K,8-K", "limit": 5})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body[0]["accession"] == "0001193125-22-000123"
    assert body[0]["provenance"] == edgar.PROV_POINTER  # a filing hit is a pointer until vaulted
    # the CSV `forms` param is split to a list and the limit forwarded to the client
    assert seen["forms"] == ["10-K", "8-K"]
    assert seen["limit"] == 5


def test_filings_route_rejects_out_of_range_limit(client, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "edgar_user_agent", "Test UA t@e.st")
    # limit is Query(ge=1, le=100) — boundary violations are 422 before the handler runs
    assert client.get("/api/edgar/filings/0000320193", params={"limit": 0}).status_code == 422
    assert client.get("/api/edgar/filings/0000320193", params={"limit": 101}).status_code == 422
