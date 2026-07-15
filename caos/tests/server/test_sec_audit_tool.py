from __future__ import annotations

from pathlib import Path

import run_sec_audit


def _scan(tmp_path: Path, source: str, *, allowlist=frozenset()):
    path = tmp_path / "route_fixture.py"
    path.write_text(source, encoding="utf-8")
    original_root = run_sec_audit.ROOT
    try:
        run_sec_audit.ROOT = tmp_path
        return run_sec_audit.scan_file(path, allowlist=allowlist)
    finally:
        run_sec_audit.ROOT = original_root


def test_scans_async_and_sync_route_handlers(tmp_path: Path):
    findings = _scan(
        tmp_path,
        """
@router.get('/async')
async def async_open():
    pass

@router.post('/sync')
def sync_open():
    pass
""",
    )
    assert {finding["summary"] for finding in findings} == {
        "Route handler async_open has no approved caller-identity dependency.",
        "Route handler sync_open has no approved caller-identity dependency.",
    }


def test_requires_an_approved_identity_dependency(tmp_path: Path):
    findings = _scan(
        tmp_path,
        """
@router.get('/generic')
async def generic(db=Depends(get_db)):
    pass

@router.get('/identity')
async def identity(caller: CallerIdentity = Depends(get_identity)):
    pass

@router.get('/role')
async def role(caller = Depends(require_role('analyst'))):
    pass
""",
    )
    assert len(findings) == 1
    assert "generic" in str(findings[0]["summary"])


def test_router_dependency_and_exact_allowlist_are_supported(tmp_path: Path):
    findings = _scan(
        tmp_path,
        """
router = APIRouter(dependencies=[Depends(get_identity)])

@router.get('/protected')
async def protected():
    pass
""",
    )
    assert findings == []

    findings = _scan(
        tmp_path,
        """
@router.get('/bootstrap')
async def bootstrap():
    pass

@router.get('/new-open-route')
async def newly_open():
    pass
""",
        allowlist=frozenset({("route_fixture.py", "bootstrap")}),
    )
    assert [finding["summary"] for finding in findings] == [
        "Route handler newly_open has no approved caller-identity dependency."
    ]


def test_parse_errors_fail_closed(tmp_path: Path):
    findings = _scan(tmp_path, "async def broken(:\n")
    assert len(findings) == 1
    assert findings[0]["lens"] == "availability"
