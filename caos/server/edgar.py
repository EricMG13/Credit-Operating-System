"""SEC EDGAR retrieval — a free, no-key lane for covenant/legal source documents.

This is the data path behind ``Modular OS/CP-4/REF_CP-4_EDGARCovenantSourceMap.md``:
locate and pull executed governing documents (credit agreements = Ex-10.x,
indentures/supplements = Ex-4.x, covenant "Description of Notes" = S-4/424B) from
SEC EDGAR, which is a *primary* source — higher authority than any paid
aggregator's read of it, and consistent with the no-paid-services constraint.

Provenance discipline (mirrors the CP-5/CP-5B gate):
  * A search hit / filing pointer is ``external · unverified`` — it may locate a
    document but cannot be cited. The route layer turns a pointer into a vaulted
    document (E-xx eligible) by fetching the exhibit and running it through the
    same ingest path as an uploaded file.

Dependency-light by design: stdlib ``urllib`` only — no HTTP-client dependency
to version-manage on this security-sensitive fetch path (the deploy image runs
Python 3.14; the MCP wrapper under ``caos/mcp/edgar/`` is a separate process
that calls the API).
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import List, Optional, Tuple

from config import get_settings

settings = get_settings()

# EDGAR endpoints (all free, no key).
_EFTS_URL = "https://efts.sec.gov/LATEST/search-index"  # full-text search (2001+)
_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
_ARCHIVES = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}"

# Provenance labels — shared with the route + CP-4 reference.
PROV_POINTER = "external · unverified"
PROV_VAULTED = "primary · vaulted"

# SEC fair-access: stay well under 10 req/s across all configured app processes.
# Each process owns a lock, so its interval is multiplied by the total partition
# count; N processes then aggregate to at most 1/0.15 = 6.67 requests/second.
_MIN_INTERVAL_S = 0.15
_rate_lock = threading.Lock()
_last_request = 0.0


def _rate_partitions() -> int:
    values = []
    for name in ("WEB_CONCURRENCY", "CAOS_SEC_RATE_PARTITIONS"):
        try:
            values.append(max(1, int(os.environ.get(name, "1"))))
        except ValueError:
            values.append(1)
    return max(values)


def _process_min_interval_s() -> float:
    return _MIN_INTERVAL_S * _rate_partitions()


class EdgarError(Exception):
    """Any EDGAR retrieval failure (missing User-Agent, HTTP error, bad payload)."""


@dataclass
class FilingHit:
    """A pointer to a filing. Until the exhibit is fetched + vaulted it is
    ``external · unverified`` and cannot satisfy the CP-4 Legal File Gate."""

    cik: str
    accession: str
    form: str
    filed_date: str
    title: str
    primary_doc: str
    source_url: str
    provenance: str = PROV_POINTER


@dataclass
class Exhibit:
    """One document within a filing, classified against the CP-4 taxonomy."""

    name: str
    url: str
    doc_label: str  # e.g. "Credit Agreement", "Indenture", "Covenant Description"
    authority_rank: Optional[int]  # CP-4 6-rank hierarchy; None = unclassified
    size: Optional[int] = None


# ─── HTTP (fair-access enforced) ─────────────────────────────────────────────


def _validate_sec_url(url: str) -> None:
    try:
        parsed = urllib.parse.urlsplit(url)
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except (TypeError, ValueError) as exc:
        raise EdgarError("EDGAR URL is malformed.") from exc
    if (
        parsed.scheme.lower() != "https"
        or (host != "sec.gov" and not host.endswith(".sec.gov"))
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
    ):
        raise EdgarError("EDGAR URL must use HTTPS on an SEC host.")


class _SecOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        _validate_sec_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _http_get(url: str, accept: str = "application/json", cap_bytes: Optional[int] = None) -> bytes:
    """GET ``url`` with the configured fair-access User-Agent and throttle.

    Raises EdgarError if no User-Agent is configured (SEC 403s those) — this is
    also the off-switch: the lane is disabled until ``EDGAR_USER_AGENT`` is set.
    """
    ua = settings.edgar_user_agent.strip()
    if not ua:
        raise EdgarError(
            "EDGAR is not configured. Set EDGAR_USER_AGENT to a descriptive "
            "contact string (e.g. 'Atlas Credit research@atlas.example') — SEC "
            "fair-access requires it. No key or paid service is needed."
        )

    _validate_sec_url(url)
    global _last_request
    with _rate_lock:
        wait = _process_min_interval_s() - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()

    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": accept})
    opener = urllib.request.build_opener(_SecOnlyRedirectHandler())
    try:
        with opener.open(req, timeout=settings.edgar_timeout_s) as resp:
            # The redirect handler rejects an unsafe target before dispatch. Keep
            # the final check as defense in depth against a custom handler/response.
            _validate_sec_url(resp.url)
            if cap_bytes is not None:
                data = resp.read(cap_bytes + 1)
                if len(data) > cap_bytes:
                    raise EdgarError(f"Document exceeds the {cap_bytes // (1024*1024)} MB cap")
                return data
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise EdgarError(f"EDGAR HTTP {exc.code} for {url}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        # Don't surface the raw network/OS error text to the client; keep the
        # cause chained for the server-side traceback.
        raise EdgarError("EDGAR request failed — network error or timeout.") from exc


def _reject_non_finite(tok: str) -> float:
    # Stdlib json.loads accepts NaN/Infinity/-Infinity; refuse them so a non-finite
    # literal can't enter an EDGAR-derived financial field (fail-closed at the seam).
    raise ValueError(f"non-finite JSON literal {tok!r} rejected")


def _get_json(url: str) -> dict:
    try:
        return json.loads(
            _http_get(url).decode("utf-8", "replace"),
            parse_constant=_reject_non_finite,
        )
    except ValueError as exc:  # JSONDecodeError (a ValueError) + the non-finite reject
        raise EdgarError(f"EDGAR returned non-JSON for {url}") from exc


def normalize_cik(cik: str) -> str:
    """10-digit zero-padded CIK (EDGAR's canonical form)."""
    digits = re.sub(r"\D", "", str(cik))
    if not digits:
        raise EdgarError(f"Not a valid CIK: {cik!r}")
    return digits.zfill(10)


# ─── Search / discovery (returns pointers) ───────────────────────────────────


def search(
    query: str,
    forms: Optional[List[str]] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 10,
) -> List[FilingHit]:
    """Full-text search across EDGAR filings (2001-present). Returns pointers
    (``external · unverified``). Useful queries pair the issuer name with a term
    like "Credit Agreement", "Indenture", "Supplemental Indenture", or
    "Description of Notes"."""
    params = {"q": query}
    if forms:
        params["forms"] = ",".join(forms)
    if date_from:
        params["dateRange"] = "custom"
        params["startdt"] = date_from
        params["enddt"] = date_to or date_from
    url = f"{_EFTS_URL}?{urllib.parse.urlencode(params)}"
    payload = _get_json(url)

    hits: List[FilingHit] = []
    for raw in payload.get("hits", {}).get("hits", [])[:limit]:
        src = raw.get("_source", {})
        _id = raw.get("_id", "")
        accession, _, primary_doc = _id.partition(":")
        ciks = src.get("ciks") or []
        cik = normalize_cik(ciks[0]) if ciks else ""
        names = src.get("display_names") or []
        hits.append(
            FilingHit(
                cik=cik,
                accession=accession,
                form=src.get("file_type") or src.get("form") or "",
                filed_date=src.get("file_date", ""),
                title=names[0] if names else query,
                primary_doc=primary_doc,
                source_url=_doc_url(cik, accession, primary_doc) if cik and primary_doc else "",
            )
        )
    return hits


def list_filings(
    cik: str, forms: Optional[List[str]] = None, limit: int = 25
) -> List[FilingHit]:
    """An issuer's recent filings from the submissions API, optionally filtered to
    the covenant-bearing carrier forms (8-K, S-4, 10-K, ...)."""
    cik10 = normalize_cik(cik)
    payload = _get_json(_SUBMISSIONS_URL.format(cik=cik10))
    name = payload.get("name", "")
    recent = payload.get("filings", {}).get("recent", {})
    accs = recent.get("accessionNumber", [])
    forms_arr = recent.get("form", [])
    dates = recent.get("filingDate", [])
    docs = recent.get("primaryDocument", [])
    descs = recent.get("primaryDocDescription", [])
    want = {f.upper() for f in forms} if forms else None

    out: List[FilingHit] = []
    for i, acc in enumerate(accs):
        form = forms_arr[i] if i < len(forms_arr) else ""
        if want and form.upper() not in want:
            continue
        primary = docs[i] if i < len(docs) else ""
        out.append(
            FilingHit(
                cik=cik10,
                accession=acc,
                form=form,
                filed_date=dates[i] if i < len(dates) else "",
                title=(descs[i] if i < len(descs) else "") or name,
                primary_doc=primary,
                source_url=_doc_url(cik10, acc, primary) if primary else "",
            )
        )
        if len(out) >= limit:
            break
    return out


def list_exhibits(cik: str, accession: str) -> List[Exhibit]:
    """The documents in a filing, classified against the CP-4 covenant taxonomy."""
    cik10 = normalize_cik(cik)
    acc_nodash = accession.replace("-", "")
    base = _ARCHIVES.format(cik=int(cik10), acc=acc_nodash)
    payload = _get_json(f"{base}/index.json")
    items = payload.get("directory", {}).get("item", [])

    out: List[Exhibit] = []
    for item in items:
        name = item.get("name", "")
        if not name or name.lower().endswith((".json", ".jpg", ".gif", ".png")):
            continue
        label, rank = classify(name, item.get("type", ""))
        out.append(
            Exhibit(
                name=name,
                url=f"{base}/{name}",
                doc_label=label,
                authority_rank=rank,
                size=_as_int(item.get("size")),
            )
        )
    # Surface the classified governing documents first.
    out.sort(key=lambda e: (e.authority_rank is None, e.authority_rank or 99))
    return out


def fetch_exhibit(url: str) -> bytes:
    """Download a single exhibit document (capped). The route vaults the result,
    turning a pointer into an E-xx-eligible primary source.

    SSRF guard: ``url`` is user-supplied, so a ``startswith`` prefix check alone is
    not enough — ``https://www.sec.gov.evil.com/Archives/x`` and
    ``https://www.sec.gov@evil.com/Archives/x`` both pass a naive prefix test yet
    resolve off-host. Parse the URL and require https + an exact ``www.sec.gov``
    host (case-insensitive) + the ``/Archives/`` path, and reject any userinfo
    (``@``). ``_http_get`` then re-checks the *post-redirect* host stays on
    ``.sec.gov`` (an open redirect on sec.gov can't bounce the fetch off-host)."""
    parts = urllib.parse.urlsplit(url)
    host = (parts.hostname or "").lower()
    # Reject embedded credentials (userinfo): "https://www.sec.gov@evil.com/..."
    # parses with hostname=evil.com, but a credential form is never legitimate here
    # and is the classic prefix-check bypass — refuse it outright regardless.
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        raise EdgarError("Refusing to fetch a URL with embedded credentials")
    if parts.scheme != "https" or host != "www.sec.gov" or not parts.path.startswith("/Archives/"):
        raise EdgarError("Refusing to fetch a non-EDGAR-archive URL")
    cap = settings.edgar_max_exhibit_mb * 1024 * 1024
    return _http_get(url, accept="*/*", cap_bytes=cap)


# ─── Classification (lifts the open Octagon SEC filing→covenant taxonomy) ─────

# Filename/description heuristics → (CP-4 controlling-document label, authority
# rank per the 6-rank hierarchy in CP-4_ACTIVE_PROMPT). Heuristic by design — the
# analyst/CP-4 confirms the governing document; this just routes acquisition.
_CLASSIFIERS: List[Tuple[str, str, Optional[int]]] = [
    (r"supplement.*indenture|suppl?\.?\s*indenture|first.*supplemental", "Supplemental Indenture", 1),
    (r"indenture|\bex-?4\b|\bdex4|\bex4", "Indenture", 1),
    (r"amend.*restat|\ba&r\b|amendment", "Amendment / A&R", 1),
    (r"intercreditor", "Intercreditor Agreement", 2),
    (r"credit\s*agreement|loan\s*agreement|\bex-?10\b|\bdex10|\bex10", "Credit Agreement", 1),
    (r"securit(y|ies)\s*agreement|pledge|guarant(y|ee)|collateral", "Security / Guarantee Agreement", 1),
    (r"compliance\s*certificate|covenant\s*compliance", "Compliance Certificate", 3),
    (r"description\s*of\s*(the\s*)?notes|prospectus|424b|\bs-?4\b", "Covenant Description (prospectus)", 4),
    (r"press\s*release|investor|presentation|\bex-?99\b", "Marketing / Press (Ex-99)", 6),
]


def classify(filename: str, description: str = "") -> Tuple[str, Optional[int]]:
    hay = f"{filename} {description}".lower()
    for pattern, label, rank in _CLASSIFIERS:
        if re.search(pattern, hay):
            return label, rank
    return "Other / Unclassified", None


# ─── helpers ─────────────────────────────────────────────────────────────────


def _doc_url(cik: str, accession: str, primary_doc: str) -> str:
    return f"{_ARCHIVES.format(cik=int(cik), acc=accession.replace('-', ''))}/{primary_doc}"


def _as_int(v) -> Optional[int]:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None
