"""E4 — "never in logs" secret hygiene (see caos/docs/reference/SECRETS.md).

Boot the app with a unique sentinel value in every secret the stack consumes,
drive the surfaces most likely to echo configuration (boot/lifespan, health,
auth, an issuer mutation, a degraded LLM call, a rejected upload), and assert
no sentinel ever reaches the captured application log stream — including via
exception messages and logged request context.

Adding a new secret? Add its env var + a fresh sentinel here in the same PR
(SECRETS.md rule 1).
"""
from __future__ import annotations

import logging
import os

import pytest
from fastapi.testclient import TestClient

import config

# env var -> sentinel. Values are unique and grep-proof (never legitimate output).
# Deployed-posture startup now rejects any production credential under 32
# UTF-8 bytes (main.py _require_deployed_credential_strength) — these two
# sentinels must clear that floor too, or app boot fails before this test's
# own assertions ever run.
SECRET_SENTINELS = {
    "SESSION_SECRET": "sentinel-session-9f3a1c77e2-x9k2mQ7z",
    "EDGE_PROXY_SECRET": "sentinel-edge-41bb2d90aa-p4vN8wZq2r",
    "ANALYST_SIGNUP_CODE": "sentinel-signup-7cd0e3f512",
    "ANTHROPIC_API_KEY": "",   # stays blank — a truthy key flips lanes live (conftest BE9-1);
    "GEMINI_API_KEY": "",      # the keyed-path echo risk is covered by the llm-safety playbook.
    "OPENROUTER_API_KEY": "",
}


class _CaptureHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.lines.append(self.format(record))
        except Exception:  # noqa: BLE001 — a malformed record must not hide the scan
            self.lines.append(repr(record.__dict__))


@pytest.fixture()
def captured_logs(monkeypatch):
    for var, value in SECRET_SENTINELS.items():
        monkeypatch.setenv(var, value)
    # Deployed mode: dev ENVIRONMENT + provisioned prod secrets refuses to boot
    # (config.py fail-closed contradiction guard — good), so run the scan in a
    # deployed posture, which is also where the edge-secret code path executes.
    monkeypatch.setenv("ENVIRONMENT", "staging")
    # Deployed boots refuse the demo seed (another fail-closed guard) — drop
    # the conftest's dev default for this scan.
    monkeypatch.delenv("CAOS_DEMO_SEED", raising=False)
    # Deployed boots also refuse to start without a malware scanner configured
    # (config.require_malware_scanner_in_production) — not a secret, just a
    # boot precondition for this posture.
    monkeypatch.setenv("CLAMAV_HOST", "clamav-log-hygiene-probe")
    config.get_settings.cache_clear()
    handler = _CaptureHandler()
    handler.setFormatter(logging.Formatter("%(name)s %(levelname)s %(message)s"))
    root = logging.getLogger()
    old_level = root.level
    root.addHandler(handler)
    root.setLevel(logging.DEBUG)
    try:
        yield handler
    finally:
        root.removeHandler(handler)
        root.setLevel(old_level)
        config.get_settings.cache_clear()


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL", "").startswith("postgresql"),
    reason="deployed-posture boot requires Postgres (fail-closed guard) — runs in the "
           "CI server job's Postgres step, or locally via DATABASE_URL=postgresql+asyncpg://...",
)
def test_no_secret_value_reaches_the_log_stream(captured_logs):
    from main import app

    edge = {
        # The deployed edge proof + forwarded identity — carries the edge secret
        # on EVERY request, which is exactly the value that must never be logged.
        "X-Edge-Authorization": SECRET_SENTINELS["EDGE_PROXY_SECRET"],
        "X-Forwarded-User": "1234",
        "X-Forwarded-Email": "analyst@corp.com",
        "X-Forwarded-Preferred-Username": "Log Hygiene Probe",
    }
    with TestClient(app) as client:  # lifespan boot logs happen here
        client.get("/api/health", headers=edge)
        client.get("/api/auth/me", headers=edge)
        # Missing edge proof — the 401 rejection path must not echo the secret.
        client.get("/api/auth/me")
        # Wrong signup code — the rejection path must not echo the real code.
        client.post(
            "/api/auth/register",
            json={"name": "Log Hygiene Probe", "email": "probe@corp.com",
                  "code": "wrong-code", "passcode": "irrelevant-123"},
            headers=edge,
        )
        # A mutation + a rejected upload: request-context logging paths.
        r = client.post("/api/issuers", json={"name": "Log Hygiene Probe Co"}, headers=edge)
        issuer_id = r.json().get("id") if r.status_code == 201 else None
        client.post(
            "/api/ingestion/upload/document",
            data={"issuer_id": issuer_id or "nonexistent", "run_mode": "earnings"},
            files={"file": ("probe.pdf", b"not a pdf", "application/pdf")},
            headers=edge,
        )
        # LLM lane degraded/keyless call.
        client.post("/api/chat", json={"issuer_id": issuer_id or "x", "message": "hi"}, headers=edge)

    stream = "\n".join(captured_logs.lines)
    assert captured_logs.lines, "capture handler saw no log records — the scan proved nothing"
    for var, sentinel in SECRET_SENTINELS.items():
        if sentinel:
            assert sentinel not in stream, (
                f"{var}'s value leaked into the application log stream — "
                "find the logging call and redact it (SECRETS.md rule 1)"
            )
